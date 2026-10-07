# CR-034: Demo gate 15/10 - truong tu dang nhap dung thu

Ngay: 2026-10-07 | Loai: CR - pham vi gate | Nguon: yeu cau TVC 07/10/2026

## 1. Thay doi yeu cau

TVC yeu cau **15/10/2026** co ban dung duoc de day ve cac truong demo core
functions, hinh thuc **truong TU DANG NHAP va dung thu** tren
`sochunhiem.vieschool.com` (domain da live). Sau gate, feedback truong dua vao
backlog va xu ly tiep theo M1-M4.

Scope demo duoc PO dong bang truoc 12/10: man hinh phia GV/BGH la chinh
(diem danh, so diem, Studio soan KHBD/cau hoi, quan tri truong), parent portal
la loop kem theo neu kip.

## 2. Impact assessment

### Anh huong he thong

- **Khong doi schema**: dung bang co san (`schools`, `academic_years`,
  `departments`, `subjects`, `profiles`, `parents`, `parent_students`,
  `auth.users`).
- **Route moi**: `/dept/schools` (tao truong + cap admin truong),
  `/dept/usage` (giam sat su dung xuyen truong) - guard `so_gd`/`admin`.
- **Action moi**: `createSchool` (so_gd/admin), `grantParentAccess`
  (gvcn lop CN + bgh/admin).
- **Nav**: them 2 muc vao nhom Quan tri cua `so_gd` va `admin`.
- **Khong anh huong** flow hien co: `createStaffAccount` giu nguyen, truong
  tu tao GV; roster giu nguyen RPC `create_parent_for_student`.

### Rui ro

- Truong moi khong co `subjects`/`academic_years` -> GV khong tao duoc gi:
  provision phai seed bo mon theo cap + nam hoc hien tai.
- `auth.users.last_sign_in_at` chi doc duoc qua admin client - usage page la
  server component dung service key (da co san trong env prod, khong key moi).
- Demo truong tu dung: loi ngay 15/10 khong co nguoi ho tro -> can data mau
  san + hotfix trong ngay (quy trinh, khong phai code).

## 3. Estimate (tach rieng khoi estimate goc)

| Hang muc | Effort |
|---|---|
| `createSchool` + trang `/dept/schools` | 0.5d |
| Trang `/dept/usage` (admin API last_sign_in + aggregate) | 0.5d |
| `grantParentAccess` + UI tren roster | 0.25d |
| QA: typecheck/lint/check-consistency + E2E role flows | 0.25d |

Tong ~1.5d - nam trong tuan truoc gate 12/10 (scope freeze).

## 4. Acceptance criteria

- **AC-1.1** Given tai khoan `so_gd`/`admin`, When mo `/dept/schools` va submit
  form (ten, ma, cap, email+password admin truong), Then DB co school row +
  academic_year 2026-2027 is_current + bo subjects theo cap + auth user role
  `bgh` gan school_id; admin truong login duoc ngay.
- **AC-1.2** Given admin truong vua tao, When login va vao `/school/users`,
  Then tao duoc tai khoan GV (createStaffAccount hien co) - khong can dev.
- **AC-2.1** Given `so_gd`/`admin`, When mo `/dept/usage`, Then thay bang theo
  truong: tong user, so active 24h, so active 7d, lan dang nhap gan nhat; va
  bang user (ten, role, truong, last_sign_in) sap theo moi nhat.
- **AC-2.2** Given role bat ky khac `so_gd`/`admin`, When vao `/dept/usage`
  hoac `/dept/schools`, Then bi redirect ve role home - khong lo du lieu.
- **AC-3.1** Given GVCN tren roster, When chon HS + nhap email/password PH,
  Then co auth user `phu_huynh` + `parents.profile_id` duoc gan + link
  `parent_students`; PH login vao `/portal/parent` thay dung con minh.
- **AC-3.2** When PH vua cap login `/portal/parent`, Then chi thay du lieu HS
  con minh (RLS parent_students), khong thay HS khac.

## 5. Quyet dinh pham vi (PO)

- **Lam**: 3 muc tren + data mau san khi provision (lop + HS mau toi thieu
  theo chon "co seed data mau" trong form - checkbox, default ON cho truong
  demo).
- **Khong lam**: tai khoan `hoc_sinh` (demo chu yeu phia GV); bulk import GV
  (admin tao tay ~10 GV/truong la du); infra monitoring rieng (Vercel
  Analytics co san, usage page la phan "ai dang dung").
- **Quy trinh kem theo** (khong code): scope freeze 12/10, QA regression
  12-14/10, hotfix trong ngay tuan 15-19/10, co che reset/thu hoi account
  demo sau gate.

## 6. Verify

- `npm run check` (typecheck + lint + build) + `node scripts/check-consistency.mjs`.
- Playwright: so_gd tao truong -> admin truong login tao GV -> gvcn cap PH ->
  PH login thay con; usage page ghi nhan last_sign_in sau login.

## 7. Ket qua thuc hien (07/10)

**Implement xong, lead review APPROVED sau 4 vong.**

- E2E Playwright 11/11 pass (`scripts/e2e-cr034.mjs`): so_gd tao truong
  "THPT Demo Gate" + admin BGH -> admin login -> tao GV -> `/dept/usage`
  render + hien truong moi -> gvcn bi chan `/dept/schools` -> roster render.
- DB verify: school + nam hoc 2026-2027 + 2 to CM + 13 mon THPT + 3 lop
  (grade 10/11/12 dung) + 24 HS mau; auth users `bgh` + `gvcn` tao thanh
  cong. Data test da don sach sau verify.
- Checks: tsc clean, eslint 0 errors, consistency all-pass, build 123 routes.
- Fix qua review: grade parse full leading digits; moi buoc provision check
  loi + rollback co bao cao phan chua xoa; conditional update
  `profile_id IS NULL` + verify row + dọn auth user le; retry cap tai khoan
  PH khong bi chan boi link trung (skip insert khi da link, chap nhan 23505);
  audit chi ghi khi insert that; inline validation email/password dung
  convention; email normalize 1 cho.
- **Chua verify UI end-to-end**: flow cap tai khoan PH tren roster (action
  da review + trang render, can QA tiep tren staging); trang parent login.
- Deploy: cho approve - push `master` auto-deploy Vercel.
