-- CR-069: hoc ba XML + ky so 2 cap (GVCN -> BGH).
-- XML + sha256 luu trong hb_exports; chu ky HMAC tinh o server action
-- (env secret); RPC chi gate role/module + state machine + audit.

create or replace function public.hb_module_enabled(p_school uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select f.enabled from public.school_features f
  where f.school_id = p_school and f.module = 'hoc_ba'), true) $$;
revoke all on function public.hb_module_enabled(uuid) from public;
grant execute on function public.hb_module_enabled(uuid) to authenticated, anon;

create table public.hb_exports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  student_id uuid not null references public.students(id),
  academic_year_id uuid not null references public.academic_years(id),
  xml text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'generated'
    check (status in ('generated','gvcn_signed','bgh_signed')),
  gvcn_sig text, gvcn_by uuid references public.profiles(id), gvcn_at timestamptz,
  bgh_sig text, bgh_by uuid references public.profiles(id), bgh_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, academic_year_id)
);
alter table public.hb_exports enable row level security;
create index hb_exp_school on public.hb_exports(school_id, academic_year_id);
create index hb_exp_student on public.hb_exports(student_id);

-- tenant guard: student phai cung truong
create or replace function public.hb_tenant_guard() returns trigger
language plpgsql as $$
begin
  if not exists (
    select 1 from public.students s join public.classes c on c.id = s.class_id
    where s.id = new.student_id and c.school_id = new.school_id
  ) then raise exception 'cross_school_student'; end if;
  return new;
end $$;
create trigger hb_exp_tenant before insert or update on public.hb_exports
  for each row execute function public.hb_tenant_guard();

create policy hb_exp_read on public.hb_exports for select
  using (school_id = (select my_school_id())
    and (select public.hb_module_enabled(school_id))
    and ((select my_roles()) && array['bgh','admin','so_gd']::text[]
         or ((select my_roles()) @> array['gvcn']::text[]
             and public.scn_student_in_my_homeroom(student_id))));
grant select on public.hb_exports to authenticated;
revoke insert, update, delete on public.hb_exports from authenticated, anon;

-- ===== hb_store: tao/ghi de XML khi chua ky BGH =====
create or replace function public.hb_store(
  p_student uuid, p_year uuid, p_xml text, p_sha text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_id uuid; v_status text;
begin
  if not ((select my_roles()) && array['bgh','admin']::text[]
          or ((select my_roles()) @> array['gvcn']::text[]
              and public.scn_student_in_my_homeroom(p_student))) then
    raise exception 'forbidden';
  end if;
  if not (select public.hb_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if p_xml is null or length(p_xml) < 100 then raise exception 'invalid_xml'; end if;
  if p_sha is null or p_sha !~ '^[0-9a-f]{64}$' then raise exception 'invalid_sha'; end if;

  select id, status into v_id, v_status from public.hb_exports
    where student_id = p_student and academic_year_id = p_year;
  if found and v_status = 'bgh_signed' then
    raise exception 'already_signed';
  end if;

  insert into public.hb_exports
    (school_id, student_id, academic_year_id, xml, sha256, status,
     gvcn_sig, gvcn_by, gvcn_at, bgh_sig, bgh_by, bgh_at, created_by)
  values (v_school, p_student, p_year, p_xml, p_sha, 'generated',
          null, null, null, null, null, null, auth.uid())
  on conflict (student_id, academic_year_id)
  do update set xml = excluded.xml, sha256 = excluded.sha256,
    status = 'generated',
    gvcn_sig = null, gvcn_by = null, gvcn_at = null,
    bgh_sig = null, bgh_by = null, bgh_at = null
  returning id into v_id;
  return jsonb_build_object('export_id', v_id);
end $$;

-- ===== hb_sign: ky so theo trinh tu gvcn -> bgh =====
create or replace function public.hb_sign(
  p_id uuid, p_role text, p_sig text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_exp record;
begin
  select e.* into v_exp from public.hb_exports e
    where e.id = p_id and e.school_id = v_school;
  if not found then raise exception 'export_not_found'; end if;
  if not (select public.hb_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if nullif(btrim(coalesce(p_sig,'')), '') is null then raise exception 'invalid_sig'; end if;

  if p_role = 'gvcn' then
    if not ((select my_roles()) @> array['gvcn']::text[]
            and public.scn_student_in_my_homeroom(v_exp.student_id)) then
      raise exception 'forbidden';
    end if;
    if v_exp.status <> 'generated' then raise exception 'invalid_state'; end if;
    update public.hb_exports
    set status = 'gvcn_signed', gvcn_sig = p_sig,
        gvcn_by = auth.uid(), gvcn_at = now()
    where id = p_id;
  elsif p_role = 'bgh' then
    if not ((select my_roles()) && array['bgh','admin']::text[]) then
      raise exception 'forbidden';
    end if;
    if v_exp.status <> 'gvcn_signed' then raise exception 'invalid_state'; end if;
    update public.hb_exports
    set status = 'bgh_signed', bgh_sig = p_sig,
        bgh_by = auth.uid(), bgh_at = now()
    where id = p_id;
  else
    raise exception 'invalid_role';
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.hb_store(uuid, uuid, text, text) from public, anon;
revoke all on function public.hb_sign(uuid, text, text) from public, anon;
grant execute on function public.hb_store(uuid, uuid, text, text) to authenticated;
grant execute on function public.hb_sign(uuid, text, text) to authenticated;
