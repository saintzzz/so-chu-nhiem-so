# External Review - CR-063 Cong tuyen sinh cong khai

Reviewer: reviewer-gpt (cross-model). Scope: commit 8252025 + fixes.

## Round 1 (REJECT) - 2H + 3M
| # | Sev | Finding | Triage | Fix |
|---|-----|---------|--------|-----|
| 1 | H | tracking_code 16^6 brute-force duoc, khong rate limit | Confirm | TS+10 base32 (~1.1e15) |
| 2 | H | Turnstile fail-open khi thieu token, khong rate limit | Confirm | fail-closed + 10/gio/ip_hash |
| 3 | M | tracking collision khong retry | Confirm | retry loop max 5 |
| 4 | M | /apply/* indexable | Confirm | noindex meta + header |
| 5 | M | campaign_info lo ten draft/closed | Confirm | chi tra name khi open |

## Round 2 (REJECT) - 2H
| # | Sev | Finding | Triage | Fix |
|---|-----|---------|--------|-----|
| 1 | H | p_ip_hash=null bypass - anon goi RPC truc tiep | Confirm (critical bypass) | revoke anon, chi service_role |
| 2 | H | unique_violation nuot nham constraint | Confirm | CONSTRAINT_NAME phan biet |

## Round 3 - APPROVE, 0 findings
- Anon RPC -> 42501 permission denied (verify live)
- Service-role path nop ho so OK (TSDNJFGRXZHP)
- rate_limited lan thu 11; closed info chi {status}; track case-insensitive
- Residual (chap nhan): x-forwarded-for spoof lam yeu IP bucket - Turnstile
  giam thieu; tracking code khong the enum thuc te o 1.1e15

Commits: 8252025 (impl) -> 47cda87 (r1) -> 5fc92ae (r2+r3)
