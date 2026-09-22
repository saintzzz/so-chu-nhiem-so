-- 1) Giáo án đính kèm file
alter table public.lesson_plans
  add column if not exists file_path text,
  add column if not exists file_name text;

-- 2) Bucket private cho file giáo án, scope theo school_id trong path
insert into storage.buckets (id, name, public)
values ('lesson-plans', 'lesson-plans', false)
on conflict (id) do nothing;

create policy "lp_files_insert_same_school" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lesson-plans'
    and (storage.foldername(name))[1] = (
      select school_id::text from public.profiles where id = auth.uid()
    )
  );

create policy "lp_files_read_same_school" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lesson-plans'
    and (storage.foldername(name))[1] = (
      select school_id::text from public.profiles where id = auth.uid()
    )
  );

-- 3) Backfill students.positive_points từ conduct_records (đồng bộ 2 nguồn ghi)
update public.students s
set positive_points = coalesce(
  (select sum(cr.points) from public.conduct_records cr where cr.student_id = s.id),
  0
);
