-- CR-074: VNeID prep - subject identifier cho SSO vendor.
-- vneid_subject_id = OIDC `sub` claim vendor tra ve - KHAC national_id
-- (so dinh danh ca nhan tren giay to): sub la stable auth key, national_id
-- la du lieu ho so. Vendor sub la globally unique -> partial unique index.
-- Khong co write path authenticated: gan/link qua service role khi vendor
-- onboard (BACKLOG-CREDENTIALS); cot ke thua RLS cua bang me (read-only
-- theo role hien tai - khong mo them quyen ghi).

alter table public.students
  add column if not exists vneid_subject_id text;
alter table public.profiles
  add column if not exists vneid_subject_id text;

create unique index if not exists students_vneid_subject_uidx
  on public.students(vneid_subject_id) where vneid_subject_id is not null;
create unique index if not exists profiles_vneid_subject_uidx
  on public.profiles(vneid_subject_id) where vneid_subject_id is not null;
