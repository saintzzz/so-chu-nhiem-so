# External Review r25 — Codex Cloud

- Commit review: `c908cbe0ae3f55a792238497797c15680394f4c9`
- Report goc: `docs/reviews/codex-r25-report.txt`
- Verdict: **NOT-CLEAN — 10 findings (1H/8M/1L)**

## Doc quan trong: findings = scanner false negatives

Round nay KHONG phat hien class moi. Ca 10 findings deu la instance cua 4
class da dong (unchecked-read, unbounded-read, cas-transition, coordination)
nam o cho gate cu khong nhin thay. Theo protocol "close the class, not the
finding" -> fix site VA sua scanner cho tung lo.

## Triage + remediation class-level

| # | Sev | Finding | Fix site | Scanner hole da dong |
|---|-----|---------|----------|----------------------|
| 1 | H | Same-owner email reclaim gui trung | `scn_announce_email_claim` -> token per-invocation (resume chi khi mang dung token); `email_complete` bat token | RPC redesign, migration `20261209_cr049_r25_fixes.sql` |
| 2 | M | Fulfill khong re-check `approved` | `scn_announce_fulfill` lock activity row + `status='approved'` trong txn | cung migration |
| 3 | M | Complete khong re-check quyen hien tai | `scn_announce_email_complete` goi `scn_can_announce_activity` | cung migration |
| 4 | M | `.from(e.table)` count bien loi thanh 0 | `dept/data/page.tsx` -> `must()` | QRE nhan moi dang `.from(`/`.rpc(`, khong chi literal |
| 5 | M | `{rows,truncated}` bo `error` fetchAllRows | `dept/reports/page.tsx` -> `mustRows` + attError throw | `fetchAllRows` khong con la SAFE_WRAP; `{rows,truncated}` thieu `error` van FAIL |
| 6 | M | `.in("school_id")` tren profiles So >1000 | `dept/reports/page.tsx` -> `fetchAllRows` + `mustRows` | `school_id` chi bound cho bang nho-per-school qua `.eq`; `.in` khong bao gio bound; them unique-key cols (`_key`/`_code`/`_token`) |
| 7 | M | `.update(patch)` status trong var | `referral-card` + `case-controls` CAS | statusish resolve qua decls/param-type/call-site; chain qua var (`let q = ...; q = q.eq`) |
| 8 | M | `await supabase.update()` expression statement | `notifications-client` check error + giu state | rule moi: DISCARDED-QUERY |
| 9 | M | `fetchAll`/`fetchAllRows` callback khong `.order` | `dept/usage` + `dept/schools` `.order("id")` | rule moi: PAGINATED-NO-ORDER |
| 10 | L | CAS predicate khong `.select()` verify | `submitActivity` `.select("id")` + zero-row error | CAS rule doi: can CA predicate LAN `.select()`; `// cas-ok:` exemption co chu dich |

## Surface phat sinh khi scanner manh hon (da fix het trong round nay)

- DISCARDED-QUERY: `tvc_audit_logs`/`tvc_generations`/`tvc_profiles`/`ai-quota`/
  storage cleanup -> bind error + `console.error` (best-effort, khong throw).
- Unbounded: `timetable_entries` (timetable), `teacher_subjects` (school/staff,
  assignment-suggest) -> `fetchAllRows` + `mustRows`.
- CAS: `updateSchoolKpi` nhan `expectedStatus`; `devin`/`devin-callback` fail-mark
  them `.select("id")` + verify; `self-assessment-form` CAS `status`.
- NO-ERR-BIND: `academics/analysis`, `attendance/tracking`, `school/students`
  -> `mustRows`.
- `cas-ok` documented exceptions: `tvc_questions.review_state`,
  `tvc_curriculum_standards` toggle + edit-upsert.

## Evidence

- `node scripts/check-reliability.mjs` -> PASS 4/4 (rules moi)
- `tests/reliability-scanner.test.mjs` -> 3/3 (fixture bad.ts: 8/8 patterns bi
  flag; good.ts: 0 hit; real src clean)
- `tests/r2-regression.test.mjs` -> 144/144
- `npx tsc --noEmit` -> 0 loi; `npm run lint` -> 0 errors
- `node scripts/check-consistency.mjs` -> ALL PASS
- Migration `20261209_cr049_r25_fixes.sql` da apply prod (Supabase MCP)
- Framework: scanner hardened da sync vao `PU_SDLC/vendor/scripts/`


