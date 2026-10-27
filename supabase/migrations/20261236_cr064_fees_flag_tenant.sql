-- CR-064 r1: review fixes.
-- 1) Module flag check o TANG DB: RPC + write policies deu phai ton trong
--    school_features (truoc do chi action check -> bypass duoc qua PostgREST).
-- 2) Cross-tenant integrity: trigger chan row tro sang du lieu truong khac.
-- 3) Receipt so atomic per school (sequence per school + unique index).
-- 4) Issue: lock period row, dem insert that qua GET DIAGNOSTICS.

-- ===== 1) Module-enabled helper =====
create or replace function public.fee_module_enabled(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.school_features sf
    where sf.school_id = p_school and sf.module = 'khoan_thu' and sf.enabled = false
  );
$$;

-- ===== 2) Tenant-integrity trigger =====
-- Chan moi row fee_* tro toi student/class/item cua truong khac.
create or replace function public.fee_check_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  if TG_TABLE_NAME = 'fee_items' then
    if NEW.class_id is not null then
      select c.school_id into v_school from public.classes c where c.id = NEW.class_id;
      if v_school is distinct from NEW.school_id then raise exception 'cross_school_class'; end if;
    end if;
  elsif TG_TABLE_NAME = 'fee_registrations' then
    select fi.school_id into v_school from public.fee_items fi where fi.id = NEW.fee_item_id;
    if v_school is distinct from NEW.school_id then raise exception 'cross_school_item'; end if;
    select c.school_id into v_school from public.students s join public.classes c on c.id = s.class_id where s.id = NEW.student_id;
    if v_school is distinct from NEW.school_id then raise exception 'cross_school_student'; end if;
  elsif TG_TABLE_NAME = 'fee_exemptions' then
    select c.school_id into v_school from public.students s join public.classes c on c.id = s.class_id where s.id = NEW.student_id;
    if v_school is distinct from NEW.school_id then raise exception 'cross_school_student'; end if;
    if NEW.fee_item_id is not null then
      select fi.school_id into v_school from public.fee_items fi where fi.id = NEW.fee_item_id;
      if v_school is distinct from NEW.school_id then raise exception 'cross_school_item'; end if;
    end if;
  elsif TG_TABLE_NAME = 'fee_invoices' then
    select c.school_id into v_school from public.students s join public.classes c on c.id = s.class_id where s.id = NEW.student_id;
    if v_school is distinct from NEW.school_id then raise exception 'cross_school_student'; end if;
    select p.school_id into v_school from public.fee_periods p where p.id = NEW.period_id;
    if v_school is distinct from NEW.school_id then raise exception 'cross_school_period'; end if;
  elsif TG_TABLE_NAME = 'fee_payments' then
    select i.school_id into v_school from public.fee_invoices i where i.id = NEW.invoice_id;
    if v_school is distinct from NEW.school_id then raise exception 'cross_school_invoice'; end if;
  end if;
  return NEW;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['fee_items','fee_registrations','fee_exemptions','fee_invoices','fee_payments'] loop
    execute format('drop trigger if exists fee_tenant on public.%I', t);
    execute format('create trigger fee_tenant before insert or update on public.%I for each row execute function public.fee_check_tenant()', t);
  end loop;
end $$;

-- ===== 3) Receipt so atomic per school =====
create table if not exists public.fee_receipt_seq (
  school_id uuid primary key references public.schools(id),
  next_no int not null default 1
);
alter table public.fee_receipt_seq enable row level security;
create unique index if not exists fee_inv_receipt_uq
  on public.fee_invoices (school_id, receipt_no) where receipt_no is not null;

-- ===== 4) Write policies: them module-enabled predicate =====
do $$
declare t text;
begin
  foreach t in array array['fee_items','fee_registrations','fee_exemptions','fee_periods','fee_invoices','fee_payments'] loop
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format($p$create policy %I_write on public.%I for all
      using (school_id = (select my_school_id())
        and (select my_roles()) && array['ke_toan','bgh','admin']::text[]
        and (select public.fee_module_enabled(school_id)))
      with check (school_id = (select my_school_id())
        and (select my_roles()) && array['ke_toan','bgh','admin']::text[]
        and (select public.fee_module_enabled(school_id)))$p$, t, t);
  end loop;
end $$;

-- ===== 5) RPC: module flag + period lock + diagnostics count =====
create or replace function public.fee_issue_period(p_period uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p record; stu record; v_amount numeric; v_exempt numeric; v_lines jsonb;
  it record; ex_pct numeric; v_count int := 0; v_ins int;
begin
  if not ((select my_roles()) && array['ke_toan','bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  select * into p from public.fee_periods where id = p_period for update;
  if not found then raise exception 'period_not_found'; end if;
  if p.school_id <> (select my_school_id()) then raise exception 'school_mismatch'; end if;
  if not (select public.fee_module_enabled(p.school_id)) then raise exception 'module_disabled'; end if;
  if p.status <> 'draft' then raise exception 'already_issued'; end if;

  for stu in
    select s.id, s.class_id, c.grade
    from public.students s join public.classes c on c.id = s.class_id
    where s.status = 'active' and c.school_id = p.school_id
  loop
    v_amount := 0; v_exempt := 0; v_lines := '[]'::jsonb;
    for it in
      select * from public.fee_items fi
      where fi.school_id = p.school_id and fi.active
        and (fi.applies_to = 'all'
          or (fi.applies_to = 'grade' and fi.grade = stu.grade)
          or (fi.applies_to = 'class' and fi.class_id = stu.class_id))
        and (fi.kind = 'mandatory'
          or exists (select 1 from public.fee_registrations r
                     where r.fee_item_id = fi.id and r.student_id = stu.id))
    loop
      v_amount := v_amount + it.unit_price;
      select coalesce(max(e.percent), 0) into ex_pct
      from public.fee_exemptions e
      where e.student_id = stu.id and e.school_id = p.school_id
        and (e.fee_item_id = it.id or e.fee_item_id is null);
      v_exempt := v_exempt + round(it.unit_price * ex_pct / 100);
      v_lines := v_lines || jsonb_build_object('item', it.name, 'price', it.unit_price, 'exempt_pct', ex_pct);
    end loop;
    insert into public.fee_invoices (period_id, student_id, school_id, amount, exemption_amount, status, lines)
    values (p_period, stu.id, p.school_id, v_amount, v_exempt,
            case when v_amount - v_exempt <= 0 then 'exempt' else 'unpaid' end, v_lines)
    on conflict (period_id, student_id) do nothing;
    get diagnostics v_ins = row_count;
    v_count := v_count + v_ins;
  end loop;
  update public.fee_periods set status = 'issued' where id = p_period and status = 'draft';
  return jsonb_build_object('issued', v_count);
end; $$;

create or replace function public.fee_collect(p_invoice uuid, p_amount numeric, p_method text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inv record; v_due numeric; v_receipt text; v_seq int;
begin
  if not ((select my_roles()) && array['ke_toan','bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  select * into inv from public.fee_invoices where id = p_invoice for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if inv.school_id <> (select my_school_id()) then raise exception 'school_mismatch'; end if;
  if not (select public.fee_module_enabled(inv.school_id)) then raise exception 'module_disabled'; end if;
  if inv.status in ('paid','exempt') then raise exception 'already_settled'; end if;
  v_due := inv.amount - inv.exemption_amount;
  if p_amount is null or p_amount <= 0 or p_amount > v_due - inv.paid_amount then
    raise exception 'invalid_amount';
  end if;
  insert into public.fee_payments (invoice_id, school_id, amount, method, note, received_by)
  values (p_invoice, inv.school_id, p_amount, coalesce(p_method, 'cash'), p_note, (select auth.uid()));
  -- So bien lai atomic per school: row lock tren counter, khong dua vao count(*).
  insert into public.fee_receipt_seq (school_id, next_no) values (inv.school_id, 1)
  on conflict (school_id) do nothing;
  update public.fee_receipt_seq set next_no = next_no + 1
  where school_id = inv.school_id returning next_no - 1 into v_seq;
  v_receipt := 'BL' || lpad(v_seq::text, 6, '0');
  update public.fee_invoices
  set paid_amount = paid_amount + p_amount,
      status = case when paid_amount + p_amount >= v_due then 'paid' else 'partial' end,
      receipt_no = case when paid_amount + p_amount >= v_due then coalesce(receipt_no, v_receipt) else receipt_no end
  where id = p_invoice;
  return jsonb_build_object('receipt_no', v_receipt);
end; $$;

grant execute on function public.fee_issue_period(uuid) to authenticated;
grant execute on function public.fee_collect(uuid, numeric, text, text) to authenticated;
