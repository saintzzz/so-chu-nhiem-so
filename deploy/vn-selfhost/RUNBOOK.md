# RUNBOOK - Self-host Supabase tren VM Viet Nam (Phuong an B, CR-117)

Muc tieu: toan bo du lieu (Postgres + Auth + Storage) dat tai VM Viet Nam.
App Next.js van tren Vercel - chi doi 4 bien moi truong.
Ket qua kiem chung local: stack chay, migration ap dung het, login + load
du lieu qua `http://localhost:8000` (xem muc 5).

## 1. Provision VM (viec cua nguoi - can tai khoan nha cung cap)

| Hang muc | Khuyen nghi toi thieu |
|---|---|
| Provider | Viettel IDC / VNPT Cloud / CMC Cloud / FPT Cloud (phap nhan VN) |
| VM | 2 vCPU, 4GB RAM, 60GB SSD (truong ~1500 HS du). Pilot lon: 4vCPU/8GB |
| OS | Ubuntu 22.04 LTS |
| Mang | IP tinh, mo 80/443 inbound. Port 8000 KHONG mo ra ngoai |
| Firewall | UFW: allow 22 (gioi han IP quan tri), 80, 443. deny 8000, 5432 |

Tren VM:

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Repo + stack
git clone https://github.com/saintzzz/so-chu-nhiem-so.git /opt/vieschool
cd /opt/vieschool/deploy/vn-selfhost
cp .env.example .env
```

## 2. Cau hinh .env

```bash
POSTGRES_PASSWORD=$(openssl rand -hex 32)   # ghi vao .env
JWT_SECRET=$(openssl rand -hex 32)          # ghi vao .env
node scripts/gen-keys.mjs <JWT_SECRET>      # sinh ANON_KEY + SERVICE_ROLE_KEY -> ghi vao .env
```

Dien `SMTP_PASS` (Resend API key - dung cho mail reset mat khau),
`PUBLIC_DOMAIN`, `SITE_URL`, `API_EXTERNAL_URL`.

## 3. DNS + TLS (viec cua nguoi - can quyen DNS)

Tao ban ghi `A` cho `db.vieschool.com` -> IP tinh cua VM.
Caddy tu xin Let's Encrypt khi domain tro dung.

## 4. Khoi dong stack

```bash
docker compose --env-file .env -f docker-compose.yml up -d
docker compose --env-file .env -f docker-compose.yml --profile prod up -d   # kem caddy tren VM that
curl http://localhost:8000/rest/v1/ -H "apikey: $ANON_KEY"   # check postgrest song
```

## 4b. Restore schema tu cloud (khong dung supabase/migrations cuc bo)

Repo KHONG co baseline schema day du (311 migrations tren cloud nhung chi
103 file local). Quy trinh da kiem chung tren vn-db:

```bash
# A. Export catalog tu cloud (can SUPABASE_SERVICE_ROLE_KEY cua project cloud)
#    Tao cac view phu tren cloud: _mig_export, _drift_export, _table_export,
#    _col_export, _pol_export, _ext_export, _seq_export, _trig_export
#    (SQL tao view: xem scripts/export-cloud-catalog.sql)
node scripts/export-catalog.mjs      # -> /tmp/mig.json, drift.json, tables.json, cols.json, policies.json, exts.json, seqs.json, trigs.json

# B. Replay + reconcile (idempotent, checkpoint tai replay-state.json)
node scripts/replay.mjs --fresh      # replay 311 migrations + inject object thieu + reconcile end-state
#    Ket qua ky vong: errors<=1, RECONCILE fail~0 (bo qua "multiple primary keys")

# C. Kiem tra parity (scripts/verify-parity.mjs)
node scripts/verify-parity.mjs       # so sanh tables/columns/funcs/policies/views/triggers cloud vs local
```

Co che cua replay.mjs:
- Moi migration chay doc lap; statement hong duoc tach bang parser $$-aware
  va phan loi bi bo qua (y het cloud khi ap bang psql non-transactional).
- Rewrite an toan: `drop policy/constraint/trigger` -> `if exists`.
- Thieu object (function/table/column/view/schema) -> inject dinh nghia tu
  export cloud roi retry, de quy toi 4 tang, toi da 40 vong/statement.
- RECONCILE cuoi: `create or replace` moi function/view tu pg_get_*def cua
  cloud, tao lai 423 policies, drop policy thua, sync 8 storage buckets,
  bat RLS tren bang co policy -> end-state khop cloud.
- 2 migration phu thuoc du lieu (backfill demo profiles, quarantine cau hoi
  theo ID) duoc ghi nhan `dataDep` - khong can thiet tren DB rong.
- Ham tren cloud duoc tao voi `check_function_bodies=off` (body chua parse)
  duoc replay dung cach nhu vay de bao toan parity.

## 5. Chuyen du lieu tu Supabase cloud (cutover)

```bash
# Lay db password cua project cloud: dashboard Supabase -> Settings -> Database
pg_dump "postgresql://postgres:<DB_PASS>@db.<REF>.supabase.co:5432/postgres" \
  -Fc -f /tmp/vieschool-cloud.dump

docker cp /tmp/vieschool-cloud.dump vn-db:/tmp/in.dump
docker exec vn-db sh -c 'pg_restore -U postgres -d postgres --clean --if-exists --no-owner /tmp/in.dump'
```

`pg_dump` full DB mang theo ca `auth.users` (mat khau giu nguyen vi hash
di cung) va `storage.buckets/objects` metadata. File vat ly trong bucket:
tai ve bang `supabase storage` / S3 API roi copy vao volume `storage-data`
giu dung cau truc thu muc `<bucket>/<path>`.

## 6. Tro app sang stack moi

Vercel env vars (Production):

```
NEXT_PUBLIC_SUPABASE_URL=https://db.vieschool.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY moi>
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY moi>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY moi>
```

Redeploy. Login thu 1 tai khoan -> dashboard -> upload file vao
lesson-plans -> kiem tra object trong `storage-data`.

## 7. Van hanh

- Backup: `scripts/backup.sh` qua cron 1h dem, giu 30 ngay. Nen sync
  them sang object storage khac site (vd: S3-compatible cua chinh nha
  cung cap VN).
- Giam sat: `docker compose ps` + healthcheck db; caddy access log.
- Nang cap image: sua tag trong compose, `pull` + `up -d`, test tren
  ban sao truoc.
- Rollback: doi lai 4 env vars ve Supabase cloud -> redeploy Vercel
  (du lieu cloud van con nen rollback tuc thi trong cua so chuyen).

## 8. Trang thai kiem chung local

- [x] Compose config hop le (`docker compose config`)
- [x] 5 container healthy (db/auth/rest/storage/kong)
- [x] Schema cloud restore day du: 192/192 tables, 423/423 policies, 108 RLS,
      8/8 buckets, 311/311 migration history, funcs/views/triggers khop
      (tru 5 trigger + funcs cua storage-api phien ban moi hon - an toan)
- [x] REST/Auth/Storage qua Kong: 200 + query that `schools` OK
- [x] GoTrue E2E: admin tao user -> signInWithPassword -> JWT (signup tu do TAT
      co chu dich - truong cap tai khoan, khong mo dang ky cong khai)
- [x] Storage E2E: upload/list/download/delete tren bucket lesson-plans qua
      gateway deu OK (can drop overload function storage.* do reconcile tu
      cloud - image storage-api so huu schema storage, da ghi trong replay.mjs)
- [x] Next.js tro `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000`:
      login that e2e@test.vn -> /school/dashboard (role bgh), RBAC chan
      /portal/student dung, console 0 error ngoai Turnstile domain-localhost
- [ ] Cutover du lieu that (pg_dump - viec cua nguoi, can db password cloud)
- [ ] DNS + VM that (can tai khoan nha cung cap - viec cua nguoi)
