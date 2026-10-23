# External Review r31 - VERDICT: APPROVE_WITH_CHANGES -> 3/3 fixed

Pham vi: diff `6fefbd1..f71b37f` - r30 fixes (DC-06 TTS alias, save/gen
guards, answer extract) + `f71b37f` dashboard attendance count fix.

Kenh review: pinned `reviewer-gpt` (fallback theo runbook - Codex Cloud
khong kha dung). Static read-only review.

## Triage

| # | Sev | Finding | Trang thai |
|---|-----|---------|------------|
| 1 | M | save/gen exclusion bo lo nhanh async: `pending` het sau khi aiJob.start, `onDone` co the thay doc mid-save / gen khac ghi de job dang poll | FIXED - tat ca guards + disabled them `aiJob.job` (tool-runner.tsx:178,278,592,653) |
| 2 | M | `/dept/reports` cung pattern OFFSET-page attendance tren nhieu truong -> timeout risk | FIXED - RPC `scn_attendance_by_class_window` aggregate server-side |
| 3 | M | `/records/report` + `/records/students` tai toan bo lich su attendance/grades/conduct de aggregate | FIXED - 3 RPC aggregate (class attendance/conduct, student attendance); grades chunk `fetchAllRowsIn` + scope `academic_year_id` |

## Bug that bat duoc trong qua trinh fix

- `/records/report` **da broken ngam tren prod** (khong chi risk):
  `.in(student_id, ~360 uuid)` -> URL ~14KB > gioi han PostgREST ->
  fetch fail -> trang hien banner "Khong tai du du lieu nguon".
  Xac nhan bang Playwright prod truoc khi fix.
- `/school/dashboard` crash root cause xac nhan bang replay:
  `mustRows:attendance_records` - Postgres statement timeout tren
  fetchAllRows OFFSET pagination + join students!inner.

## Fix chi tiet

- Migration `20261213_r31_aggregates.sql` (da apply prod):
  - `scn_attendance_by_class_window(p_class_ids, p_from)` ->
    (class_id,total,present,absent)
  - `scn_class_conduct_counts(p_class_ids)` -> (class_id,violations)
  - `scn_attendance_by_student_window(p_student_ids, p_from)` ->
    (student_id,total,attended)
  - Tat ca `security invoker` + `stable` + `search_path=''` - RLS ap
    dung y het query thuong, fail-closed. Revoke anon/public, grant
    authenticated.
- `dept/reports`: fetchAllRows attendance -> 1 RPC call, map
  class->school qua `classSchool` san co.
- `records/report`: att+conduct -> RPC; grades -> `fetchAllRowsIn`
  (chunk 200 ids, fix URL bloat) + `.or(yearScope)` bound theo
  `academic_year_id` cua cac lop (giu NULL-legacy nhu gradeInYear).
- `records/students`: attendance -> `scn_attendance_by_student_window`.
- `tool-runner`: `generate`/`save` guard + disabled them `aiJob.job` -
  async poll gio cung tinh la busy.
- Test R6-04 cap nhat: RPC sources kiem `.error`, fetchAllRows sources
  giu `.error || .truncated` - semantics "khong nuot loi nguon" giu nguyen.

## Verify

- RPC truc tiep voi role bgh: class_att 12 rows ~1.2s, conduct ~150ms,
  student_att ~270ms; anon bi 42501 permission denied.
- Playwright dev (prod DB): `/records/report` render day du - 435 HS,
  12 lop, chuyen can 95.7%, 41 vi pham (truoc: chi banner loi);
  `/records/students` per-student % chinh xac; `/school/dashboard` OK
  0 console errors.
- tsc clean, lint 0 errors, 263/264 tests, consistency PASS.

## Loop

r31 la round 2 sau lo CR-050/051/052. Round tiep (r32) chay tren
artifact fix nay sau khi redeploy + prod re-verify 3 trang.
