-- CR-032: ho so giao vien day du + mon phu trach + to chuyen mon gan mon

alter table public.departments
  add column if not exists subject_ids uuid[] not null default '{}';

alter table public.profiles
  add column if not exists staff_code text,
  add column if not exists employment_type text
    check (employment_type in ('bien_che','hop_dong','thinh_giang') or employment_type is null),
  add column if not exists qualification text,
  add column if not exists concurrent_roles text[] not null default '{}';

create unique index if not exists profiles_staff_code_school
  on public.profiles (school_id, staff_code)
  where staff_code is not null;

notify pgrst, 'reload schema';
