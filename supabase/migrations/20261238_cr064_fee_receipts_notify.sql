-- CR-064 r3: review fixes.
-- 1) Notify chi cho PH cua HS co hoa don VUA duoc insert trong lan goi
--    nay (truoc do join tat ca invoices cua period -> period draft co
--    invoice cu se lek thong bao cho HS khong duoc phat hanh).
-- 2) Tenant-tight: PH phai thuoc cung truong qua profiles.school_id -
--    chan parent_students link cheo truong bi definer bypass RLS.
-- 3) Bien lai per-payment: moi lan thu (ke ca thu mot phan) cap so BL
--    luu tren fee_payments.receipt_no - dung thuc te ke toan, khong con
--    tieu so BL ma khong luu.

alter table public.fee_payments add column if not exists receipt_no text;
create unique index if not exists fee_pay_receipt_uq
  on public.fee_payments (school_id, receipt_no) where receipt_no is not null;

create or replace function public.fee_issue_period(p_period uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p record; stu record; v_amount numeric; v_exempt numeric; v_lines jsonb;
  it record; ex_pct numeric; v_count int := 0; v_ins int; v_notified int := 0;
  v_students uuid[] := '{}';
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
    if v_ins > 0 then v_students := v_students || stu.id; end if;
  end loop;
  update public.fee_periods set status = 'issued' where id = p_period and status = 'draft';

  -- Thong bao PH cua dung cac HS vua duoc phat hanh; PH phai thuoc cung
  -- truong (qua profile) de chan link parent_students cheo truong.
  insert into public.notifications (profile_id, type, title, body, link)
  select distinct pa.profile_id, 'fee', 'Thông báo thu phí',
    'Đợt thu "' || p.name || '" đã phát hành - vui lòng kiểm tra công nợ của con trong cổng phụ huynh.',
    '/portal/parent'
  from public.parent_students ps
  join public.parents pa on pa.id = ps.parent_id
  join public.profiles pr on pr.id = pa.profile_id and pr.school_id = p.school_id
  where ps.student_id = any(v_students) and pa.profile_id is not null;
  get diagnostics v_notified = row_count;

  return jsonb_build_object('issued', v_count, 'notified', v_notified);
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
  -- So bien lai atomic per school: row lock tren counter, khong dua vao count(*).
  insert into public.fee_receipt_seq (school_id, next_no) values (inv.school_id, 1)
  on conflict (school_id) do nothing;
  update public.fee_receipt_seq set next_no = next_no + 1
  where school_id = inv.school_id returning next_no - 1 into v_seq;
  v_receipt := 'BL' || lpad(v_seq::text, 6, '0');
  -- Moi lan thu la mot bien lai: luu so BL tren chinh payment.
  insert into public.fee_payments (invoice_id, school_id, amount, method, note, received_by, receipt_no)
  values (p_invoice, inv.school_id, p_amount, coalesce(p_method, 'cash'), p_note, (select auth.uid()), v_receipt);
  update public.fee_invoices
  set paid_amount = paid_amount + p_amount,
      status = case when paid_amount + p_amount >= v_due then 'paid' else 'partial' end,
      receipt_no = case when paid_amount + p_amount >= v_due then coalesce(receipt_no, v_receipt) else receipt_no end
  where id = p_invoice;
  return jsonb_build_object('receipt_no', v_receipt);
end; $$;

grant execute on function public.fee_issue_period(uuid) to authenticated;
grant execute on function public.fee_collect(uuid, numeric, text, text) to authenticated;
