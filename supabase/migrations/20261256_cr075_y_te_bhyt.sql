-- CR-075: y_te_bhyt - so suc khoe dinh ky + the BHYT hoc sinh.
-- Privacy: du lieu y te nhay cam - read bgh|admin|pht|ke_toan + gvcn lop chu
-- nhiem; write chi bgh|admin (nhan vien y te = persona admin/bgh quan ly).
-- Convention: module gate coalesce(true); RPC security definer + tenant check.

create or replace function public.yt_module_enabled(p_school uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(
    (select enabled from public.school_features
      where school_id = p_school and module = 'y_te_bhyt'), true) $$;

create table public.yt_health_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id),
  checked_at date not null default current_date,
  height_cm numeric(5,1) check (height_cm is null or height_cm between 30 and 250),
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 2 and 300),
  vision_left text,
  vision_right text,
  dental text,
  conclusion text,
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.yt_health_records enable row level security;
create index yt_health_school on public.yt_health_records(school_id, checked_at desc);
create index yt_health_student on public.yt_health_records(student_id, checked_at desc);

create table public.yt_bhyt_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  student_id uuid not null references public.students(id) on delete cascade,
  card_no text,
  kcbb_code text,
  valid_from date,
  valid_to date,
  status text not null default 'active'
    check (status in ('active','expired','missing')),
  note text,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz,
  unique (school_id, student_id)
);
alter table public.yt_bhyt_cards enable row level security;
create index yt_bhyt_school on public.yt_bhyt_cards(school_id);

-- Tenant guard: row.school_id phai bang truong cua caller (service bo qua)
-- VA bang truong cua lop HS (chan ca service-role import sai student).
create or replace function public.yt_tenant_guard()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  v_caller uuid := public.my_school_id();
  v_stu_school uuid;
begin
  if v_caller is not null and new.school_id is distinct from v_caller then
    raise exception 'cross_tenant';
  end if;
  select c.school_id into v_stu_school
    from public.students s join public.classes c on c.id = s.class_id
    where s.id = new.student_id;
  if v_stu_school is not null and new.school_id is distinct from v_stu_school then
    raise exception 'cross_tenant_student';
  end if;
  return new;
end $$;
create trigger yt_health_tenant before insert or update on public.yt_health_records
  for each row execute function public.yt_tenant_guard();
create trigger yt_bhyt_tenant before insert or update on public.yt_bhyt_cards
  for each row execute function public.yt_tenant_guard();

-- Read: cung truong + module bat +
--  - bgh/admin/ke_toan/so_gd: toan truong
--  - pht: chi HS thuoc campus minh phu trach (fail-closed khi chua phan campus)
--  - gvcn: HS thuoc lop chu nhiem cua minh
create or replace function public.yt_can_read(p_student uuid, p_school uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select p_school = (select my_school_id())
    and public.yt_module_enabled(p_school)
    and ((select my_roles()) && array['bgh','admin','ke_toan','so_gd']::text[]
         or (
           'pht' = any(my_roles())
           and exists (
             select 1 from public.students s
             join public.classes c on c.id = s.class_id
             join public.profiles pr on pr.id = (select auth.uid())
             where s.id = p_student and c.school_id = p_school
               and pr.campus_id is not null and c.campus_id = pr.campus_id))
         or exists (
           select 1 from public.students s
           join public.classes c on c.id = s.class_id
           where s.id = p_student and c.gvcn_id = (select auth.uid())
             and c.school_id = p_school)) $$;

create policy yt_health_read on public.yt_health_records for select to authenticated
  using (public.yt_can_read(student_id, school_id));
create policy yt_bhyt_read on public.yt_bhyt_cards for select to authenticated
  using (public.yt_can_read(student_id, school_id));
-- Khong co policy insert/update/delete + revoke DML -> write chi qua RPC.
revoke insert, update, delete on public.yt_health_records from authenticated;
revoke insert, update, delete on public.yt_bhyt_cards from authenticated;

-- Write RPCs: bgh|admin cung truong + module bat + HS cung truong.
create or replace function public.yt_upsert_health(
  p_student uuid, p_checked_at date, p_height numeric, p_weight numeric,
  p_vleft text, p_vright text, p_dental text, p_conclusion text, p_note text)
returns uuid language plpgsql security definer set search_path = public as
$$
declare
  v_school uuid := public.my_school_id();
  v_id uuid;
begin
  if v_school is null or not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not public.yt_module_enabled(v_school) then raise exception 'module_disabled'; end if;
  if not exists (select 1 from public.students s join public.classes c on c.id = s.class_id
    where s.id = p_student and c.school_id = v_school) then
    raise exception 'invalid_student';
  end if;
  insert into public.yt_health_records
    (school_id, student_id, academic_year_id, checked_at, height_cm, weight_kg,
     vision_left, vision_right, dental, conclusion, note, recorded_by)
  select v_school, p_student, c.academic_year_id, coalesce(p_checked_at, current_date),
    p_height, p_weight, nullif(btrim(p_vleft),''), nullif(btrim(p_vright),''),
    nullif(btrim(p_dental),''), nullif(btrim(p_conclusion),''), nullif(btrim(p_note),''),
    (select auth.uid())
  from public.classes c join public.students s on s.class_id = c.id
  where s.id = p_student
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.yt_upsert_bhyt(
  p_student uuid, p_card_no text, p_kcbb text,
  p_from date, p_to date, p_status text, p_note text)
returns uuid language plpgsql security definer set search_path = public as
$$
declare
  v_school uuid := public.my_school_id();
  v_id uuid;
begin
  if v_school is null or not ((select my_roles()) && array['bgh','admin']::text[]) then
    raise exception 'forbidden';
  end if;
  if not public.yt_module_enabled(v_school) then raise exception 'module_disabled'; end if;
  if p_status not in ('active','expired','missing') then raise exception 'invalid_status'; end if;
  if p_from is not null and p_to is not null and p_to < p_from then
    raise exception 'invalid_date';
  end if;
  if not exists (select 1 from public.students s join public.classes c on c.id = s.class_id
    where s.id = p_student and c.school_id = v_school) then
    raise exception 'invalid_student';
  end if;
  insert into public.yt_bhyt_cards
    (school_id, student_id, card_no, kcbb_code, valid_from, valid_to, status, note, updated_by, updated_at)
  values (v_school, p_student, nullif(btrim(p_card_no),''), nullif(btrim(p_kcbb),''),
    p_from, p_to, p_status, nullif(btrim(p_note),''), (select auth.uid()), now())
  on conflict (school_id, student_id) do update set
    card_no = excluded.card_no, kcbb_code = excluded.kcbb_code,
    valid_from = excluded.valid_from, valid_to = excluded.valid_to,
    status = excluded.status, note = excluded.note,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.yt_upsert_health(uuid, date, numeric, numeric, text, text, text, text, text) from public, anon;
revoke all on function public.yt_upsert_bhyt(uuid, text, text, date, date, text, text) from public, anon;
grant execute on function public.yt_upsert_health(uuid, date, numeric, numeric, text, text, text, text, text) to authenticated;
grant execute on function public.yt_upsert_bhyt(uuid, text, text, date, date, text, text) to authenticated;
