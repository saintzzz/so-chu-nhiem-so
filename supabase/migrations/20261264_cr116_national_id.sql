-- CR-116-W3a: ma dinh danh nganh cho giao vien/can bo quan ly/nhan vien.
-- TT 42/2021/TT-BGDDT Dieu 10 + TT 26/2019: moi doi tuong quan ly tren
-- CSDL nganh GD&DT co 1 ma dinh danh duy nhat (toi da 20 ky tu), bat bien,
-- do he thong CSDL nganh cap - truong luu lai de dong bo/bao cao ve Bo.
-- students.national_id da co san tu truoc; profiles them cot tuong duong.

alter table public.profiles
  add column if not exists national_id text;

comment on column public.profiles.national_id is
  'Ma dinh danh nganh GD&DT (TT 42/2021, toi da 20 ky tu, do CSDL nganh cap).';

create index if not exists profiles_national_id_idx
  on public.profiles(national_id) where national_id is not null;
