-- CR-067: bien dong hoc sinh - chuyen den/di, bao luu, nhap hoc lai.
-- Workflow request -> approve: projection vao students.status + history + notify.
-- Moi write qua RPC security definer; direct table write bi revoke.

create or replace function public.sm_module_enabled(p_school uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select f.enabled from public.school_features f
  where f.school_id = p_school and f.module = 'bien_dong_hs'), true) $$;
revoke all on function public.sm_module_enabled(uuid) from public;
grant execute on function public.sm_module_enabled(uuid) to authenticated, anon;

-- students.status them 'reserved' (bao luu; 'suspended' giu ngu nghia dinh chi)
alter table public.students drop constraint students_status_check;
alter table public.students add constraint students_status_check
  check (status in ('active','transferred','graduated','suspended','reserved'));

create table public.sm_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  type text not null check (type in ('transfer_out','transfer_in','reserve','return')),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  student_id uuid references public.students(id) on delete restrict,
  student_name text not null,
  class_label text,
  effective_date date not null,
  counterpart_school text,
  to_class_id uuid references public.classes(id),
  payload jsonb not null default '{}'::jsonb,
  reason text,
  decision_note text,
  requested_by uuid references public.profiles(id),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_student_id uuid references public.students(id),
  created_at timestamptz not null default now()
);
alter table public.sm_requests enable row level security;
create index sm_req_school_status on public.sm_requests(school_id, status);
create index sm_req_student on public.sm_requests(student_id);

-- tenant guard: student (qua class) + to_class phai cung truong
create or replace function public.sm_tenant_guard() returns trigger
language plpgsql as $$
begin
  if new.student_id is not null then
    if (select c.school_id from public.students s
        join public.classes c on c.id = s.class_id
        where s.id = new.student_id) is distinct from new.school_id then
      raise exception 'cross_school_student';
    end if;
  end if;
  if new.to_class_id is not null then
    if (select c.school_id from public.classes c
        where c.id = new.to_class_id) is distinct from new.school_id then
      raise exception 'cross_school_class';
    end if;
  end if;
  return new;
end $$;
create trigger sm_tenant before insert or update on public.sm_requests
  for each row execute function public.sm_tenant_guard();

-- RLS: staff doc cung truong + module bat; write chi qua RPC
create policy sm_req_read on public.sm_requests for select
  using (school_id = (select my_school_id())
    and (select my_roles()) && array['gvcn','to_truong','bgh','admin','so_gd']::text[]
    and (select public.sm_module_enabled(school_id)));
grant select on public.sm_requests to authenticated;
revoke insert, update, delete on public.sm_requests from authenticated, anon;

-- ===== sm_create =====
create or replace function public.sm_create(
  p_type text, p_student uuid, p_effective date, p_counterpart text,
  p_to_class uuid, p_reason text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_roles text[] := (select my_roles());
  v_st record; v_name text; v_clabel text; v_req uuid;
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
    if nullif(btrim(coalesce(p_payload->>'full_name','')), '') is null
       or nullif(btrim(coalesce(p_payload->>'dob','')), '') is null then
      raise exception 'payload_incomplete';
    end if;
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
    -- gvcn chi tao yeu cau cho HS lop chu nhiem cua minh
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

-- ===== sm_decide =====
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

  update public.sm_requests
  set status = p_decision, decided_by = auth.uid(), decided_at = now(),
      decision_note = nullif(trim(coalesce(p_note,'')), '')
  where id = v_req.id;

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
      select s.code into v_code from public.students s
      where s.code ~ '^HS[0-9]+$' order by s.code desc limit 1;
      v_code := 'HS' || lpad((coalesce(substring(v_code from 3),'0')::int + 1)::text, 6, '0');
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

-- ===== sm_cancel =====
create or replace function public.sm_cancel(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_req record;
begin
  if v_school is null or not ((select my_roles()) && array['gvcn','bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.sm_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  select * into v_req from public.sm_requests r
  where r.id = p_id and r.school_id = v_school for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.status <> 'pending' then raise exception 'not_pending'; end if;
  if v_req.requested_by <> auth.uid()
     and not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  update public.sm_requests set status = 'cancelled' where id = v_req.id;
  return jsonb_build_object('request_id', v_req.id, 'decision', 'cancelled');
end $$;

revoke all on function public.sm_create(text, uuid, date, text, uuid, text, jsonb) from public, anon;
revoke all on function public.sm_decide(uuid, text, text) from public, anon;
revoke all on function public.sm_cancel(uuid) from public, anon;
grant execute on function public.sm_create(text, uuid, date, text, uuid, text, jsonb) to authenticated;
grant execute on function public.sm_decide(uuid, text, text) to authenticated;
grant execute on function public.sm_cancel(uuid) to authenticated;
