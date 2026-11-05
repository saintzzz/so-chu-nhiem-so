-- CR-115: privacy_dsr - so ghi dong thuan PHHS + tiep nhan yeu cau quyen chu the.
-- Luat 91/2025: du lieu tre em can dong thuan PHHS; quyen chu the can quy trinh
-- tiep nhan + xu ly co thoi han. Read/write chi bgh|admin qua RPC; DML revoked.

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  student_id uuid references public.students(id),
  subject_label text not null,
  purpose text not null
    check (purpose in ('hoc_tap','suc_khoe','sinh_trac','ai','hinh_anh')),
  channel text not null default 'giay'
    check (channel in ('giay','import','cong','khac')),
  granted boolean not null default true,
  granted_by_name text not null,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.consent_records enable row level security;
create index consent_school on public.consent_records(school_id, created_at desc);

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  req_type text not null
    check (req_type in ('access','rectify','erase','restrict','object','complain')),
  subject_label text not null,
  requester_name text not null,
  requester_contact text,
  detail text,
  received_at date not null,
  due_at date not null,
  status text not null default 'received'
    check (status in ('received','processing','done','rejected')),
  resolution_note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.data_requests enable row level security;
create index dsr_school on public.data_requests(school_id, due_at);

create or replace function public.pr_tenant_guard()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  v_caller uuid := public.my_school_id();
begin
  if v_caller is not null and new.school_id is distinct from v_caller then
    raise exception 'cross_tenant';
  end if;
  return new;
end $$;
create trigger consent_tenant before insert or update on public.consent_records
  for each row execute function public.pr_tenant_guard();
create trigger dsr_tenant before insert or update on public.data_requests
  for each row execute function public.pr_tenant_guard();

create policy consent_read on public.consent_records for select to authenticated
  using (school_id = (select my_school_id())
    and ((select my_roles()) && array['bgh','admin']::text[]));
create policy dsr_read on public.data_requests for select to authenticated
  using (school_id = (select my_school_id())
    and ((select my_roles()) && array['bgh','admin']::text[]));

create or replace function public.pr_consent_add(
  p_student uuid, p_subject_label text, p_purpose text, p_channel text,
  p_granted boolean, p_granted_by_name text, p_note text)
returns uuid language plpgsql security definer set search_path = public as
$$
declare
  v_school uuid := public.my_school_id();
  v_id uuid;
begin
  if v_school is null or not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if p_purpose not in ('hoc_tap','suc_khoe','sinh_trac','ai','hinh_anh') then
    raise exception 'invalid_purpose';
  end if;
  if p_channel not in ('giay','import','cong','khac') then raise exception 'invalid_channel'; end if;
  if p_subject_label is null or btrim(p_subject_label) = '' then raise exception 'invalid_subject'; end if;
  if p_granted_by_name is null or btrim(p_granted_by_name) = '' then raise exception 'invalid_granter'; end if;
  if p_student is not null and not exists
    (select 1 from public.students where id = p_student and school_id = v_school) then
    raise exception 'invalid_student';
  end if;
  insert into public.consent_records
    (school_id, student_id, subject_label, purpose, channel, granted,
     granted_by_name, note, created_by)
  values (v_school, p_student, btrim(p_subject_label), p_purpose, p_channel,
    coalesce(p_granted, true), btrim(p_granted_by_name),
    nullif(btrim(p_note),''), (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.pr_consent_revoke(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  v_school uuid := public.my_school_id();
begin
  if v_school is null or not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  update public.consent_records set revoked_at = now()
    where id = p_id and school_id = v_school and revoked_at is null;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.pr_dsr_create(
  p_req_type text, p_subject_label text, p_requester_name text,
  p_requester_contact text, p_detail text, p_received date, p_due date)
returns uuid language plpgsql security definer set search_path = public as
$$
declare
  v_school uuid := public.my_school_id();
  v_id uuid;
begin
  if v_school is null or not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if p_req_type not in ('access','rectify','erase','restrict','object','complain') then
    raise exception 'invalid_type';
  end if;
  if p_subject_label is null or btrim(p_subject_label) = '' then raise exception 'invalid_subject'; end if;
  if p_requester_name is null or btrim(p_requester_name) = '' then raise exception 'invalid_requester'; end if;
  if p_received is null then raise exception 'invalid_received'; end if;
  if p_due is null or p_due <= p_received then raise exception 'invalid_due'; end if;
  insert into public.data_requests
    (school_id, req_type, subject_label, requester_name, requester_contact,
     detail, received_at, due_at, created_by)
  values (v_school, p_req_type, btrim(p_subject_label), btrim(p_requester_name),
    nullif(btrim(p_requester_contact),''), nullif(btrim(p_detail),''),
    p_received, p_due, (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.pr_dsr_update(
  p_id uuid, p_status text, p_resolution_note text)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  v_school uuid := public.my_school_id();
begin
  if v_school is null or not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if p_status not in ('received','processing','done','rejected') then
    raise exception 'invalid_status';
  end if;
  if p_status in ('done','rejected')
     and (p_resolution_note is null or btrim(p_resolution_note) = '') then
    raise exception 'resolution_required';
  end if;
  update public.data_requests
    set status = p_status,
        resolution_note = coalesce(nullif(btrim(p_resolution_note),''), resolution_note),
        updated_at = now()
    where id = p_id and school_id = v_school;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.pr_tenant_guard() from public, anon;
revoke all on function public.pr_consent_add(uuid, text, text, text, boolean, text, text) from public, anon;
revoke all on function public.pr_consent_revoke(uuid) from public, anon;
revoke all on function public.pr_dsr_create(text, text, text, text, text, date, date) from public, anon;
revoke all on function public.pr_dsr_update(uuid, text, text) from public, anon;
grant execute on function public.pr_consent_add(uuid, text, text, text, boolean, text, text) to authenticated;
grant execute on function public.pr_consent_revoke(uuid) to authenticated;
grant execute on function public.pr_dsr_create(text, text, text, text, text, date, date) to authenticated;
grant execute on function public.pr_dsr_update(uuid, text, text) to authenticated;

revoke insert, update, delete on public.consent_records from authenticated;
revoke insert, update, delete on public.data_requests from authenticated;
