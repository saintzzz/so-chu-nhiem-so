# CR-039: Bo kit demo (PPT) + huong dan khoi tao truong + kiem chung hien thi theo quyen

Ngay: 2026-10-08 · Loai: docs + scripts + kiem chung (khong doi business logic)

## 1. Yeu cau

1. Data demo da san sang - viet kich ban demo dang PPT va test lai theo
   dung kich ban do.
2. Truong trien khai thuc te bat dau voi he thong trong - can user guide
   day du chi tiet de tu khoi tao, kem file import mau.
3. "Ai co quyen chuc nang nao thi hien thi chuc nang do" - kiem chung
   nav/menu chi hien dung cac chuc nang role duoc cap.
4. Cap nhat user guide + kich ban demo chi tiet moi nhat.

## 2. Khao sat hien trang

Da co:

- `createSchool` (so_gd/admin, `/dept/schools`): tao truong + nam hoc +
  2 to mac dinh + bo mon theo cap + tai khoan BGH admin.
- Import san trong app: hoc sinh (.xlsx/.csv theo lop, `/records/upload`),
  TKB toan truong (list-mode, BGH).
- `createStaffAccount` (BGH, `/school/users`) - tung nguoi mot.
- Lien ket PH: roster GVCN (`create_parent_for_student` + `grantParentAccess`).
- `pptxgenjs`, `exceljs`, `xlsx` da la dependency.

Chua co:

- Kich ban demo dang slide PPT (hien chi co markdown).
- Import hang loat can bo/lop/phu huynh - khoi tao truong lon cham.
- Cau hinh kiem chung tu dong "nav item <=> route role cho phep".

## 3. Pham vi

- `scripts/check-nav-access.mjs`: audit tinh - moi href trong
  `mergedNav(role)` phai map toi page co `requireRoles` chua role do
  (hoac page mo cho moi user da dang nhap). Fail khi co muc nav tro toi
  route role khong duoc phep.
- `scripts/gen-demo-pptx.mjs` -> `docs/user-guide/KICH-BAN-DEMO.pptx`:
  kich ban demo dang slide, dong bo voi `KICH-BAN-DEMO.md` (cap nhat
  multi-role CR-038).
- `scripts/gen-init-template.mjs` -> `docs/templates/khoi-tao-truong.xlsx`:
  workbook mau khoi tao (co_so, to_chuyen_mon, can_bo, lop, hoc_sinh,
  phu_huynh, tkb + sheet huong dan).
- `scripts/bootstrap-school.mjs`: doc workbook -> khoi tao truong:
  tai khoan can bo (role + concurrent_roles + campus + to + mon day),
  lop + GVCN, hoc sinh, PH + lien ket + tai khoan, TKB. Ho tro
  `cleanup` de go truong kiem thu.
- `docs/user-guide/KHOI-TAO-TRUONG-MOI.md`: guide khoi tao tu dau -
  duong A qua UI, duong B import hang loat, checklist, ma tran phan viec.
- Update `HUONG-DAN-SU-DUNG.md`, `KICH-BAN-DEMO.md`, `user-guide/README.md`.
- Playwright chay lai cac luong trong kich ban demo tren prod.

## 4. Tieu chi nghiem thu

- AC-1: `check-nav-access` xanh - 0 nav item tro route ngoai quyen;
  Playwright confirm sidebar tung role.
- AC-2: PPTX gen thanh cong, noi dung bam data demo that.
- AC-3: bootstrap-school chay tren truong scratch -> verify counts ->
  cleanup sach.
- AC-4: Docs moi mieu ta dung thu tu khoi tao, khong buoc nao "ma thuat".
- AC-5: consistency/tsc/lint xanh; commit + push.

## 5. Ket qua thuc hien

### Bug tim duoc nho audit

- `check-nav-access` bao `pht -> /school/students`: page chi cho
  `bgh,admin` (PHT bi cam co y dinh tu CR-016 vi trang lo `national_id`).
  Fix dung huong: go muc "Hoc sinh toan truong" khoi nav PHT
  (`src/lib/nav.ts`). Audit sau fix: **158 nav hrefs, 104 routes - PASS**.
- Audit duoc gan vao `check-consistency.mjs` (`code:nav-access`) de
  regression tu bat ve sau.

### Bootstrap school

- `bootstrap-school.mjs` test tren truong scratch (KIEMTHU):
  - Validate: 2 co_so, 3 to, 7 can_bo, 3 lop, 4 HS, 3 PH, 4 tiet TKB.
  - Apply lan 1: `campus_new:2, dept_new:3, staff:7, mon_day:6, dept_head:3,
    class_new:3, hs_new:4, ph_new:3, ph_link:4, ph_account:2, tkb:4`.
  - Apply lan 2 (idempotent): `campus_skip:2, dept_upd:3, class_upd:3,
    hs_skip:4, ph_skip:3` - 0 duplicate.
  - Cleanup: go sach 9 tai khoan, 3 lop, 4 HS, 3 PH - verify DB ve 0.
- Bug fix trong qua trinh test: `employment_type` chi nhan
  `bien_che|hop_dong|thinh_giang` (da sua template + validate); PH match
  phai scope theo truong (PostgREST cap 1000 rows gay tao trung);
  cleanup probe schema truoc khi xoa (khong con noise loi bang thieu);
  `.in("col", ["-"])` tren uuid loi cast - doi nil uuid.

### Gates

- `check-nav-access`: PASS
- `check-consistency`: all PASS (gom nav-access)
- `r2-regression`: 124/124
- tsc: 0 loi · lint: 0 errors · build: 125 routes xanh
