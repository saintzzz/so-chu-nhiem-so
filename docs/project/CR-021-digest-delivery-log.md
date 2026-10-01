# CR-021: Delivery log + retry cho parent digest

**Date:** 2026-10-01
**Status:** Implemented
**Driver:** CR-019 gui digest nhung khong ghi lai ai da nhan/bi loi - khong the bao cao cho BGH hay retry lo hang loi (rate limit, bounce). Demo da cho thay Resend 429 khi chua throttle.

## What changed

1. **`supabase/migrations/20261002_digest_deliveries.sql`** (moi):
   - Bang `digest_deliveries`: `run_id`, `parent_id`, `email`, `week_start`, `status` (`sent|failed|skipped`), `error`, `attempts`.
   - RLS: staff cung truong doc duoc (`scn_parent_in_school`); ghi chi qua service role (cron route).
2. **`/api/cron/parent-digest`**:
   - Moi run sinh `run_id`, ghi 1 row/parent vao `digest_deliveries`.
   - `?retry=<run_id>`: chi gui lai cho parent co status `failed|skipped` trong run do (tang `attempts`).
   - Response tra `run_id`, `sent`, `failed`, `skipped`.
3. **`/register/audit`** them tab "Email digest" - BGH/GVCN xem delivery theo tuan, trang thai, loi.

## Impact assessment

- Bang moi, khong cham bang cu. Route cron da default-deny bang CRON_SECRET.
- Insert 365 rows/tuan - nho. Index tren `run_id`, `created_at`.

## Estimate

~0.5 ngay.

## Verification

- Migration applied tren Supabase; typecheck/lint/consistency xanh.
- Dev run ghi rows; retry run chi gui lai lo hang loi.

## Follow-ups

- Webhook Resend (bounced/complained) -> cap nhat status + danh dau email PH hong.
