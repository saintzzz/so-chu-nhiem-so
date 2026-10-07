-- CR-035: KHBD co cau truc theo CV 5512/CTGDPT 2018. content_json giu cau
-- truc section (muc tieu KT/NL/PC, thiet bi GV/HS, 4 hoat dong, dieu chinh);
-- cot `content` (text) van duoc ghi ban render phang de tuong thich view cu,
-- AI review va tim kiem. Nullable - plan cu khong can migrate data.
alter table public.lesson_plans
  add column if not exists content_json jsonb;
