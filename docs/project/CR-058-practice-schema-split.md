# CR-058 - Tach practice schema (English Arena) sang Supabase project rieng

## What / Why

`practice.*` (English Arena / student-self-practice-web) chung project
`cxjpgfhqchjoernfmcra` voi public.* (So Chu Nhiem). Noisy neighbor:
qb_questions 356MB + audit scripts tung dot IO budget (email canh bao
2026-10). User quyet dinh: **tach ra, nhung giu kha nang dung chung
khi can**.

## Impact assessment

- So luong doi tuong: ~30 bang practice.* + ~4 functions + RLS policies
  rieng + storage buckets cua EA (can kiem ke chinh xac truoc khi chay).
- App phia EA (`student-self-practice-web`, Vercel `ioe-leduyminh`):
  doi NEXT_PUBLIC_SUPABASE_URL + ANON_KEY + service key + redirect URL
  trong Supabase Auth config.
- SCN app: khong doc/ghi practice.* truc tiep (verify truoc cutover
  bang grep + pg logs).
- "Dung chung khi can": 2 project van co the ket noi cheo qua
  postgres_fdw (foreign data wrapper) neu SCN can doc practice data,
  hoac EA dung service key cua project cu trong thoi gian chuyen tiep.
  Khuyen nghi: khong tao fdw tru khi co use case that - giu ranh gioi
  sach.

## Plan

### Phase 0 - Pre-flight (no downtime)

1. Tao project moi `english-arena` trong cung org (Pro plan de gioi
   nguoi dung; region cung Singapore/apsoutheast cho latency thap).
   -> hanh dong cua user tren dashboard (billing org entitlement).
2. Inventory: `pg_dump --schema-only --schema=practice` + liet ke
   extensions (pg_trgm), functions, triggers, RLS policies, storage
   buckets, auth users lien quan EA.
3. Verify SCN khong phu thuoc: grep `practice\.` trong
   `so-chu-nhiem/src` + check edge_logs cho PostgREST calls toi
   `/rest/v1/` tren bang practice tu authenticated users.

### Phase 1 - Data migration (maintenance window ~15-30 phut)

4. Freeze writes EA: maintenance page hoac chi dinh khung gio thap diem
   (22h-6h VN). EA la app hoc sinh tu luyen - khung gio toi thieu user.
5. `pg_dump --schema=practice` tu project cu -> restore vao project
   moi. Luu y: pg_dump khong chuyen RLS grants day du cho moi role -
   verify lai policies sau restore.
6. Storage: copy bucket objects cua EA (neu co) qua S3 API sync.
7. Auth: EA dung Supabase Auth? Neu co -> export users tu
   `auth.users` (Management API) sang project moi, hoac giu project cu
   lam identity provider tam thoi. Quyet dinh theo ket qua buoc 2.

### Phase 2 - Cutover

8. Update Vercel env cua `ioe-leduyminh`: NEXT_PUBLIC_SUPABASE_URL,
   ANON_KEY, SUPABASE_SERVICE_ROLE_KEY -> project moi. Redeploy.
9. Smoke test: login hoc sinh, lam 1 bai tap, ket qua ghi DB moi.
10. Giu schema cu o project cu 1-2 tuan (read-only, khong xoa) lam
    fallback + phuc vu truy xuat lich su neu can.

### Phase 3 - Cleanup

11. Sau khi stable: drop schema practice khoi project cu (giai phong
    356MB + IO headroom cho SCN).
12. Neu can truy xuat cheo: tao postgres_fdw tu project cu sang moi
    (readonly foreign tables) - chi khi co requirement that.

## Rollback

- Schema cu giu nguyen toi Phase 3 -> revert env vars ve project cu,
  disable maintenance mode. Du lieu ghi vao DB moi trong thoi gian
  cutover: replay bang pg_dump incremental hoac accept loss (danh gia
  truoc khi chon cua so).

## Estimate

- Phase 0-1: ~0.5d (inventory + dry-run restore)
- Phase 2: ~2h trong maintenance window
- Phase 3: ~1h verify + drop

## Blocked on

- User tao project moi (billing) hoac cap PAT cho Management API.
