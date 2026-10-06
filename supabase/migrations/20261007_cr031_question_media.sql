-- CR-031: cau hoi co hinh (figure spec SVG + upload anh)

alter table tvc.questions
  add column if not exists media jsonb not null default '[]'::jsonb;

create or replace view public.tvc_questions
with (security_invoker = true) as
select * from tvc.questions;

alter table tvc.materials
  add column if not exists media jsonb not null default '[]'::jsonb;

create or replace view public.tvc_materials
with (security_invoker = true) as
select * from tvc.materials;

insert into storage.buckets (id, name, public)
values ('tvc-media', 'tvc-media', true)
on conflict (id) do nothing;

create policy media_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tvc-media'
    and (storage.foldername(name))[1] = my_school_id()::text
    and my_role() in ('gvcn','gvbm','to_truong','bgh','admin')
  );
create policy media_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'tvc-media'
    and (storage.foldername(name))[1] = my_school_id()::text
    and my_role() in ('gvcn','gvbm','to_truong','bgh','admin')
  );

notify pgrst, 'reload schema';
