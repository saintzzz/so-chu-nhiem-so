-- CR-067 r1: dong findings external review.
-- 1) code seq order theo so (tranh HS999999 > HS1000000 lexicographic).
-- 2) sm_decide: projection truoc, update request status sau (atomic tuong minh).
-- 3) validate payload dob/gender ngay luc create.
-- 4) RLS read: gvcn/to_truong chi thay request cua minh + HS lop chu nhiem;
--    bgh/admin/so_gd thay toan truong.

-- 4) RLS read scope theo vai tro
drop policy if exists sm_req_read on public.sm_requests;
create policy sm_req_read on public.sm_requests for select
  using (school_id = (select my_school_id())
    and (select public.sm_module_enabled(school_id))
    and (
      (select my_roles()) && array['bgh','admin','so_gd']::text[]
      or (
        (select my_roles()) && array['gvcn','to_truong']::text[]
        and (
          requested_by = auth.uid()
          or student_id in (
            select s.id from public.students s
            join public.classes c on c.id = s.class_id
            where c.gvcn_id = auth.uid())
          or to_class_id in (
            select c.id from public.classes c where c.gvcn_id = auth.uid())
        )
      )
    ));

-- 2+3) sm_create: validate payload som + sm_decide reorder
create or replace function public.sm_create(
  p_type text, p_student uuid, p_effective date, p_counterpart text,
  p_to_class uuid, p_reason text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_roles text[] := (select my_roles());
  v_st record; v_name text; v_clabel text; v_req uuid; v_dob date; v_gender text;
begin
  if v_school is null or not (v_roles && array['gvcn','bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.sm_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if p_type not in ('transfer_out','transfer_in','reserve','return') then
    raise exception 'invalid_type';
  end if;
  if p_effective is null then raise exception 'effective_required'; end if;
  p_counterpart := nullif(trim(coalesce(p_counterpart,'')), '');
  if p_type in ('transfer_out','transfer_in') and p_counterpart is null then
    raise exception 'counterpart_required';
  end if;

  if p_type = 'transfer_in' then
    if not (v_roles && array['bgh','admin']::text[]) then
      raise exception 'forbidden';
    end if;
    if p_to_class is null then raise exception 'class_required'; end if;
    select c.name into v_clabel from public.classes c
    where c.id = p_to_class and c.school_id = v_school;
    if not found then raise exception 'class_not_found'; end if;
    if nullif(btrim(coalesce(p_payload->>'full_name','')), '') is null then
      raise exception 'payload_incomplete';
    end if;
    begin
      v_dob := (p_payload->>'dob')::date;
    exception when others then raise exception 'invalid_dob'; end;
    if v_dob is null then raise exception 'payload_incomplete'; end if;
    v_gender := coalesce(nullif(p_payload->>'gender',''), 'khac');
    if v_gender not in ('nam','nu','khac') then raise exception 'invalid_gender'; end if;
    v_name := btrim(p_payload->>'full_name');
  else
    if p_student is null then raise exception 'student_required'; end if;
    select st.id, st.full_name, st.status, c.name as cname, c.gvcn_id, c.school_id
    into v_st
    from public.students st join public.classes c on c.id = st.class_id
    where st.id = p_student;
    if not found or v_st.school_id <> v_school then
      raise exception 'student_not_found';
    end if;
    if v_roles && array['bgh','admin']::text[] then null;
    elsif not (v_roles && array['gvcn']::text[]) or v_st.gvcn_id <> auth.uid() then
      raise exception 'forbidden';
    end if;
    if p_type = 'transfer_out' and v_st.status <> 'active' then
      raise exception 'invalid_state';
    end if;
    if p_type = 'reserve' and v_st.status <> 'active' then
      raise exception 'invalid_state';
    end if;
    if p_type = 'return' and v_st.status <> 'reserved' then
      raise exception 'invalid_state';
    end if;
    if exists (select 1 from public.sm_requests r
      where r.student_id = p_student and r.status = 'pending') then
      raise exception 'pending_exists';
    end if;
    v_name := v_st.full_name; v_clabel := v_st.cname;
    if p_type = 'return' and p_to_class is not null then
      if (select c.school_id from public.classes c where c.id = p_to_class) <> v_school then
        raise exception 'cross_school_class';
      end if;
      select c.name into v_clabel from public.classes c where c.id = p_to_class;
    else
      p_to_class := null;
    end if;
  end if;

  insert into public.sm_requests
    (school_id, type, student_id, student_name, class_label, effective_date,
     counterpart_school, to_class_id, payload, reason, requested_by)
  values (v_school, p_type, p_student, v_name, v_clabel, p_effective,
          p_counterpart, p_to_class, coalesce(p_payload,'{}'::jsonb),
          nullif(trim(coalesce(p_reason,'')), ''), auth.uid())
  returning id into v_req;
  return jsonb_build_object('request_id', v_req);
end $$;

create or replace function public.sm_decide(p_id uuid, p_decision text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_req record; v_new uuid; v_code text; v_status_old text; v_class_old uuid;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.sm_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;

  select * into v_req from public.sm_requests r
  where r.id = p_id and r.school_id = v_school for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.status <> 'pending' then raise exception 'not_pending'; end if;

  -- Projection truoc; status request cap nhat sau khi moi mutation thanh cong.
  if p_decision = 'approved' then
    if v_req.type = 'transfer_out' then
      update public.students set status = 'transferred'
      where id = v_req.student_id and status = 'active' returning status into v_status_old;
      if v_status_old is null then raise exception 'state_conflict'; end if;
      insert into public.student_record_history (student_id, changed_by, field, old_value, new_value)
      values (v_req.student_id, auth.uid(), 'status', 'active', 'transferred');
    elsif v_req.type = 'reserve' then
      update public.students set status = 'reserved'
      where id = v_req.student_id and status = 'active' returning status into v_status_old;
      if v_status_old is null then raise exception 'state_conflict'; end if;
      insert into public.student_record_history (student_id, changed_by, field, old_value, new_value)
      values (v_req.student_id, auth.uid(), 'status', 'active', 'reserved');
    elsif v_req.type = 'return' then
      select st.status, st.class_id into v_status_old, v_class_old
      from public.students st where st.id = v_req.student_id for update;
      if v_status_old <> 'reserved' then raise exception 'state_conflict'; end if;
      update public.students
      set status = 'active', class_id = coalesce(v_req.to_class_id, class_id)
      where id = v_req.student_id;
      insert into public.student_record_history (student_id, changed_by, field, old_value, new_value)
      values (v_req.student_id, auth.uid(), 'status', 'reserved', 'active');
      if v_req.to_class_id is not null and v_req.to_class_id <> v_class_old then
        insert into public.student_record_history (student_id, changed_by, field, old_value, new_value)
        values (v_req.student_id, auth.uid(), 'class_id',
                v_class_old::text, v_req.to_class_id::text);
      end if;
    elsif v_req.type = 'transfer_in' then
      perform pg_advisory_xact_lock(hashtext('sm_code'));
      -- 1) order theo numeric suffix, khong lexicographic
      select max(substring(s.code from 3)::bigint)::text into v_status_old
      from public.students s where s.code ~ '^HS[0-9]+$';
      v_code := 'HS' || lpad((coalesce(v_status_old, '0')::bigint + 1)::text, 6, '0');
      insert into public.students
        (class_id, code, full_name, dob, gender, address, national_id, status)
      values (v_req.to_class_id, v_code, btrim(v_req.payload->>'full_name'),
              (v_req.payload->>'dob')::date,
              coalesce(nullif(v_req.payload->>'gender',''),'khac'),
              nullif(btrim(coalesce(v_req.payload->>'address','')), ''),
              nullif(btrim(coalesce(v_req.payload->>'national_id','')), ''),
              'active')
      returning id into v_new;
      update public.sm_requests set created_student_id = v_new where id = v_req.id;
      insert into public.student_record_history (student_id, changed_by, field, old_value, new_value)
      values (v_new, auth.uid(), 'status', null, 'active');
    end if;
  end if;

  update public.sm_requests
  set status = p_decision, decided_by = auth.uid(), decided_at = now(),
      decision_note = nullif(trim(coalesce(p_note,'')), '')
  where id = v_req.id;

  if v_req.requested_by is not null and v_req.requested_by <> auth.uid() then
    insert into public.notifications (profile_id, type, title, body, link)
    values (v_req.requested_by, 'bien_dong',
      case p_decision when 'approved' then 'Yêu cầu biến động được duyệt'
                      else 'Yêu cầu biến động bị từ chối' end,
      'Học sinh ' || v_req.student_name || ' - ' || v_req.type ||
      case when p_decision = 'rejected' and nullif(trim(coalesce(p_note,'')), '') is not null
           then ' - Lý do: ' || trim(p_note) else '' end,
      '/movements');
  end if;
  return jsonb_build_object('request_id', v_req.id, 'decision', p_decision,
    'student_id', coalesce(v_new, v_req.student_id));
end $$;
