# CR-049: Deferred Backlog Sweep (tu External Review Loop r16-r4)

- **Status**: APPROVED - user duyet "lam het" (2026-10-11)
- **Nguon**: tat ca muc deferred co design trong `docs/reviews/EXTERNAL-REVIEW-r16.md` + r3/r4
- **Ly do lam 1 CR gop**: cung nguon goc (review loop), cung muc tieu dong backlog security/scale

## Scope

### P1 - Bounded fixes
1. Timetable unique constraints: verify + them partial unique `(class_id,weekday,period)` + `(teacher_id,weekday,period)` cho active entries
2. `check-consistency` phan trang khi doc `attendance_records` (timeout tren prod)
3. `tvc.profiles` role mirror: `sync_tvc_profile` UPDATE path cap nhat `tvc.profiles.role` theo `profiles.role` moi, gan `former` khi het staff
4. Multi-role sweep: policies con check `role = 'x'` don -> `my_roles() && array[...]` (PHT kiem GVBM edge cases)

### P2 - Schema + logic
5. Grade stale-write: `grades.updated_at` + CAS trong `scn_save_grades` (expected rev hoac lock (class,subject,term)); UI bao conflict
6. `grades.academic_year` + uniqueness + transcript filter theo nam hoc
7. TT22 provisional/final: `term_result.is_final` chi khi du cot diem bat buoc

### P3 - Architectural (deferred tu r16 vi la thay doi kien truc)
8. Org-scoped dept RLS: `scn_my_org_school_ids()` = subtree org_units; truong `org_unit_id IS NULL` chi thuoc scope cua actor org ROOT (So) - Phong khong thay. Sweep policies `scn_is_dept()` -> org-scoped
9. AI PII minimization: `aiMinimize()` trung tam redact ho ten/NS/SDT truoc provider call (tenant opt-in + DPIA note)
10. AI quota: `ai_budget(user_id, school_id, day)` atomic decrement RPC + concurrency limit
11. Parent-digest durable outbox: `digest_jobs(status, lease_until)` claim `FOR UPDATE SKIP LOCKED`

## Impact assessment

- **Schema**: +3 bang (ai_budget, digest_jobs), +cot (grades.updated_at, grades.academic_year, term_result.is_final), +constraints timetable, ~60 policy rewrites
- **Rui ro**: dept RLS sweep la thay doi quyen truy cap lon nhat - co the "mat" du lieu voi user dept nam ngoai org (fail closed = dung, nhung can smoke test so_gd van thay du truong can). Grade CAS co the bao conflict voi editor cu -> UI phai handle. Digest outbox doi runtime path - giu fallback scan cu trong qua trinh chuyen
- **Verify**: moi package = smoke test prod claims + E2E regression 17 checks

## Quyet dinh semantics (da chon, co the sua neu user khac y)

- Truong `org_unit_id IS NULL` (TH Kim Dong): chi So GD (org root) + admin thay; Phong KHONG thay -> fail closed dung huong
- `tvc.profiles.role`: mirror theo `profiles.role` (giao_vien/kiem_duyet/admin), `former` khi khong con staff
- Grade CAS: optimistic `rev` int, mismatch -> error `stale_write` + UI reload
- TT22 final: du (GK + CK) cho mon cham diem; mon danh gia nhan xet: du cot danh gia

## Trang thai implement (2026-10-11)

| P | Muc | Trang thai | Verify |
|---|-----|-----------|--------|
| P1a | Timetable uniques | DA CO tren prod (`timetable_entries_class_id_weekday_period_key`, `uq_timetable_teacher_slot`) | query prod |
| P1b | checker keyset+scoped | DONE - 16.6s (truoc timeout) | run local |
| P1c | tvc.profiles mirror | DONE - `sync_tvc_profile` mirror `profiles.role`+concurrent | prod def + trigger test |
| P1d | multi-role sweep | DONE - DB sach; fix concurrent-bgh notification query | grep + code |
| P2a | Grade CAS | DONE - `scn_save_grades(...,p_expected_max)` raise `stale_write`; editor gui max(updated_at) | prod smoke stale+fresh |
| P2b | grades.academic_year_id | DONE - cot + populate tu class; hoc-ba filter theo class year | prod def |
| P2c | TT22 provisional | DONE - `semesterAssessment` + dau `*` tam tinh + footnote | typecheck |
| P3a | Org-scoped dept RLS | DONE - 12 scope helpers + 55/55 policies swept | PostgREST: so_gd=3 truong, ubnd=2 (Kim Dong an) |
| P3b | AI PII minimization | DONE - `ai-privacy.ts` (redactPiiText + pseudonymizeNames); redact trung tam trong `generateTextDetailed` + `respondWithAi`; `assignment-suggest` alias GVxx; `extract-records` opt-out co kiem soat | 12 tests `tests/cr049-pii.test.mjs` |
| P3c | AI quota | DONE - `ai_budgets`/`ai_usage_counters`/`ai_usage` + `scn_ai_quota_take` (atomic per-scope counter, cap=min budgets match) + `scn_ai_record_usage`; wired `respondWithAi` + 5 direct routes + 2 studio routes | prod: cap=2 block call 3 + ghi `budget_block` |
| P3d | Digest outbox | DONE - `digest_outbox` + claim (SKIP LOCKED) + requeue (stale sending/failed); cron route tach `?phase=enqueue\|send\|all`, body snapshot, deadline 240s | prod: claim->sending->requeue->queued |

### Migration files

- `20261121_cr049_org_scope_rls.sql` - 12 helpers + 55 policies (quals generated tu prod)
- `20261122_cr049_profile_grades.sql` - grades.academic_year_id + sync_tvc_profile mirror + scn_save_grades CAS
- `20261123_cr049_ai_quota.sql` - budgets/counters/usage + 2 RPC + default budgets (global 2000/school 300/user 60 per ngay)
- `20261124_cr049_digest_outbox.sql` - outbox table + claim/requeue RPC

### Con lai

- [ ] build + commit + deploy + Studio E2E 17 checks
- [ ] pg_cron schedule cho `?phase=send` lap lai (neu can drain queue >240s) - hien route tu dung khi het deadline, cron weekly mac dinh `all` van dung
- [ ] smoke test digest outbox end-to-end (cron route that)

## r27 deferred (2026-10-12)

- **Chunk pagination snapshot (r27 F2, MEDIUM - deferred with design)**: `fetchAllRowsIn` doc tung chunk qua PostgREST nen khong co snapshot nguyen tu - row doi nhom (class_id A -> B) giua 2 chunk co the bi bo sot/doc trung. Site bi flag: `activities/announce/page.tsx` (BGH dept >200 lop). Khong the fix bang ordering/keyset vi van de la read-time isolation, khong phai cursor. Design options: (a) RPC doc toan bo ket qua trong 1 transaction/snapshot cho cac listing correctness-critical; (b) bracket bang revision (updated_at/seq) + retry khi revision doi; (c) chap nhan cho listing low-stakes. De quyet dinh theo muc do critical cua tung site - hien danh sach hoat dong thieu 1 row chi la UX, khong anh huong ghi du lieu.
- **Notification provenance day du (r27 F5 phan con lai)**: da chan link ngoai + type whitelist cho PH/HS. Staff van gia duoc notification type he thong cho staff khac cung truong (khong phishing duoc vi link bi gioi han noi bo). Fix day du: cot source_entity/provenance + tao notification type he thong chi qua RPC security definer.
