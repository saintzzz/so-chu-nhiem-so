-- CR-026: bieu mau ke hoach bai day (KHBD) cau hinh theo truong.
-- Ly do: Phu luc IV CV 5512 chi la tham khao, khong bat buoc -> nen tang phai
-- cho phep moi don vi cau hinh cau truc KHBD rieng (de an TVC360 Tang 2).

create table if not exists tvc.khbd_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade, -- null = mau he thong
  name text not null,
  -- [{name: "Khởi động", minutes: 5, hint: "..."}] - thu tu la thu tu hoat dong
  activities jsonb not null default '[]'::jsonb,
  include_review boolean not null default true,  -- muc "Dieu chinh sau bai day"
  include_signoff boolean not null default true, -- khoi ky duyet to truong/GV
  is_default boolean not null default false,
  created_by uuid references tvc.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table tvc.khbd_templates enable row level security;

create policy tvc_tpl_read on tvc.khbd_templates for select
  using (auth.uid() is not null and (school_id is null or school_id = my_school_id()));

create policy tvc_tpl_school_insert on tvc.khbd_templates for insert
  with check (school_id = my_school_id() and (select role from profiles where id = auth.uid()) in ('to_truong','bgh','admin'));

create policy tvc_tpl_school_update on tvc.khbd_templates for update
  using (school_id = my_school_id() and (select role from profiles where id = auth.uid()) in ('to_truong','bgh','admin'))
  with check (school_id = my_school_id() and (select role from profiles where id = auth.uid()) in ('to_truong','bgh','admin'));

create policy tvc_tpl_school_delete on tvc.khbd_templates for delete
  using (school_id = my_school_id() and (select role from profiles where id = auth.uid()) in ('to_truong','bgh','admin'));

-- View public (security_invoker de RLS tren bang base co hieu luc)
create or replace view public.tvc_khbd_templates
with (security_invoker = true) as
select * from tvc.khbd_templates;

grant select, insert, update, delete on public.tvc_khbd_templates to authenticated;

-- Mau he thong mac dinh: khung 4 hoat dong theo Phu luc IV CV 5512
insert into tvc.khbd_templates (school_id, name, activities, is_default)
values (
  null,
  'Khung 4 hoạt động (tham khảo Phụ lục IV - CV 5512)',
  '[
    {"name":"Khởi động","minutes":5,"hint":"Tạo tâm thế, kết nối kiến thức cũ với bài học mới."},
    {"name":"Khám phá","minutes":20,"hint":"Hình thành kiến thức mới, tổ chức HS tự học và hợp tác."},
    {"name":"Luyện tập","minutes":12,"hint":"Củng cố, vận dụng kiến thức vừa học vào bài tập."},
    {"name":"Vận dụng","minutes":8,"hint":"Vận dụng vào tình huống thực tiễn, phát triển năng lực."}
  ]'::jsonb,
  true
)
on conflict do nothing;
