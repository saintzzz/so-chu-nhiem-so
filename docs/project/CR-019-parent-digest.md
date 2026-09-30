# CR-019: Weekly parent digest email

**Date:** 2026-10-01
**Status:** Implemented, scheduled on production
**Driver:** PO ecosystem review - vnEdu/eNetViet deu co bao cao dinh ky cho phu huynh; SCN da co Resend wiring nhung chi dung cho announcement chu dong.

## What changed

1. **`src/app/api/cron/parent-digest/route.ts`** (moi):
   - `GET|POST /api/cron/parent-digest`, auth bang `Bearer <CRON_SECRET>` hoac `?secret=`; route 503 khi chua dat env (default-off).
   - Aggregate 7 ngay gan nhat theo phu huynh -> tung con: diem danh (vang/muon kem ngay), hanh kiem/nhan xet, diem moi kem ten mon.
   - Gui text email qua `sendEmail` (Resend). Khong co `RESEND_API_KEY` -> `skipped`, khong gay loi.
2. **`src/proxy.ts`** - whitelist `/api/cron/*` khoi login redirect (route tu auth bang CRON_SECRET; pattern giong `/api/ai/devin-callback` dung `callback_token`).
3. **`supabase/migrations/20261001_parent_digest_cron.sql`** - ghi nhan pg_cron job `scn-parent-digest` (`0 0 * * 1` = 07:00 T2 gio VN) da schedule tren production, cach reproduce.
4. Vercel env `CRON_SECRET` (sensitive, production) da set qua API.

## Security notes

- Cron secret la random 48 hex, chi nam trong Vercel env + lenh pg_cron trong DB (chi superuser doc duoc `cron.job`).
- Route khong tra du lieu - chi tra count `{sent, skipped, parents}`; khong co endpoint public nao doc duoc noi dung digest.

## Verification (dev)

- Khong secret / sai secret -> `401 unauthorized`.
- Dung secret -> `{sent:0, skipped:365, parents:365}` (365 PH co email, skipped do dev khong co RESEND_API_KEY - dung behavior).
- typecheck + lint xanh.

## Follow-ups

- DONE: RESEND_API_KEY (send-only key `scn-parent-digest`) + EMAIL_FROM=`So Chu Nhiem So <no-reply@aal.vn>` da set tren production; domain `aal.vn` verified tren Resend.
- Route gui batch 10 email song song + nghi 1.1s giua batch (Resend gioi han 10 req/s); `maxDuration = 300`.
- Prod invoke tra `{sent:30,...,error:429}` truoc khi throttle; sau throttle job se het trong ~40s cho 365 PH.
- Email demo `@demo.scn` bounce/failed la dung - dia chi gia; PH that se nhan duoc.
- Co the mo rong: dinh kem link portal, cho PH tat digest trong settings, log delivery vao bang rieng.
