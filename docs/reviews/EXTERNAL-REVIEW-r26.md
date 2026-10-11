# External Review r26 — Codex Cloud

- Commit review: `ae0da3e` (r25 remediation)
- Verdict: **NOT-CLEAN — 14 findings (2H/10M/2L)**
- Raw report: extract lai tu Codex thread khi dispatch r27 (DOM virtualized,
  khong luu duoc luc doc).

## Doc quan trong: escalation sang class RLS tenant-consistency

Round nay Codex di sau hon scanner: 2 HIGH la lo hong **RLS khong kiem quan
he tenant** (gvcn tu duyet activity; announcement tron school A + class B).
Day la class moi khong the dong bang scanner TS - phai dong trong Postgres
(policy + trigger + RPC). Phan con lai la scanner false negatives tiep theo
(builder-var + `.in` cardinality).

## Triage + remediation class-level

| # | Sev | Finding | Fix | Vi tri |
|---|-----|---------|-----|--------|
| 1 | H | `act_upd` cho gvcn self-approve bat ky activity nao | Policy gvcn -> `scn_is_my_homeroom_class`; trigger `scn_activity_transition_guard` chan approved-transition boi non-bgh/pht/admin | migration `20261210_cr049_r26_fixes.sql` |
| 2 | H | `sendAnnouncement` + `ann_ins` khong kiem class/student thuoc truong | Action check class.school_id + gvcn==class.gvcn_id + student∈class; `ann_ins`/`ann_upd` WITH CHECK theo tung role | `parents/actions.ts` + migration |
| 3 | M | `activity_attendance` khong kiem student∈class cua activity | `scn_attendance_pair_ok` trong `aa_ins`/`aa_upd` WITH CHECK + action pre-check tra loi ro | migration + `activities/actions.ts` |
| 4 | M | Authorized caller goi thang `email_complete` gia ket qua | Marker RPCs -> **service-only** (revoke authenticated, grant service_role) + `p_actor` + `scn_can_announce_activity_for` authz lai phia DB | migration + `admin.rpc` trong action |
| 5 | M | Send xong + complete fail -> retry gui trung | **Deferred**: can delivery-outbox/stable delivery-id per recipient (design P-level, khong giai quyet bang claim token) | CR-deferred, ghi ro trong artifact |
| 6 | M | Retry email dung title/content activity hien tai (da sua) | Email doc tu **snapshot announcements** da persist (`ann.title/ann.content/ann.class_id`) | `activities/actions.ts` |
| 7 | M | Thua claim tra empty result gia | `emailPending: true` + UI hien "dang gui o phien khac" | action + `announce-list.tsx` |
| 8 | M | Builder-var queries nuot error | Scanner: resolve `let q = supabase.from(...)` + chain reassignments; `must()`/mustRows toan bo site | `check-reliability.mjs` + ~10 file |
| 9 | M | `.in("class_id"/"student_id")` bi coi la bound | Rule moi: `.in` **khong bao gio** bound (ca URL-length ~8KB); helper `fetchAllRowsIn` chunk 200 + paginate tung chunk | `fetch-all.ts` + scanner + 33 sites |
| 10 | M | Incident note-append ghi de status moi | `scn_incident_followup` them `p_expected` (CAS trong WHERE); drop signature cu khong CAS | migration + `safety/actions.ts` + `followup-list.tsx` |
| 11 | M | Daily-report upsert revert submitted->draft | Trigger `scn_daily_report_guard` + RPC `scn_save_daily_report` (SECURITY DEFINER tu kiem quyen gvcn/bgh-pht-admin; ON CONFLICT WHERE status='draft', row_count=0+row ton tai -> 'stale') | migration + `daily-report/actions.ts` |
| 12 | M | Message commit + notification fail -> retry tao tin trung | `{ committed: true, messageId }`; client xoa draft khi committed du notify fail; warning rieng | `parents/actions.ts`, `portal/parent/actions.ts`, `inbox-client.tsx`, `parent-actions.tsx` |
| 13 | L | Optimistic mark-read khong rollback khi promise reject | Catch rejected promise + remove optimistic id (ca `{error}` lan throw) | `inbox-client.tsx` |
| 14 | L | Audit pagination thieu unique ordering | `.order("created_at").order("id")` + `fetchAllRowsIn` | `register/audit/page.tsx` |

## Scanner holes da dong round nay

- `resolveCore` cho builder-var: `let q = supabase.from(...)` reassign qua
  `q = q.eq(...)` await sau van bi bat NO-ERR-BIND/DISCARDED-QUERY.
- `.in` khong bao gio bound (diem F9) - ke ca `.in("class_id")`, `.in("id")`.
- Ancestor walk: query ben trong callback `fetchAllRows`/`fetchAllRowsIn`/
  `fetchAll` la paginated theo dinh nghia -> tranh false positive (dashboard
  `let q` + reassign trong callback).
- Exemption `// bounded-ok: <ly do>` cho list .in nho theo cau truc
  (substitutes Set <=3 ids).
- Fixture cap nhat: good.ts co pager-callback-var + bounded-ok (0 hit);
  bad.ts co 12/12 patterns bi flag.

## Query-migration surface (33 sites `.in` -> fetchAllRowsIn)

Codemod `scripts/_codemod-r26.mjs` + sửa tay cho nhung cho codemod sai
(statement-boundary tren multiline `must()`): counseling x3, roster, signoff,
period-log x2, school/actions x2, daily-reports x2, radar, substitutes,
team/teachers, teacher-chat, timetable, attendance/daily, dashboard,
daily-digest, radar-sync, generate x2, inbox-client, parent-email x2,
appointments, register/actions, support/actions, studio/questions.

- Bang khong co `id`: `parent_students` order `(student_id,parent_id)`;
  `activity_attendance` order `(activity_id,student_id)`; `teacher_subjects`
  order `(teacher_id,subject_id)`; `daily_reports` `.eq(date)` + order `class_id`.
- Order khong duy nhat them `.order("id")` tiebreak; counseling_cases
  `created_at desc + id` + sort lai JS sau khi noi chunk.

## Deferred (thanh that, khong danh dau da fix)

- **F5 provider-level duplicate email**: `sendEmail` thanh cong nhung
  `email_complete` fail -> claim het han, retry gui lai toan batch. Can
  outbox/`digest_jobs`-style delivery table voi stable delivery_id per
  recipient + provider idempotency key. La design work (P3-style), se CR rieng.

## Evidence

- `node scripts/check-reliability.mjs` -> PASS 4/4
- `tests/reliability-scanner.test.mjs` -> 3/3 (bad 12/12 flag, good 0 hit, src clean)
- `node --test tests/*.test.mjs` -> 223 pass / 1 skip / 0 fail
- `npx tsc --noEmit` -> 0 loi; `npm run lint` -> 0 errors
- `node scripts/check-consistency.mjs` -> ALL PASS
- Migration `20261210_cr049_r26_fixes.sql` applied prod qua Supabase MCP
  (3 phan; verified `pg_proc` signatures + old overloads da drop)
- 6 stale guard assertions da cap nhat theo implementation moi (rename ->
  regex chat hon, khong noi long)
