-- CR-079: bua an/ban tru + equipment issues (mo rong CR-011 equipment).

-- Su co / bao tri thiet bi - workflow open->in_progress->resolved.
create table if not exists public.equipment_issues (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  reported_date date not null default current_date,
  kind text not null default 'hong'
    check (kind in ('hong','sua_chua','bao_tri','thay_the','khac')),
  description text not null,
  status text not null default 'open'
    check (status in ('open','in_progress','resolved','cancelled')),
  reported_by uuid,
  resolved_date date,
  resolution_note text,
  created_at timestamptz not null default now()
);
alter table public.equipment_issues enable row level security;
create policy ei_staff_read on public.equipment_issues for select using (
  school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','pht','ke_toan','admin','gvcn','gvbm','totruong']::text[]);
create policy ei_write on public.equipment_issues for all using (
  school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','pht','ke_toan','admin']::text[])
  with check (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','pht','ke_toan','admin']::text[]);
grant select, insert, update on public.equipment_issues to authenticated;

-- Thuc don ban tru theo ngay/buoi.
create table if not exists public.meal_menus (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  menu_date date not null,
  meal_type text not null default 'trua' check (meal_type in ('sang','trua','xe')),
  description text not null,
  allergen_notes text,             -- mon co gluten/dau phong/sua...
  supplier text,
  cost_per_portion numeric,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (school_id, menu_date, meal_type)
);
alter table public.meal_menus enable row level security;
create policy mm_staff_read on public.meal_menus for select using (
  school_id = (select my_school_id()));
create policy mm_write on public.meal_menus for all using (
  school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','pht','ke_toan','admin']::text[])
  with check (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','pht','ke_toan','admin']::text[]);
grant select, insert, update, delete on public.meal_menus to authenticated;

-- So suat an theo lop/ngay: planned (dang ky ban tru) vs actual (co mat).
create table if not exists public.meal_counts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  menu_date date not null,
  meal_type text not null default 'trua' check (meal_type in ('sang','trua','xe')),
  class_id uuid not null references public.classes(id) on delete cascade,
  planned_count int not null default 0 check (planned_count >= 0),
  actual_count int check (actual_count >= 0),
  note text,
  counted_by uuid,
  created_at timestamptz not null default now(),
  unique (class_id, menu_date, meal_type)
);
alter table public.meal_counts enable row level security;
create policy mc_staff_read on public.meal_counts for select using (
  school_id = (select my_school_id()));
create policy mc_write on public.meal_counts for all using (
  school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','pht','ke_toan','admin','gvcn']::text[])
  with check (school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','pht','ke_toan','admin','gvcn']::text[]);
grant select, insert, update, delete on public.meal_counts to authenticated;

-- Dang ky ban tru per HS (an/dang ky theo thang - quyet planned_count).
create table if not exists public.meal_registrations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  student_id uuid not null references public.students(id) on delete cascade,
  month int not null check (month between 1 and 12),
  year int not null,
  meal_type text not null default 'trua' check (meal_type in ('sang','trua','xe')),
  registered boolean not null default true,
  dietary_note text,               -- an chay/kieu an dac biet (khac allergy!)
  created_at timestamptz not null default now(),
  unique (student_id, year, month, meal_type)
);
alter table public.meal_registrations enable row level security;
create policy mr_staff_read on public.meal_registrations for select using (
  school_id = (select my_school_id())
    and (select my_roles()) && array['bgh','pht','ke_toan','admin']::text[]
      or scn_student_in_my_homeroom(student_id));
create policy mr_write on public.meal_registrations for all using (
  school_id = (select my_school_id())
    and ((select my_roles()) && array['bgh','admin','ke_toan']::text[]
      or scn_student_in_my_homeroom(student_id)))
  with check (school_id = (select my_school_id())
    and ((select my_roles()) && array['bgh','admin','ke_toan']::text[]
      or scn_student_in_my_homeroom(student_id)));
grant select, insert, update, delete on public.meal_registrations to authenticated;
