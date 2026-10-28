-- CR-070: dieu dong GV gan timetable_entry - overlay phan cong lai TKB.
-- Giu nguyen teacher_id goc tren timetable_entries; dd_assignments la
-- overlay co hieu luc theo khoang ngay (auditable, dao nguoc duoc).

create or replace function public.dd_module_enabled(p_school uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select f.enabled from public.school_features f
  where f.school_id = p_school and f.module = 'dieu_dong'), true) $$;
revoke all on function public.dd_module_enabled(uuid) from public;
grant execute on function public.dd_module_enabled(uuid) to authenticated, anon;

create table public.dd_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  timetable_entry_id uuid not null references public.timetable_entries(id),
  teacher_id uuid not null references public.profiles(id),
  effective_from date not null,
  effective_to date,
  status text not null default 'pending'
    check (status in ('pending','active','ended','cancelled')),
  reason text not null,
  created_by uuid references public.profiles(id),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
alter table public.dd_assignments enable row level security;
create index dd_asn_entry on public.dd_assignments(timetable_entry_id, status);
create index dd_asn_teacher on public.dd_assignments(teacher_id, status);
create index dd_asn_school on public.dd_assignments(school_id, status);

-- tenant guard: entry (qua class) + teacher phai cung truong
create or replace function public.dd_tenant_guard() returns trigger
language plpgsql as $$
begin
  if not exists (
    select 1 from public.timetable_entries e join public.classes c on c.id = e.class_id
    where e.id = new.timetable_entry_id and c.school_id = new.school_id
  ) then raise exception 'cross_school_entry'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = new.teacher_id and p.school_id = new.school_id
      and (p.role = any(array['gvbm','gvcn','to_truong','bgh','pht']::text[])
           or p.concurrent_roles && array['gvbm','gvcn','to_truong','bgh','pht']::text[])
  ) then raise exception 'invalid_teacher'; end if;
  return new;
end $$;
create trigger dd_asn_tenant before insert or update on public.dd_assignments
  for each row execute function public.dd_tenant_guard();

create policy dd_asn_read on public.dd_assignments for select
  using (school_id = (select my_school_id())
    and (select public.dd_module_enabled(school_id))
    and ((select my_roles()) && array['bgh','admin','pht','to_truong','so_gd']::text[]
         or teacher_id = auth.uid()
         or ((select my_roles()) @> array['gvcn']::text[]
             and exists (select 1 from public.timetable_entries e
               join public.classes c on c.id = e.class_id
               where e.id = timetable_entry_id and c.gvcn_id = auth.uid()))));
grant select on public.dd_assignments to authenticated;
revoke insert, update, delete on public.dd_assignments from authenticated, anon;

-- overlap: khong cho 2 phan cong pending|active trung khoang ngay tren 1 entry.
-- Goi sau khi lock hang timetable_entries -> serialize theo entry.
create or replace function public.dd_assert_no_overlap(
  p_entry uuid, p_from date, p_to date, p_exclude uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.dd_assignments a
    where a.timetable_entry_id = p_entry
      and a.status in ('pending','active')
      and (p_exclude is null or a.id <> p_exclude)
      and a.effective_from <= coalesce(p_to, date '9999-12-31')
      and coalesce(a.effective_to, date '9999-12-31') >= p_from
  ) then raise exception 'overlapping_assignment'; end if;
end $$;

create or replace function public.dd_create(
  p_entry uuid, p_teacher uuid, p_from date, p_to date, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_entry_school uuid;
  v_id uuid;
begin
  if not ((select my_roles()) && array['bgh','admin','pht']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.dd_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  if p_from is null then raise exception 'invalid_date'; end if;
  if p_to is not null and p_to < p_from then raise exception 'invalid_date'; end if;
  if nullif(btrim(coalesce(p_reason,'')), '') is null then raise exception 'invalid_reason'; end if;

  -- Lock entry: serialize dd_create/dd_approve tren cung entry.
  select c.school_id into v_entry_school
    from public.timetable_entries e join public.classes c on c.id = e.class_id
    where e.id = p_entry for update of e;
  if not found or v_entry_school <> v_school then raise exception 'entry_not_found'; end if;

  perform public.dd_assert_no_overlap(p_entry, p_from, p_to);

  insert into public.dd_assignments
    (school_id, timetable_entry_id, teacher_id, effective_from, effective_to,
     status, reason, created_by)
  values (v_school, p_entry, p_teacher, p_from, p_to, 'pending',
          btrim(p_reason), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.dd_approve(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_a record;
begin
  if not ((select my_roles()) && array['bgh','admin','pht']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.dd_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  select * into v_a from public.dd_assignments
    where id = p_id and school_id = v_school for update;
  if not found then raise exception 'not_found'; end if;
  if v_a.status <> 'pending' then raise exception 'invalid_state'; end if;

  -- Recheck overlap luc duyet (co the da co active khac tu luc tao).
  perform public.dd_assert_no_overlap(
    v_a.timetable_entry_id, v_a.effective_from, v_a.effective_to, p_id);

  update public.dd_assignments
    set status = 'active', decided_by = auth.uid(), decided_at = now()
    where id = p_id;

  insert into public.notifications (profile_id, type, title, body, link)
  values (v_a.teacher_id, 'dieu_dong',
    'Bạn được phân công điều động',
    'Bạn được phân công dạy từ ' || to_char(v_a.effective_from, 'DD/MM/YYYY')
      || coalesce(' đến ' || to_char(v_a.effective_to, 'DD/MM/YYYY'), '') || '.',
    '/schedule/timetable');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.dd_end(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_status text;
begin
  if not ((select my_roles()) && array['bgh','admin','pht']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.dd_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  update public.dd_assignments
    set status = 'ended', ended_at = now(),
        -- Phan cong chua bat dau thi effective_to = effective_from (check >=).
        effective_to = greatest(effective_from,
          least(coalesce(effective_to, current_date), current_date))
    where id = p_id and school_id = v_school and status = 'active'
    returning status into v_status;
  if v_status is null then raise exception 'invalid_state'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.dd_cancel(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := (select my_school_id());
  v_status text;
begin
  if not ((select my_roles()) && array['bgh','admin','pht']::text[]) then
    raise exception 'forbidden';
  end if;
  if not (select public.dd_module_enabled(v_school)) then
    raise exception 'module_disabled';
  end if;
  update public.dd_assignments
    set status = 'cancelled'
    where id = p_id and school_id = v_school and status = 'pending'
    returning status into v_status;
  if v_status is null then raise exception 'invalid_state'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Consumer resolution: GV thuc te day entry vao ngay d.
-- r1: fail closed - cung tenant + module bat; khong leak phan cong cross-tenant.
create or replace function public.dd_effective_teacher(p_entry uuid, p_date date)
returns uuid language plpgsql stable security definer set search_path = public as
$$
declare
  v_school uuid;
begin
  select c.school_id into v_school
    from public.timetable_entries e
    join public.classes c on c.id = e.class_id
    where e.id = p_entry;
  if v_school is null
     or v_school is distinct from public.my_school_id()
     or not public.dd_module_enabled(v_school) then
    return null;
  end if;
  return coalesce(
    (select a.teacher_id from public.dd_assignments a
      where a.timetable_entry_id = p_entry and a.status = 'active'
        and a.effective_from <= p_date
        and coalesce(a.effective_to, date '9999-12-31') >= p_date
      order by a.decided_at desc limit 1),
    (select e.teacher_id from public.timetable_entries e where e.id = p_entry));
end $$;

revoke all on function public.dd_assert_no_overlap(uuid, date, date, uuid) from public, anon;
revoke all on function public.dd_create(uuid, uuid, date, date, text) from public, anon;
revoke all on function public.dd_approve(uuid) from public, anon;
revoke all on function public.dd_end(uuid) from public, anon;
revoke all on function public.dd_cancel(uuid) from public, anon;
grant execute on function public.dd_create(uuid, uuid, date, date, text) to authenticated;
grant execute on function public.dd_approve(uuid) to authenticated;
grant execute on function public.dd_end(uuid) to authenticated;
grant execute on function public.dd_cancel(uuid) to authenticated;
grant execute on function public.dd_effective_teacher(uuid, date) to authenticated;
