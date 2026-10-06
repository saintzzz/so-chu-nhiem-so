# OPS - Supavisor (connection pooler)

## Trang thai: DA BAT SAN - khong can action bat

Supabase da migrate toan bo project sang Supavisor (PgBouncer cu da
deprecated). Verify 2026-10-07 bang ket noi thuc:

```
Transaction mode (6543): postgres.cxjpgfhqchjoernfmcra@aws-0-ap-southeast-1.pooler.supabase.com -> OK (select count from tvc.questions = 6876)
Session mode (5432):     cung host, port 5432 -> OK (current_user = postgres)
```

## Quan trong: app Next.js KHONG can doi gi

App ket noi qua PostgREST (`https://cxjpgfhqchjoernfmcra.supabase.co`)
bang supabase-js - PostgREST da duoc pool noi bo. Supavisor connection
string chi dung cho ket noi Postgres TRUC TIEP (pg driver, psql,
migration tool, script backup, Prisma/Drizzle neu co).

## Khi nao dung pooler truc tiep

- Chay script node/python ket noi Postgres truc tiep nhieu process
  (load test, seed lon, ETL).
- Tool ngoai (Metabase, BI, backup).
- Migration job giu session lau -> dung port 5432 (session mode).
  Port 6543 la transaction mode - KHONG dung cho prepared statements /
  session state / LISTEN-NOTIFY.

## Connection strings (chua trong secrets, KHONG commit)

```
Session:     postgresql://postgres.[ref]:[pass]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
Transaction: postgresql://postgres.[ref]:[pass]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

## Task con lai cho admin (can PAT hoac dashboard - toi khong co quyen)

1. **Check pool size** trong Dashboard > Settings > Database >
   Connection pooling: mac dinh match max_connections cua instance
   (micro ~60-90). Khi nang instance, xem lai `pool_size`.
2. **Tao Personal Access Token** (dashboard > Account > Access Tokens)
   neu muon quan ly qua Management API:
   `PATCH /v1/projects/{ref}/config/database/pooler`
   voi body `{ pool_size, default_pool_strategy, pool_mode }`.
3. Khi scale >50 truong: cai nang instance + theo doi metric
   `supavisor_pool_connections` trong dashboard, va can nhac bat
   "Prepared statements" (Supavisor ho tro prepared stmt o transaction
   mode khi bat feature nay).
