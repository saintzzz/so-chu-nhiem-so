-- CR-064 r2: notifications cho PH phai di trong RPC security-definer.
-- Nguyen nhan r2: ke_toan khong nam trong parents_staff_read -> action
-- doc parent_students/parents tra 0 row -> notification insert bo qua
-- lang le. RPC definer bypass RLS + chi gui cho PH cua HS CO hoa don
-- trong dot (chinh xac hon "moi PH trong truong").
create or replace function public.fee_issue_period(p_period uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p record; stu record; v_amount numeric; v_exempt numeric; v_lines jsonb;
  it record; ex_pct numeric; v_count int := 0; v_ins int; v_notified int := 0;
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

  -- Thong bao PH cua cac HS duoc phat hanh hoa don trong dot nay.
  insert into public.notifications (profile_id, type, title, body, link)
  select distinct pa.profile_id, 'fee', 'Thông báo thu phí',
    'Đợt thu "' || p.name || '" đã phát hành - vui lòng kiểm tra công nợ của con trong cổng phụ huynh.',
    '/portal/parent'
  from public.fee_invoices i
  join public.parent_students ps on ps.student_id = i.student_id
  join public.parents pa on pa.id = ps.parent_id
  where i.period_id = p_period and pa.profile_id is not null;
  get diagnostics v_notified = row_count;

  return jsonb_build_object('issued', v_count, 'notified', v_notified);
end; $$;

grant execute on function public.fee_issue_period(uuid) to authenticated;
