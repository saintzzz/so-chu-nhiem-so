# External Review Loop - Round r16 (Codex Cloud, primary channel)

- **Reviewer**: ChatGPT Codex Cloud (`saintzzz/so-chu-nhiem-so`, env `so-chu-nhiem-so`) qua browser/Playwright - dung dung primary channel cua `PU_SDLC/EXTERNAL_REVIEW_LOOP.md`.
- **Scope**: whole-repo static review (source + migrations + docs). Codex xac nhan snapshot local `7fdcc476`, supplemented canonical `7b5d969` qua GitHub read-only API (fetch proxy trong env cua Codex fail nen khong checkout duoc - delta da duoc Codex verify qua API).
- **Raw report**: `docs/reviews/codex-cloud-report-r16-raw.txt` (37 findings + structural note).
- **Result**: 1 Critical + 13 High actionable -> **14 confirmed items da fix** (migration `20261118_r16_security_fixes.sql` + 16 file code), 8 findings deferred co design, phan con lai partial/khong confirmed.

## Triage table

| # | Sev | Finding | Quyet dinh |
|---|-----|---------|------------|
| 1 | CRITICAL | `profiles_no_priv_escalation`: bgh/so_gd tu doi role/school_id -> tu phong admin | **FIXED** R16-01: chi `admin` (role set) doi duoc cac cot quyen qua non-service call; service role giu nguyen cho user-management. |
| 2 | High | `scn_is_dept()` khong check org_unit -> dept doc moi truong | **DEFERRED+design**: 60 policies dung helper nay; can `scn_my_org_school_ids()` (subtree org_units) + sweep per-table + quyet dinh semantics cho truong chua gan org (prod co 1 truong `org_unit_id IS NULL`). Rui ro doi 60 policies trong 1 release khong kiem chung duoc -> tach thanh CR rieng (xem muc Defer). |
| 3 | High | Storage lesson-plans: prefix truong = PH/HS doc duoc file GV | **FIXED** R16-02: ca 2 SELECT + 2 INSERT policies them staff-role check. |
| 4 | High | `is_staff()` ke ca `ke_toan` -> doc ho so hanh kiem/nang luc | **FIXED** R16-03: `scn_is_edu_staff()` moi, swap tren 6 read policies nhay cam. |
| 5 | High | `period_absences` khong bind student vao lop cua log | **FIXED** R16-04: insert/update policy `exists(student.class = entry.class)`. |
| 6 | High | Service-role writers thieu tenant validation (createStaff campus/dept; timetable teacher/subject) | **FIXED code**: `school/actions.ts` validate campus_id/department_id thuoc truong truoc khi service-role write; timetable validate subject+teacher cung truong. |
| 7 | High | Question owner doi `school_id`/`review_state` tuy y | **FIXED** R16-05: trigger `tvc.guard_question_update` - owner/school immutable, review_state chi reviewer-role, sua noi dung -> `unreviewed`. |
| 8 | Medium | Feature-deny khong nhat quan (gen-questions, studio-print, questions page) | **FIXED code**: gen-questions gate `studio.ai`+`studio.questions`; studio-print gate `studio`+`studio.export`; questions page gate `studio.questions`. |
| 9 | Medium | `sync_tvc_profile` SQL thieu trong repo (khong reviewable) | **FIXED** R16-08: da commit dinh nghia dang chay tren prod vao migration. |
| 10 | Medium | Quyen TVC song sot sau khi mat SCN staff role | **FIXED** R16-08: demotion -> `tvc.profiles.role='former'` (giu FK, mat quyen); trigger chi ban khi cot lien quan doi. |
| 11 | High | Sua duoc noi dung da duyet/xuat ban ma khong invalidate approval | **FIXED** R16-06: `tvc.guard_material_update` - sua content/title khi `in_review/totruong_ok/published` -> demote `personal` + xoa review_note. |
| 12 | High | Review transitions race; BGH bo qua totruong_ok | **FIXED** R16-07: `tvc.review_material` FOR UPDATE + CAS (`and status=...`) + chain personal->in_review->totruong_ok->published (BGH duyet thay layer 1 duoc ghi chu vao review note). |
| 13 | High | Review RPC NULL-tenant fail-open + thieu feature/ACL | **FIXED** R16-07: `m.school_id IS DISTINCT FROM my_school_id()` (NULL bi chan), `scn_has_feature('studio.review')`, `scn_item_denied`, auth check, decision allowlist. |
| 14 | High | PII hoc sinh gui ra external AI chua co minimization tap trung | **DEFERRED+design**: can lop minimization/allowlist-processor trung tam (DPIA). Da giam thieu: `AI_ALLOWED_PROVIDERS` gio ap cho ca TTS + Devin fallback (#15). |
| 15 | High | Provider allowlist khong phu Devin/TTS/custom endpoint | **FIXED code**: `aiProviderAllowed()` dung chung - Devin can 'devin' trong allowlist, TTS can 'openai'; `AI_ALLOWED_ENDPOINTS` khoa host cho OPENAI_BASE_URL (ngoai list -> api.openai.com). |
| 16 | High | AI endpoints thieu tenant/user quota + concurrency limit | **DEFERRED+design**: can durable job/budget infra (Postgres counters + idempotency). Giam thieu: race abort losers + `maxTotalMs` cat chuoi retry vo han. |
| 17 | High | Race dot quota, losers chay tiep, malformed output nhanh thang | **FIXED code**: stagger 1.2s giua cac racer, AbortController huy losers that, `opts.validate` bat first-VALID (generateDoc truyen JSON-extract check), `maxTotalMs` tong budget. |
| 18 | Medium | Race tra loi nondeterministic, deadline khong bi rang | **FIXED code**: `sawQuota` precedence (bat ky quota -> tra quota de fallback), deadline tong chan ca race wait lan sequential retry. |
| 19 | Medium | devin-callback tu choi array trong khi 2 job kind doi array; session fetch khong timeout | **FIXED code**: validate shape theo `kind` (ARRAY_KINDS = suggest-tasks, tvc-question-extract); `createDevinSession` co AbortSignal.timeout(20s). |
| 20 | Medium | Callback destination suy tu forwarded headers | **FIXED code**: chi DEVIN_CALLBACK_URL/NEXT_PUBLIC_APP_URL (bat buoc https, tru localhost); header-derived chi chap nhan loopback. |
| 21 | Medium | AI routes tin TS casts thay vi runtime validation | **FIXED code**: report-analysis (shape + bounds), advisor (typeof + 2000 chars), studio generate (coerce Record<string,string> + 4000 chars/field). |
| 22 | High | Luu period log = 4 request client, khong atomic | **FIXED** R16-14 + code: `scn_save_period_log` RPC 1 transaction (upsert log + replace absences + sync); `period-log-board.tsx` goi RPC. |
| 23 | High | Derived attendance forge/xoa qua sync khong validate | **FIXED** R16-09: `scn_sync_period_attendance` SECURITY DEFINER + authz (GVCN/GV day tiet/day thay/BGH+) + student_ids giao lop + advisory lock; dong branch `source='period_log'` trong att_ins/upd/del. |
| 24 | Medium | Manual confirm giu `source='period_log'` -> sync ghi de | **FIXED** R16-10: `scn_save_attendance` upsert `source='manual'`; sync chi dong/xoa row period_log. |
| 25 | High | Grade snapshot overwrite khong stale-write protection | **DEFERRED+design**: can revision/lock (optimistic `updated_at` CAS hoac gradebook lock theo lop-mon-ky). Rui ro pha editor flow -> CR rieng. |
| 26 | Medium | Grade keys/transcript khong phan biet nam hoc | **DEFERRED+design**: them academic_year vao grade identity = schema + data migration + doc lai transcript logic. |
| 27 | Medium | `entered_by` lay tu payload -> mao danh | **FIXED** R16-11: `auth.uid()` server-side. |
| 28 | Medium | TT22 averages provisional khong phan biet final | **DEFERRED+design**: can trang thai finalized theo quy tac danh gia du kien TT22 (can du cot diem thanh phan). |
| 29 | Medium | Timetable collision check-then-write race | **PARTIAL**: app validate subject/teacher tenancy (#6); DB unique constraint cho (class,weekday,period)/(teacher,...) can verify tren prod - de trong backlog verify. |
| 30 | Medium | Multi-role scope khong nhat quan (primary vs concurrent) | **DEFERRED**: can centralize `my_roles()` cho moi policy con check primary role - sweep rieng. |
| 31 | Medium | KHBD default non-atomic -> 0 hoac 2 default | **FIXED** R16-12 + code: unique partial index + `scn_khbd_set_default` atomic; action goi RPC sau khi luu. |
| 32 | High | dept-brief keo raw students+attendance ve app (vuot 100k cap) | **FIXED** R16-15 + code: `scn_dept_brief_stats` aggregate trong SQL; route chi nhan per-school counts. |
| 33 | Medium | Unpaginated queries lam AI advice/radar thieu du lieu | **PARTIAL**: dept-brief da chuyen aggregate; advisor/daily-digest/radar can keyset + aggregate - de trong CR phan trang. |
| 34 | High | parent-digest scan tu dau, starvation + 300s budget | **DEFERRED+design**: durable outbox (claim-lease-retry) + tach recipient selection khoi email send. R16-13 unique index da chan dup send. |
| 35 | Medium | digest delivery khong idempotent | **PARTIAL FIXED** R16-13: unique `(parent_id, week_start)` + dedupe data cu; atomic claim nam trong design #34. |
| 36 | Medium | Question bank keo toan bo bank ve client + offset pagination khong on dinh | **FIXED code**: `searchQuestions` server-side filter + keyset `(created_at,id)`; UI "Xem them 100 cau"; SSR trang 1 scope theo dept khi reviewer default mydept. |
| 37 | Medium | Exam assembly: filter sau limit + serial per-cell queries | **FIXED code**: 1 fetch `.overlaps(standard_ids)` + DB-level review_state filter truoc khi sample; per-cell filter tren bank nap san. |

## Ket qua gate + verify

- `tsc --noEmit` sach, `eslint` 0 errors, `next build` thanh cong, `check-consistency` all PASS.
- Migration `20261118_r16` da apply tren prod (verify bang pg_proc/pg_trigger/pg_indexes) + RPC flag `tvc.review_rpc` co mat trong ca `review_material` lan `submit_material_review`.
- Smoke test guard tren prod: UPDATE `tvc.questions.school_id` -> raise "Khong the thay doi chu so huu..."; UPDATE `tvc.materials.status` ngoai RPC -> raise "Trang thai hoc lieu chi thay doi qua quy trinh duyet". (Rollback-safe test.)
- E2E hoi quy: `scripts/qa-studio-e2e.mjs` chay lai sau deploy de xac nhan luong submit->duyet->publish van xanh qua cac guard moi.

## Deferred - design summary (khong duoc coi la da fix)

1. **#2 Org-scoped dept RLS** (High): tao `scn_my_org_school_ids()` = subtree `org_units` tu `profiles.org_unit_id` (admin = all; so_gd/ubnd thieu org -> fail closed). Sweep 60 policies dung `scn_is_dept()` thanh `school_id in (scn_my_org_school_ids())`. Can quyet dinh semantics: truong `org_unit_id IS NULL` thuoc pham vi So hay khong (hien prod co TH Kim Dong chua gan). CR rieng + E2E tung bang.
2. **#14 AI PII minimization** (High): lop `aiMinimize(text, ctx)` trung tam truoc moi provider call - redact ho ten/SDT/ngay sinh bang map token tam, restore sau response; extract-records/counseling-summary danh sach processor duoc duyet rieng (tenant opt-in). Ghi vao DPIA.
3. **#16 AI budget/quota** (High): `ai_budget` per (user,school,day) atomic decrement + concurrency slots; durable `ai_jobs` cho generation dai co idempotency key.
4. **#25 Grade stale-write** (High): `grades` them `updated_at`/`rev`; `scn_save_grades` nhan expected rev hoac gradebook lock `(class,subject,term)`; UI bao conflict reload.
5. **#26 Academic-year scope** (Medium): `grades.academic_year` + uniqueness + transcript filter theo enrollment year; migrate du lieu cu.
6. **#28 TT22 provisional/final** (Medium): `term_result.is_final` chi set khi du cot diem bat buoc theo TT22; UI hien "tinh tam" vs "chot".
7. **#30 Multi-role centralization** (Medium): sweep policies con `.eq('role',...)` -> `my_roles() && ...`; ung voi pht concurrent edge cases (radar, digest).
8. **#33/#34 Pagination + durable digest** (High): keyset cho advisor/digest/radar; parent-digest outbox `digest_jobs(status, lease_until)` claim `FOR UPDATE SKIP LOCKED` + batch send; R16-13 unique index da chan dup tam thoi.
9. **#29 Timetable constraints** (verify): confirm unique (class_id,weekday,period) + (teacher_id,weekday,period) tren prod; neu thieu -> partial unique + RPC save-atomically.
10. **(Backlog)** `check-consistency` timeout tren `attendance_records` prod-size -> phan trang checker.

## Loop status

- **Round r16**: 14 confirmed Critical/High -> da fix het ngoai tru #2/#14/#16/#25/#34 (deferred co design - 3 High la thay doi kien truc/durable infra, khong the patch nong khong pha prod).
- **Next**: commit + deploy -> gui Codex **r2** tren revision moi theo runbook (loop toi clean hoac 3 rounds).
