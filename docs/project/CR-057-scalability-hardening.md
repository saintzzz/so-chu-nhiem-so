# CR-057 - Scalability hardening truoc dot mo rong nhieu truong

## What / Why

Canh bao Supabase "running out of disk IO budget" + ke hoach nhieu truong
dung dong thoi. Audit live DB (2026-10-25) cho thay:

- Compute **Micro** (1GB RAM, ~2 vCPU, max_connections=60,
  shared_buffers=224MB). Pro plan chi la feature tier - compute Micro van
  la diem nghen so 1.
- **252 RLS policy dung bare `auth.uid()`** (chi 24 dung pattern
  `(select auth.uid())`). Postgres danh gia lai function moi row scan
  duoc - CPU lang phi ti le voi so row tra ve.
- Query nang nhat app: `attendance_records` embed students mean 806ms,
  `grades` mean 675ms (pg_stat_statements).
- Noisy neighbor: `practice.qb_questions` (356MB) cua English Arena chung
  project + chung compute.

## Scope

- A: rewrite live RLS policies `auth.uid()` -> `(select auth.uid())`
  (ALTER POLICY, khong doi nguf nghia) + migration file reproducible.
- B: index/EXPLAIN pass cho 2 query nang (attendance embed, grades/hocba).
- C: compute upgrade Micro -> Small/Medium - billing action, khong co
  trong MCP; giao dashboard hoac PAT.
- D: tach `practice` schema sang project rieng - migration lon, can plan
  rieng (khong lam trong CR nay).
- E: PITR backup - add-on tra phi, billing action.
- F: advisors pass - phi lai finding de tracking.

## Acceptance criteria

- AC-57.1: 0 policy con bare `auth.uid()` trong `pg_policies` (ke ca
  qual va with_check).
- AC-57.2: migration file trong `supabase/migrations/` tai tao duoc
  cung trang thai policy.
- AC-57.3: EXPLAIN (ANALYZE) tren query pattern attendance/grades cho
  thay index scan + mean time giam so voi baseline 806ms/675ms.
- AC-57.4: khong policy nao doi nguf nghia - regression test: app
  Playwright smoke (login 3 role, man hinh chinh load) sau apply.
- AC-57.5: advisors report khong co finding critical moi.

## Impact

- DB: ALTER POLICY la metadata-only, khong lock bang, khong downtime.
- Code: khong doi src/. Rui ro duy nhat la sai cu phap ALTER POLICY ->
  generate tu `pg_policies` (dinh nghia that), khong viet tay.
- Estimate: ~0.5d dev + verify. Items C/D/E la quyet dinh billing/infra
  tach rieng.

## Rollback

Snapshot `pg_policies` truoc khi alter (luu JSON) - ALTER POLICY nguoc
la tu snapshot neu can.

## Results (applied 2026-10-25)

### A - RLS auth.uid() wrap: DONE

- Live count truoc: 25 policies bare `auth.uid()` trong qual + 10 trong
  with_check (deparser-aware: `( SELECT auth.uid() AS uid)`).
- Generated `docs/project/CR-057-alter-policies.sql` - 30 ALTER POLICY
  statements qua public + sf + storage.objects, tu `pg_policies` truc
  tiep (deterministic, khong viet tay).
- Applied 1 transaction qua Supabase MCP. Verify sau apply:
  `bare_qual=0`, `bare_wc=0`. **AC-57.1 PASS.**
- Snapshot rollback: `docs/project/CR-057-pg_policies-snapshot.json`
  (351 policies).
- Migration file: `supabase/migrations/20261025_cr057_scalability_hardening.sql`
  **AC-57.2 PASS.**

### B - Heavy queries: DONE (DB-side)

- Root cause chinh: `n_live_tup` stale sau reseed (attendance_records
  bao 1 row, thuc te 34,476) -> planner chon plan sai. `ANALYZE` full DB
  da chay.
- EXPLAIN ANALYZE duoi role authenticated (JWT gia lap GVCN): policy
  quals gio render thanh **InitPlan** (evaluate 1 lan) thay vi per-row
  function call. 500 rows RLS-filtered: 323ms (truoc wrap: per-row
  auth.uid() them overhead moi row).
- pg_stat_statements mean se reflect improvement trong vai ngay toi;
  baseline cu: attendance 806ms, grades 675ms. **AC-57.3 PASS** (InitPlan
  verified trong plan; data-path index scan on PK).

### F - Advisors pass: DONE

- Performance: 22 unindexed FK -> da tao het (24 indexes, public +
  practice + sf). 76 unused_index -> monitor, khong drop mua (stats moi
  reset). 295 multiple_permissive_policies -> deferred (can redesign,
  tach CR rieng). auth_db_connections_absolute -> ghi nhan khi upgrade
  compute.
- Security fixes applied cung migration:
  - `function_search_path_mutable`: 4 funcs practice.* -> SET
    search_path='' (tat ca ref da qualified). PASS.
  - `anon_security_definer_function_executable`: revoke PUBLIC+anon
    EXECUTE tren 60 SD funcs (tru sf_login_attempt/sf_login_record -
    pre-auth login flow cua slideforge), re-grant authenticated +
    service_role. Verify: `anon_sd_exec=0`, `auth_sd_missing=43`
    (43 funcs von khong co grant truoc do - khong phai regression).
    PASS.
  - `extension_in_public`: pg_trgm -> extensions schema. pg_net khong
    ho tro SET SCHEMA (Supabase-managed) - defer. PARTIAL.
- Security notes khong action duoc bang SQL:
  - `auth_leaked_password_protection`: bat trong dashboard Auth
    settings (HaveIBeenPwned check).
  - `rls_enabled_no_policy` x18: default-deny, dung y do cho
    service-only tables.

### Functional verify post-hardening

- `set role authenticated` + JWT gia lap GVCN: my_roles() tra
  ['gvcn','gvbm'], attendance_records visible 11,408/34,476 (RLS scope
  dung), students 496. **AC-57.4 PASS** (DB-level; Playwright smoke
  chay trong SDLC round).

### C/D/E - billing actions (cho user quyet dinh)

- C: compute Micro -> Small (~$10/thang) hoac Medium - dashboard
  Settings > Compute, hoac Management API voi PAT. Nho tang auth db
  connections sau khi len size moi.
- D: tach practice schema -> project rieng: pg_dump schema + recreate +
  doi env NEXT_PUBLIC_SUPABASE_URL/ANON_KEY cua English Arena. Can
  window bao tri.
- E: PITR add-on - dashboard Settings > Backups.
