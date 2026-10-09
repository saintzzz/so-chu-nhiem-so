# CR-045 — Backlog sweep round 2: pht scope, digest retry+webhook, data hygiene

## Context

PM backlog sweep (2026-10-01) + QA round-3 de lai 6 muc pending. PO duyet xu ly
cac muc co impact nho ngay, khong cho them vong review.

## Scope

### 1. `pht` khong duoc export draft/review Studio material
- **Ly do:** ROLE-MATRIX: `pht` la Pho hieu truong van hanh - khong ky duyet,
  khong vao Studio. Export route co `pht` trong staff list -> pht doc duoc
  material draft/review chua duyet.
- **Fix:** bo `pht` khoi staff list cua non-published branch trong
  `src/app/api/studio/materials/[id]/export/route.ts`. Material `published`
  van export duoc qua published clause (dung thiet ke - moi user dang nhap).

### 2. Digest auto-retry + webhook Resend
- **Auto-retry:** truoc day chi retry thu cong qua `?retry=<run_id>`; run moi
  (khong param) gui lai cho moi PH chua `sent` nhung `attempts` reset ve 1,
  khong co cap -> co the spam. Nay: load deliveries tuan hien tai, cong don
  `attempts`, cap `MAX_ATTEMPTS=3`/PH/tuan. `?retry=` thu cong bo qua cap.
- **Webhook:** route moi `POST /api/webhooks/resend` - xac thuc svix signature
  (`RESEND_WEBHOOK_SECRET`, thieu -> 503 fail-closed), replay protection 5 phut,
  out-of-order safe (`event_at` chi ghi de neu moi hon). Map event:
  delivered/bounced/complained/failed/delayed -> `digest_deliveries.delivery_event`.
  `bounced`/`complained`/`delivered` = terminal -> auto-retry khong gui lai.
- **provider_id:** `sendEmail` tra `ids: {email: providerMessageId}`
  (Resend `id`, Brevo `messageId`) -> cron ghi vao `digest_deliveries.provider_id`
  de webhook doi chieu.
- **Migration:** `20261009_digest_webhook_fields.sql` - them `provider_id`,
  `delivery_event`, `event_at` + index.

### 3. Dedupe tvc_questions
- **Van de:** gen script tao 1 row per (stem x standard_id) -> cung stem lap
  theo grade/qtype (727 nhom, 1808 row du). Bao cao cu dem "55" vi chi tinh
  grade<=5.
- **Fix:** migration `20261009_tvc_questions_dedupe.sql` - gop theo
  (stem, grade, subject_code, qtype), keeper uu tien `approved`, union
  `standard_ids` (khong mat coverage YCCD), xoa row du. Ket qua: 0 dup groups.

### 4. `ngu_van` grade range 1-12 -> 6-12
- **Ly do:** CTGDPT 2018 - cap TH mon la Tieng Viet (`tieng_viet` 1-5 da co),
  Ngu van bat dau lop 6. `tvc_subjects.ngu_van` sai range -> picker Studio
  hien lop 1-5 khong co YCCD.
- **Fix:** migration `20261009_ngu_van_grade_range.sql` - `grade_min=6`.
  App doc range dong tu `tvc_subjects` nen khong can sua code.

## Impact assessment

- RBAC: `pht` mat quyen export draft/review (dung spec). Khong anh huong role khac.
- Digest: khong doi contract route; them cot moi - backward compatible.
  Webhook la route moi, default-deny khi chua co secret.
- Bank: union standard_ids giu nguyen coverage; xoa row du khong anh huong
  exam/material da generate (question embed vao doc luc generate).
- `ngu_van` picker mat lop 1-5 - dung y dinh.

## Out of scope (approved tu choi / defer)

- Supabase Pro+Small upgrade: PO bao chua can.
- Thi tren may (chong chuyen tab, dedupe nop bai): thuoc `tvc360-congcuso`,
  khong phai repo nay.
- A-03 audio TTS that: xu ly rieng (gen audio assets qua ChatGPT Playwright).

## Verification

- tsc --noEmit + eslint: clean.
- Dedupe verify: 0 dup groups con lai (truoc: 727 nhom / 1808 row du).
- `ngu_van` subjects row: grade_min=6 confirmed.
- Pending prod: PHT account test export draft vs published; webhook can
  `RESEND_WEBHOOK_SECRET` tren Vercel + endpoint dang ky trong Resend dashboard.
