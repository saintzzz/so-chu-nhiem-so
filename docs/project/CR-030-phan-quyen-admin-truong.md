# CR-030 - Phan quyen theo chuc nang + data-level ACL + admin page truong

## 1. Bai toan (PO)

1. Phan quyen theo CHUC NANG: role nao dung chuc nang nao; va theo DATA:
   cung 1 chuc nang nhung admin co the cam user A xem item X, user B van thay.
2. Admin page cho truong: tao account, phan quyen, cau hinh.
3. Phuong an ha tang ngoai Supabase cho 100k user (xem phan 4).

## 2. Mo hinh phan quyen (DB: migration 20261006_cr030_permissions_acl.sql)

Ba lop uu tien: **user deny > user allow > role deny > role allow > default**.

- `feature_grants(school_id, role|user_id, feature, effect allow|deny)`:
  cau hinh theo vai trò HOAC theo tung nguoi, scope truong.
  Feature keys: studio, studio.questions, studio.review, studio.export,
  studio.ai, school.users (registry `src/lib/feature-keys.ts`).
- `item_acl(school_id, table_name, item_id, user_id, deny)`:
  an du lieu cu the voi 1 user (cau hoi, hoc lieu, mau KHBD, YCCĐ).
- `scn_has_feature(f)` secdef: resolve 3 lop; `scn_item_denied(tbl,id)`
  secdef nhung trong RLS read cua questions + materials.
- Guard: `requireFeature("studio")` tren 9 trang /studio; RLS `item_acl`
  chan ngay ca query thang.

RLS: staff doc grant cua truong; chi bgh/admin ghi grant + acl.

## 3. Admin page truong (/school/users, role bgh/admin)

- **Tao tai khoan GV**: form email/mat khau/vai tro/co so/tong -> auth
  user + profile day du (admin client, email_confirm). Da verify tao
  test.cr030@nd.test thanh cong.
- Doi vai tro/co so/tong co san tu truoc.
- **Ma tran quyen theo vai tro**: 6 chuc nang x 6 vai tro, 3 trang thai
  Mac dinh/Cam/Cho phep.
- **Quyen rieng theo user**: expand tung dong -> override per-feature.
- **ACL du lieu**: tren bank cau hoi, admin (bgh/admin) co nut
  "Gioi han voi GV"/"Go gioi han" - nhap email -> item_acl deny.

## 4. Ha tang 100k-1M user ngoai Supabase

Ket luan: khong co free tier nao chiu duoc 100k user that su - nhung
co cach re hon Supabase Pro khi scale:

| Phuong an | Chi phi uoc tinh | Phu hop |
|---|---|---|
| Supabase Pro + Supavisor | $25/mo + compute | Pilot -> ~50k |
| Self-host Supabase/PostgREST tren VPS (Hetzner/OVH) | $20-60/mo | 100k, can devops |
| Postgres thuan + API rieng (Drizzle/PostgREST) tren VPS | $10-30/mo | Re nhat, mat tien ich auth/RLS co san |
| Neon/Railway (serverless Postgres) + auth rieng | $19+/mo | Scale doc gioi |
| Cloudflare Workers + D1/Hyperdrive | $5+/mo | App viet lai, khong phu hop RLS phuc tap |

De xuat thuc te: giu Supabase (code+RLS dau tu xong), nang compute +
bat Supavisor khi >5 truong; chuan bi migration path Postgres self-host
chi khi vuot ~200k (RLS + schema tvc/public mang theo duoc 1:1 vi la
Postgres chuan - khong locked-in).

## 5. Verify

- RPC-level: user deny `studio.questions` -> false, `studio` van true;
  role deny `studio.export` cho to_truong -> false; `studio.review`
  default -> true; item_acl deny -> cau hoi bien mat khoi query cua
  user do (1 -> 0), user khac binh thuong.
- UI: BGH tao account thanh cong, ma tran + override render dung.
- Gate: typecheck/lint/check-consistency/build xanh.

## 6. Con lai

- Ap `requireFeature` vao cac page ngoai studio khi them feature key.
- UI liet ke acl hien co (hien chi tao/xoa bang email nhap tay).
- Audit log cho grant/acl thay doi (hien chua ghi audit bang).
