# External Review - CR-057 scalability hardening

Reviewer: reviewer-gpt subagent (cross-model, read-only) - 2 rounds.
Scope: commit fcc5d7f artifacts (CR doc, alter-policies.sql, snapshot,
2 migration files, tests/cr057.test.mjs) + live-DB claims.

## Round 1 - REJECT (4 findings, all confirmed)

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| 1 | High | Migration prefix 20261025 replay truoc khi digest_outbox (20261124) + year_end_decisions (20261214) ton tai; 2 files cung version | FIXED - rename 20261224/20261225, test AC-57.2 enforce ordering |
| 2 | Med | AC-57.3 marked PASS thieu grades evidence + khong comparable means | PARTIAL - grades EXPLAIN added (48.7ms bitmap idx_grades_year); mean-comparison deferred 1 tuan (baseline khong do lai duoc post-hoc) |
| 3 | Med | Rollback chi cover policies, khong cover search_path/EXECUTE/indexes | FIXED - CR-057-rollback-part2.sql (24 drops, 4 RESET, 60 GRANT PUBLIC tu lint list, trgm ve public) |
| 4 | Med | Tests assert doc keywords thay vi acceptance conditions | FIXED - 7 tests: snapshot membership cua moi altered policy, ordering vs dependency files, rollback counts |

## Round 2 - 3/4 confirmed fixed

Residual duy nhat: F2 mean-time portion - adjudicated PARTIAL, tracked
la baseline-recorded follow-up (pg_stat means sau ~1 tuan traffic).

Status: loop dong - 0 Critical/High con lai, 1 Medium deferred co
tracking trong CR doc.
