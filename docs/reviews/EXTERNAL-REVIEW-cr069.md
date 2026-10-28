# External Review - CR-069 hoc_ba XML + ky so 2 cap

Commits: `7f317c5` (impl) + `0dd4443` (r1 fixes). Reviewer: cross-model subagent (GPT).

## Round 1 - REJECT (1C + 2H + 2M + 1L)

| Sev | Finding | Disposition |
|---|---|---|
| Critical | `hbxml.ts` fallback secret cong khai `scn-hb-dev-secret` -> chu ky gia mao duoc | FIXED: fail-closed - `HB_SIGNING_SECRET` >=32 ky tu hoac derive HMAC tu `SUPABASE_SERVICE_ROLE_KEY`, khong con public default |
| High | Race `hb_store` (check roi upsert rieng) co the ghi de ban vua ky BGH | FIXED: upsert `WHERE status <> 'bgh_signed'` + `already_signed` khi 0 row - atomic duoi read-committed |
| High | Race `hb_sign` - 2 ky song song cung pass stale check | FIXED: `UPDATE ... WHERE id AND status=<expected>` + `not found -> invalid_state` |
| High | verify: `gvcnOk`/`bghOk` van true khi XML bi sua nhung sig khop sha cu | FIXED: `gvcnOk = shaOk && ...` |
| Medium | `sig`/`at` nhung vao XML attr khong escape | FIXED: `esc()` moi attr + `p_sig` bat buoc hex64 + CHECK `hb_sig_hex` |
| Medium | `hb_module_enabled` default-open `coalesce(...,true)` | NOT-CONFIRMED: cung convention opt-out voi moi module gate (fee/lms/lib/sm/int/tn); chinh sach default per-module thuoc suite-entitlement task |
| Low | `hb_exports` query khong loc theo academic_year | FIXED: `eq("academic_year_id", year.id)` |

## Round 2 - APPROVE

Reviewer xac nhan tung fix duoi Postgres read-committed semantics (row-lock + re-evaluate WHERE). Khong con finding actionable.

## Live verification

13/13 checks pass (`scripts/test-cr069-live.mjs`): role deny (gvbm/bgh-ky-gvcn), trinh tu ky, double-sign invalid_state, store sau khi ky -> already_signed, module-off chan read + RPC. Playwright: trang render dung, tao XML e2e ghi `hb_exports` status `generated`.

## Residual

- Rotate `SUPABASE_SERVICE_ROLE_KEY` khi chua set `HB_SIGNING_SECRET` -> chu ky cu khong verify duoc (da comment trong code).
- Ky so chu nghiep vu CA thuong mai (VB-CA/VNPT) van o `docs/project/BACKLOG-CREDENTIALS.md`.
- Bonus fix trong commit: `useMounted` gate `usePathname` - dong hydration mismatch layout-wide tren Next 16.
