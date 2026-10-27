-- CR-064 hardening: RPC security definer phai tu kiem role + school.
-- Truoc do moi authenticated user goi duoc cho truong bat ky (bypass RLS).
create or replace function public.fee_issue_period(p_period uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p record; stu record; v_amount numeric; v_exempt numeric; v_lines jsonb;
  it record; ex_pct numeric; v_count int := 0;
begin
  if not ((select my_roles()) && array['ke_toan','bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  select * into p from public.fee_periods where id = p_period;
  if not found then raise exception 'period_not_found'; end if;
  if p.school_id <> (select my_school_id()) then raise exception 'school_mismatch'; end if;
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
      where e.student_id = stu.id
        and (e.fee_item_id = it.id or e.fee_item_id is null);
      v_exempt := v_exempt + round(it.unit_price * ex_pct / 100);
      v_lines := v_lines || jsonb_build_object('item', it.name, 'price', it.unit_price, 'exempt_pct', ex_pct);
    end loop;
    insert into public.fee_invoices (period_id, student_id, school_id, amount, exemption_amount, status, lines)
    values (p_period, stu.id, p.school_id, v_amount, v_exempt,
            case when v_amount - v_exempt <= 0 then 'exempt' else 'unpaid' end, v_lines)
    on conflict (period_id, student_id) do nothing;
    v_count := v_count + 1;
  end loop;
  update public.fee_periods set status = 'issued' where id = p_period and status = 'draft';
  return jsonb_build_object('issued', v_count);
end; $$;

-- fee_collect: bo tham so p_collector (caller tu set duoc) - dung auth.uid();
-- them check role + school.
drop function if exists public.fee_collect(uuid, numeric, text, text, uuid);
create function public.fee_collect(p_invoice uuid, p_amount numeric, p_method text, p_note text)
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
  if inv.status in ('paid','exempt') then raise exception 'already_settled'; end if;
  v_due := inv.amount - inv.exemption_amount;
  if p_amount is null or p_amount <= 0 or p_amount > v_due - inv.paid_amount then
    raise exception 'invalid_amount';
  end if;
  insert into public.fee_payments (invoice_id, school_id, amount, method, note, received_by)
  values (p_invoice, inv.school_id, p_amount, coalesce(p_method, 'cash'), p_note, (select auth.uid()));
  select count(*) + 1 into v_seq
  from public.fee_invoices where school_id = inv.school_id and receipt_no is not null;
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
