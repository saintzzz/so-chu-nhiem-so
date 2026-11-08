# CR-117 - Trien khai Phuong an B: self-host Supabase tren ha tang Viet Nam

**Status:** approved (chi dao truc tiep cua PO) - implementing
**Date:** 2026-11-08
**Lien quan:** CR-116 phan 6 (bao mat), `docs/positioning/CHIEN-LUOC-6-DAU-MUC.md` phuong an B
**User directive:** "Phuong an B - trien khai nhu the nay nhe"

## 1. Yeu cau

Chuyen tang du lieu Supabase cloud (ngoai VN) sang stack self-host Supabase
tren VM Viet Nam (Viettel IDC / VNPT Cloud / CMC Cloud / FPT Cloud).
Giu nguyen 100% code ung dung - chi doi bien moi truong.
App van chay tren Vercel (sin1), DB + Auth + Storage dat tai VN.

## 2. Pham vi dich vu can tu host

Khao sat thuc te codebase:

| Service Supabase | App co dung | Can tu host |
|---|---|---|
| Postgres + RLS + RPC | Co | `supabase/postgres` |
| GoTrue (Auth email/password) | Co | `supabase/gotrue` |
| PostgREST | Co | `postgrest/postgrest` |
| Storage (lesson-plans, question-media) | Co | `supabase/storage-api` |
| Realtime | Khong | bo |
| Edge Functions | Khong | bo |
| Studio/Meta | Khong can | bo (giam be mat tan cong) |

Gateway: Kong (routing /auth/v1, /rest/v1, /storage/v1) + Caddy TLS.

## 3. Tac dong

- `vercel.json` CSP `connect-src`/`media-src` can them domain VN
  (`https://*.vieschool.com`) de app goi duoc endpoint tu host.
- Bien moi truong Vercel can doi: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (key moi sinh tu JWT_SECRET cua stack).
- Du lieu: `pg_dump` toan bo tu cloud -> restore vao self-host
  (gom ca `auth.users` - mat khau giu nguyen vi hash di cung).
- SMTP cho reset password: tiep tuc dung Resend SMTP (email di
  tu VN khong bi chan; Resend chi la relay email, khong luu du lieu HS).

## 4. Ke hoach kiem chung - KET QUA (2026-11-08)

1. [x] `docker compose` stack chay that tren local (OrbStack): db/auth/rest/
   storage/kong all healthy, gateway 200 tren ca 3 API.
2. [x] Restore schema tu cloud - KHONG dung `supabase/migrations` cuc bo vi
   repo thieu baseline (311 migrations tren cloud, 103 file local):
   - Export catalog cloud qua 8 `_*_export` view (migration history,
     funcs, views, triggers, tables+cols, policies, exts, seqs).
   - `scripts/replay.mjs`: replay 311 migrations doc lap + inject object
     thieu (de quy 4 tang) + rewrite `drop ... if exists` + tach statement
     hong bang parser $$-aware + reconcile end-state tu pg_get_*def.
   - Parity dat duoc: 192/192 tables, 423/423 policies, 108 RLS tables,
     8/8 buckets, 311/311 migration history, 39/39 app triggers,
     31/31 views, funcs khop (tru ~5 trigger/funcs cua storage-api
     phien ban moi hon image - an toan vi storage-api tu quan schema).
   - Bai hoc: `auth.*`/`storage.*` do image so huu - KHONG reconcile
     (da fix trong replay.mjs sau loi "function is not unique").
   - Func tren cloud tao bang `check_function_bodies=off` duoc replay
     dung cach (sf_worker_publish - body co nhánh chua parse tren ca cloud).
   - 2 migration phu thuoc du lieu (demo backfill, quarantine) bo qua
     tren DB rong - ghi `dataDep` trong replay-state.json.
3. [x] GoTrue E2E: admin API tao user -> signInWithPassword -> JWT OK
   (signup tu do tat co chu dich - truong cap tai khoan).
4. [x] Storage E2E: upload/list/download/delete tren lesson-plans OK.
5. [x] Authenticated REST qua user JWT: 200.
6. [x] Runbook cutover: `deploy/vn-selfhost/RUNBOOK.md` (VM sizing, DNS/TLS,
   firewall, backup, rollback) + `scripts/export-catalog.mjs`,
   `scripts/verify-parity.mjs`, `scripts/export-cloud-catalog.sql`.
7. [x] Next.js tro `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000` ->
   login UI e2e@test.vn -> /school/dashboard (role bgh), RBAC chan
   /portal/student dung, 0 console error (ngoai Turnstile domain-localhost).
8. [ ] Cutover du lieu that - pg_dump (can db password cloud).
9. [ ] Deploy VM that + DNS (can tai khoan nha cung cap).

## 5. Non-scope (viec can nguoi - ghi trong runbook)

- Mo tai khoan + provision VM Viettel/VNPT/CMC/FPT.
- Tao ban ghi DNS `db.vieschool.com` (hoac ten mien chon) -> IP VM.
- Lay `db password` cua Supabase cloud project de `pg_dump` du lieu.
- Doi bien moi truong tren Vercel dashboard (hoac CLI co token).
- Don dep cac `_*_export` view phu tren cloud sau khi chuyen xong.
