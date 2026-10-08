-- CR-035/Codex: cleanup file mo coi khi insert lesson_plans that bai chay
-- tu browser client, nhung bucket 'lesson-plans' chi co INSERT + SELECT
-- policy nen remove() bi storage tu choi ngam -> file mo coi tich luy.
-- DELETE policy: scope truong (foldername[1]) + chi chu file (owner_id)
-- + file chua duoc lesson_plans nao tham chieu - sau khi nop, file la
-- bang chung duyet, khong cho xoa qua storage API (Codex R4+R5).
create policy "lp_files_delete_same_school" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lesson-plans'
    and (storage.foldername(name))[1] = (
      select school_id::text from public.profiles where id = auth.uid()
    )
    and owner_id = auth.uid()::text
    and not exists (
      select 1 from public.lesson_plans lp where lp.file_path = name
    )
  );
