-- CR-064: module khoan thu (hoc phi) - ban kem school_features 'khoan_thu'.
-- Flow: khoan thu -> dang ky tu nguyen -> mien giam -> dot thu ->
-- hoa don = bat buoc + dang ky - mien giam -> thu nhieu lan -> cong no.

create table if not exists public.fee_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  name text not null,
  kind text not null default 'mandatory'
    check (kind in ('mandatory','voluntary')),
  unit_price numeric not null check (unit_price >= 0),
  unit text not null default 'thang',
  applies_to text not null default 'all'
    check (applies_to in ('all','grade','class')),
  grade smallint,
  class_id uuid references public.classes(id),
  academic_year_id uuid references public.academic_years(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_registrations (
  id uuid primary key default gen_random_uuid(),
  fee_item_id uuid not null references public.fee_items(id) on delete cascade,
  student_id uuid not null references public.students(id),
  school_id uuid not null references public.schools(id),
  created_at timestamptz not null default now(),
  unique (fee_item_id, student_id)
);

create table if not exists public.fee_exemptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  school_id uuid not null references public.schools(id),
  fee_item_id uuid references public.fee_items(id) on delete cascade,
  percent numeric not null default 100 check (percent > 0 and percent <= 100),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  name text not null,
  academic_year_id uuid references public.academic_years(id),
  due_date date,
  status text not null default 'draft'
    check (status in ('draft','issued','closed')),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_invoices (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.fee_periods(id) on delete cascade,
  student_id uuid not null references public.students(id),
  school_id uuid not null references public.schools(id),
  amount numeric not null default 0,
  exemption_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  status text not null default 'unpaid'
    check (status in ('unpaid','partial','paid','exempt')),
  lines jsonb not null default '[]',
  receipt_no text,
  created_at timestamptz not null default now(),
  unique (period_id, student_id)
);

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.fee_invoices(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  amount numeric not null check (amount > 0),
  method text not null default 'cash'
    check (method in ('cash','transfer')),
  note text,
  received_by uuid,
  created_at timestamptz not null default now()
);

alter table public.fee_items enable row level security;
alter table public.fee_registrations enable row level security;
alter table public.fee_exemptions enable row level security;
alter table public.fee_periods enable row level security;
alter table public.fee_invoices enable row level security;
alter table public.fee_payments enable row level security;

-- ke_toan + bgh + admin quan ly trong truong; so_gd xem
do $$
declare t text;
begin
  foreach t in array array['fee_items','fee_registrations','fee_exemptions',
                           'fee_periods','fee_invoices','fee_payments'] loop
    execute format(
      'create policy %I_select on public.%I for select using (
         school_id = (select my_school_id())
         or (select my_roles()) && array[''admin'',''so_gd'']::text[])', t, t);
    execute format(
      'create policy %I_write on public.%I for all using (
         school_id = (select my_school_id())
         and (select my_roles()) && array[''ke_toan'',''bgh'',''admin'']::text[])
       with check (school_id = (select my_school_id())
         and (select my_roles()) && array[''ke_toan'',''bgh'',''admin'']::text[])', t, t);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- PH xem cong no con cua minh qua portal (read-only):
-- parent_students.parent_id -> parents.id -> parents.profile_id = auth.uid()
create policy fee_inv_parent on public.fee_invoices for select using (
  exists (select 1 from public.parent_students ps
          join public.parents pa on pa.id = ps.parent_id
          where ps.student_id = fee_invoices.student_id
            and pa.profile_id = (select auth.uid()))
);

-- Phat hanh dot thu: sinh hoa don atomic cho moi HS dang hoc
-- (mandatory items + registrations tu nguyen) tru mien giam.
create or replace function public.fee_issue_period(p_period uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p record;
  stu record;
  v_amount numeric;
  v_exempt numeric;
  v_lines jsonb;
  it record;
  ex_pct numeric;
  v_count int := 0;
begin
  select * into p from public.fee_periods where id = p_period;
  if not found then raise exception 'period_not_found'; end if;
  if p.status <> 'draft' then raise exception 'already_issued'; end if;

  for stu in
    select s.id, s.class_id, c.grade
    from public.students s join public.classes c on c.id = s.class_id
    where s.status = 'active'
      and c.school_id = p.school_id
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
      -- mien giam: uu tien exemption theo item, sau do exemption chung (item null)
      select coalesce(max(e.percent), 0) into ex_pct
      from public.fee_exemptions e
      where e.student_id = stu.id
        and (e.fee_item_id = it.id or e.fee_item_id is null);
      v_exempt := v_exempt + round(it.unit_price * ex_pct / 100);
      v_lines := v_lines || jsonb_build_object(
        'item', it.name, 'price', it.unit_price,
        'exempt_pct', ex_pct);
    end loop;

    insert into public.fee_invoices (
      period_id, student_id, school_id, amount, exemption_amount, status, lines
    ) values (
      p_period, stu.id, p.school_id, v_amount, v_exempt,
      case when v_amount - v_exempt <= 0 then 'exempt' else 'unpaid' end,
      v_lines
    ) on conflict (period_id, student_id) do nothing;
    v_count := v_count + 1;
  end loop;

  update public.fee_periods set status = 'issued' where id = p_period
    and status = 'draft';
  return jsonb_build_object('issued', v_count);
end;
$$;

-- Thu tien: chen payment + cap nhat invoice atomic, sinh bien lai.
create or replace function public.fee_collect(
  p_invoice uuid, p_amount numeric, p_method text, p_note text,
  p_collector uuid
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  inv record;
  v_due numeric;
  v_receipt text;
  v_seq int;
begin
  select * into inv from public.fee_invoices where id = p_invoice for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if inv.status in ('paid','exempt') then raise exception 'already_settled'; end if;

  v_due := inv.amount - inv.exemption_amount;
  if p_amount is null or p_amount <= 0 or p_amount > v_due - inv.paid_amount then
    raise exception 'invalid_amount';
  end if;

  insert into public.fee_payments (invoice_id, school_id, amount, method, note, received_by)
  values (p_invoice, inv.school_id, p_amount, coalesce(p_method, 'cash'), p_note, p_collector);

  select count(*) + 1 into v_seq
  from public.fee_invoices where school_id = inv.school_id
    and receipt_no is not null;
  v_receipt := 'BL' || lpad(v_seq::text, 6, '0');

  update public.fee_invoices set
    paid_amount = paid_amount + p_amount,
    status = case
      when paid_amount + p_amount >= v_due then 'paid' else 'partial' end,
    receipt_no = case
      when paid_amount + p_amount >= v_due then coalesce(receipt_no, v_receipt)
      else receipt_no end
  where id = p_invoice;

  return jsonb_build_object('receipt_no', v_receipt);
end;
$$;

grant execute on function public.fee_issue_period(uuid) to authenticated;
grant execute on function public.fee_collect(uuid, numeric, text, text, uuid) to authenticated;
