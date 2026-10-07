# External Review - Round 3

- Reviewer: GPT (Devin pinned reviewer-gpt), read-only, whole-repo on `5cdabee`.
- Scope: source, structure, security/RBAC, performance, UI/UX.
- Prior artifacts: `docs/reviews/EXTERNAL-REVIEW-r2.md`, `docs/project/CR-034-codex-remediation.md`.

## Findings

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Medium | Approve without substitute = dead end: controls only render for pending; decide action only updates pending | Fixed - `assignSubstitute` action (bgh/pht, approved+null guard, teacher-role allowlist, zero-row check, notifies assigned teacher) |
| 2 | Medium | Substitute notifications link teachers to `/school/substitutes` (bgh/pht only) - click redirects away | Fixed - `subNotificationLink`: teachers get `/schedule/period-log?date=...`, approvers keep queue link |
| 3 | Medium | Conduct evaluation initialized `rating: "tot"` for unevaluated students; save upserted whole roster | Fixed - blank "Chưa đánh giá" state, save writes only explicit ratings |

## Re-review pass

- Lead review rejected once more: `assignSubstitute` lacked teacher-role allowlist (same-school non-teacher assignable). Fixed via `TEACHER_LINK_ROLES` check + regression assertion. Final gate: **SIGNOFF**.

## Gates

- `npx tsc --noEmit` PASS; `npm run lint` 0 errors (101 pre-existing warnings); `node scripts/check-consistency.mjs` PASS; `npm run build` PASS (125 routes); `tests/r2-regression.test.mjs` 25/25; `tests/r2-db.test.mjs` 25/25 on real Postgres (docker fixture).

## Production

- Migration `20261105_r2_security_fixes.sql` applied to Supabase prod; pg_policies + triggers verified (msg_send/msg_read_update+immutability, subr_ins/upd+transition guard, pl_/pa_ substitute scoping, PHT fail-closed helpers).
- Deploys: `5cdabee` (R2 remediation) READY; `d1028c0` (R3 remediation) pushed.
- Playwright prod smoke: login bgh/gvcn OK, dashboards render real data (92.4% attendance), period-log renders, RBAC denial OK, mobile 375px no overflow, 0 console errors.

## Known accepted/deferred (unchanged)

- 3 AI endpoints keep sending student data to providers - owner decision, documented in `docs/project/DPIA-v1-tvc-scn.md`. Not resolved, not silently dropped.
- CR-034 deferred items remain (record lock triggers, transactional period-log RPC, etc.).
