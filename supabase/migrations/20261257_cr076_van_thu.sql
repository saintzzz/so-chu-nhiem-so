-- CR-076: van_thu - so cong van den/di cua truong.
-- Read: bgh|admin|pht|ke_toan cung truong + module bat (van thu co tai lieu
-- nhay cam - khong mo cho moi nhan vien). Write chi qua RPC bgh|admin.

create or replace function public.vt_module_enabled(p_school uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(
    (select enabled from public.school_features
      where school_id = p_school and module = 'van_thu'), true) $$;

create table public.vt_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  direction text not null check (direction in ('den','di')),
  doc_no text not null,
  doc_type text not null default 'cong_van'
    check (doc_type in ('cong_van','quyet_dinh','bao_cao','to_trinh','khac')),
  issued_date date not null,
  from_org text not null,
  to_org text,
  subject text not null,
  note text,
  status text not null default 'registered'
    check (status in ('registered','processing','done','archived')),
  handler_id uuid references public.profiles(id),
  deadline date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (school_id, direction, doc_no)
);
alter table public.vt_documents enable row level security;
create index vt_docs_school on public.vt_documents(school_id, direction, issued_date desc);

create or replace function public.vt_tenant_guard()
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
create trigger vt_docs_tenant before insert or update on public.vt_documents
  for each row execute function public.vt_tenant_guard();

create policy vt_docs_read on public.vt_documents for select to authenticated
  using (school_id = (select my_school_id())
    and public.vt_module_enabled(school_id)
    and ((select my_roles()) && array['bgh','admin','pht','ke_toan','so_gd']::text[]));
-- Khong co policy insert/update/delete -> write chi qua RPC.

create or replace function public.vt_create(
  p_direction text, p_doc_no text, p_doc_type text, p_issued date,
  p_from text, p_to text, p_subject text, p_note text,
  p_handler uuid, p_deadline date)
returns uuid language plpgsql security definer set search_path = public as
$$
declare
  v_school uuid := public.my_school_id();
  v_id uuid;
begin
  if v_school is null or not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not public.vt_module_enabled(v_school) then raise exception 'module_disabled'; end if;
  if p_direction not in ('den','di') then raise exception 'invalid_direction'; end if;
  if p_doc_type not in ('cong_van','quyet_dinh','bao_cao','to_trinh','khac') then
    raise exception 'invalid_type';
  end if;
  if p_doc_no is null or btrim(p_doc_no) = '' then raise exception 'invalid_doc_no'; end if;
  if p_issued is null then raise exception 'invalid_date'; end if;
  if p_from is null or btrim(p_from) = '' then raise exception 'invalid_org'; end if;
  if p_subject is null or btrim(p_subject) = '' then raise exception 'invalid_subject'; end if;
  if p_deadline is not null and p_deadline < p_issued then
    raise exception 'invalid_deadline';
  end if;
  if p_handler is not null and not exists
    (select 1 from public.profiles where id = p_handler and school_id = v_school) then
    raise exception 'invalid_handler';
  end if;
  insert into public.vt_documents
    (school_id, direction, doc_no, doc_type, issued_date, from_org, to_org,
     subject, note, handler_id, deadline, created_by)
  values (v_school, p_direction, btrim(p_doc_no), p_doc_type, p_issued,
    btrim(p_from), nullif(btrim(p_to),''), btrim(p_subject),
    nullif(btrim(p_note),''), p_handler, p_deadline, (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.vt_update(
  p_id uuid, p_status text, p_handler uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  v_school uuid := public.my_school_id();
begin
  if v_school is null or not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not public.vt_module_enabled(v_school) then raise exception 'module_disabled'; end if;
  if p_status not in ('registered','processing','done','archived') then
    raise exception 'invalid_status';
  end if;
  if p_handler is not null and not exists
    (select 1 from public.profiles where id = p_handler and school_id = v_school) then
    raise exception 'invalid_handler';
  end if;
  update public.vt_documents
    set status = p_status,
        handler_id = coalesce(p_handler, handler_id),
        note = coalesce(nullif(btrim(p_note),''), note),
        updated_at = now()
    where id = p_id and school_id = v_school;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.vt_create(text, text, text, date, text, text, text, text, uuid, date) from public, anon;
revoke all on function public.vt_update(uuid, text, uuid, text) from public, anon;
grant execute on function public.vt_create(text, text, text, date, text, text, text, text, uuid, date) to authenticated;
grant execute on function public.vt_update(uuid, text, uuid, text) to authenticated;

-- Khong co policy insert/update/delete + revoke DML -> write chi qua RPC.
revoke insert, update, delete on public.vt_documents from authenticated;
