-- CR-035/Codex: cleanup file mo coi khi insert lesson_plans that bai chay
-- tu browser client, nhung bucket 'lesson-plans' chi co INSERT + SELECT
-- policy nen remove() bi storage tu choi ngam -> file mo coi tich luy.
-- Them DELETE policy: scope truong (foldername[1] = school_id) VA chi
-- chinh nguoi upload (owner_id) - GV cung truong khong xoa duoc file
-- cua nhau (Codex R4-P1).
create policy "lp_files_delete_same_school" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lesson-plans'
    and (storage.foldername(name))[1] = (
      select school_id::text from public.profiles where id = auth.uid()
    )
    and owner_id = auth.uid()::text
  );
