# EXTERNAL REVIEW r34 - CR-053 round 2 (post-fix re-review)

- Date: 2026-12-23
- Scope: commit `d483ba0` + worktree (r33 fixes applied) - full CR-053 file set
- Reviewer: OpenRouter `nvidia/nemotron-3-ultra-550b-a55b:free` via
  `scripts/lead-review-cr053.mjs` (round-2 prompt lists the r33 fixes and
  asks for verification + regression hunt)
- Raw transcript: `/tmp/scn-r34.txt` (session artifact; model emitted
  analysis-then-findings, no VERDICT line)

## Verdict (normalized)

APPROVE_WITH_CHANGES - zero blockers (`a`), 4 residual (`b`), 6 nitpicks (`c`).

## Findings and triage

| # | Sev | Finding | Triage |
|---|-----|---------|--------|
| 1 | c | STAGE_ORDER comment implies wrong spec order | FIXED - comment rewritten to say the order is a deterministic sort over mutually-exclusive stages |
| 2 | b | `hasPriorRetest` counted draft/submitted after_retest rows | FIXED - now counts only `approved`/`locked`. Dead-path in practice (stage prerequisites make the combination unreachable) but semantics are now correct |
| 3 | b | INSERT branch of trigger does not validate `status` | NOT-A-BUG - RLS `yed_gvcn_ins` WITH CHECK already forces `status in ('draft','submitted')` + `approved_by/at is null` + `reject_reason is null` + `giay_khen_note is null`; trigger depth>1 bypass is service_role/migration-only |
| 4 | c | staleCount ignores `exempt_subject_ids` | DEFER (design) - exempt ids are a decision field (GVCN input), not source data; the staleness check compares source-derived snapshot vs recomputation |
| 5 | b | saveYearEndDecision does not fail-fast on stage prerequisites | DEFER (design) - trigger enforces prerequisites atomically (raise exception -> user sees the real error); a pre-check would duplicate the guard |
| 6 | c | dec.kqrl null -> "Chua du du lieu" | NOT-A-BUG - approved/locked rows always carry kqrl; draft export shows the honest placeholder |
| 7 | b | Class-level export restricted to BGH | DEFER (design) - per-student export is available to GVCN of own class; bulk whole-class official transcript export is deliberately BGH-only (privacy surface). Revisit if CR spec clarifies |
| 8 | c | isOwnClass per-row worry | NOT-A-BUG - evaluated once per page render |
| 9 | b | createNextStage button role check | NOT-A-BUG - `verifyGvcnOwns` runs in the server action |
| 10 | c | unused tt22 helpers | NIT - shared helpers used elsewhere; harmless |
| 11 | b | loadBundleShared fetches all-year decisions | NOT-A-BUG - query already `.in("student_id", chunk)` scoped |
| 12 | - | (output truncated mid-list; remaining items were nits) | - |

## Follow-up commits

- `hasPriorRetest` approved/locked-only + STAGE_ORDER comment fix
  (same commit as this artifact).

## Gates after round 2

- `tsc --noEmit`: PASS
- `node --test tests/tt22-year-end.test.mjs`: 29/29
- `node --test tests/*.test.mjs`: 293 pass / 1 skip / 0 fail
- `scripts/check-reliability.mjs`: PASS (all 4)
- `scripts/check-consistency.mjs`: PASS
- build: PASS
