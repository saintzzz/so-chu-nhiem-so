-- CR-068 r1 (external review): preserve manual overrides on finalize.
-- 'pending' qua tn_set_decision = huy override (xoa decided_*); finalize chi
-- tinh lai dong pending chua override (decided_by is null).

create or replace function public.tn_set_decision(
  p_id uuid, p_value text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_camp_status text;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.tn_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if p_value not in ('approved','rejected','pending') then
    raise exception 'invalid_decision';
  end if;
  select c.status into v_camp_status from public.tn_decisions d
    join public.tn_campaigns c on c.id = d.campaign_id
    where d.id = p_id and d.school_id = v_school;
  if not found then raise exception 'decision_not_found'; end if;
  if v_camp_status <> 'open' then raise exception 'campaign_closed'; end if;

  update public.tn_decisions
  set decision = p_value, note = nullif(btrim(coalesce(p_note,'')), ''),
      decided_by = case when p_value = 'pending' then null else auth.uid() end,
      decided_at = case when p_value = 'pending' then null else now() end
  where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.tn_finalize(p_campaign uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_camp record; v_grad int := 0; v_rej int := 0;
  v_stu record;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.tn_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  select * into v_camp from public.tn_campaigns c
    where c.id = p_campaign and c.school_id = v_school;
  if not found then raise exception 'campaign_not_found'; end if;
  if v_camp.status <> 'open' then raise exception 'campaign_closed'; end if;

  -- Pending CHUA override (decided_by null) -> theo eligible;
  -- dong da duoc bgh override thu cong giu nguyen.
  update public.tn_decisions d
  set decision = case when d.eligible then 'approved' else 'rejected' end,
      decided_by = auth.uid(), decided_at = now()
  where d.campaign_id = p_campaign and d.decision = 'pending'
    and d.decided_by is null;

  for v_stu in
    select d.student_id, s.class_id, c.gvcn_id
      from public.tn_decisions d
      join public.students s on s.id = d.student_id
      join public.classes c on c.id = s.class_id
      where d.campaign_id = p_campaign and d.decision = 'approved'
        and s.status = 'active'
  loop
    update public.students set status = 'graduated'
    where id = v_stu.student_id;
    insert into public.student_record_history
      (student_id, changed_by, field, old_value, new_value, changed_at)
    values (v_stu.student_id, auth.uid(), 'status', 'active', 'graduated', now());
    if v_stu.gvcn_id is not null then
      insert into public.notifications
        (profile_id, type, title, body, link)
      values (v_stu.gvcn_id, 'tot_nghiep',
              'Học sinh tốt nghiệp',
              'Một học sinh lớp chủ nhiệm đã được công nhận tốt nghiệp: ' || v_camp.name,
              '/school/graduation');
    end if;
    v_grad := v_grad + 1;
  end loop;

  select count(*) into v_rej from public.tn_decisions
    where campaign_id = p_campaign and decision = 'rejected';

  update public.tn_campaigns
  set status = 'finalized', finalized_by = auth.uid(), finalized_at = now()
  where id = p_campaign;
  return jsonb_build_object('graduated', v_grad, 'rejected', v_rej);
end $$;
