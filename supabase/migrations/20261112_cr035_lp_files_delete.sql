-- CR-035/Codex: cleanup file mo coi khi insert lesson_plans that bai chay
-- tu browser client, nhung bucket 'lesson-plans' chi co INSERT + SELECT
-- policy nen remove() bi storage tu choi ngam -> file mo coi tich luy.
-- Them DELETE policy scope theo school (foldername[1] = school_id), giong
-- 2 policy insert/read da co trong 20260922_cr009_lesson_plan_files.sql.
create policy "lp_files_delete_same_school" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lesson-plans'
    and (storage.foldername(name))[1] = (
      select school_id::text from public.profiles where id = auth.uid()
    )
  );
