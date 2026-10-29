# CR-079: Bua an + bao hong CSVC

## Nguon yeu cau
/school/equipment da co danh muc tai san (van_hanh_nang_cao). Gap con:
bao hong workflow (NV bao -> xu ly -> xong) va module bua an.

## Quyet dinh nghiep vu
- equipment_issues: moi nhan vien bao hong tai san/phong hoc ->
  ke_toan/pht/bgh nhan + doi trang thai (open -> in_progress -> done |
  rejected) + ghi chu xu ly. Notification cho nguoi xu ly.
- meal_menus: thuc don theo ngay + buoi (sang/trua) - mon an, ghi chu
  dinh duong. ke_toan/bgh/admin quan ly.
- meal_counts: GVCN chot so suat an lop minh theo ngay; bao cao tong.
- Module flag `bua_an` cho meal_*; equipment_issues nam trong
  van_hanh_nang_cao (da co).

## Scope
- 3 bang + RLS (tenant + role: report = staff rong, xu ly = ke_toan/
  pht/bgh/admin; meal write = gvcn lop minh + bgh/admin/ke_toan).
- Pages: /school/equipment/issues (board bao hong), /meals (menu +
  count report).
- Nav: bao hong vao nhom Quan tri; meals nhom Quan tri.

## Impact
- Nav + module flag bua_an; equipment-board them tab issues.

## AC
- AC-79.1: equipment_issues CRUD + status flow; reporter thay ticket
  cua minh; xu ly doi status + note; notification cho resolver.
- AC-79.2: meal_menus CRUD theo (date, session) unique.
- AC-79.3: meal_counts upsert per (date, class) + report tong suat/ngay.
- AC-79.4: module bua_an off -> route redirect + action reject.
- AC-79.5: RLS tenant; gvbm co the bao hong (staff) nhung khong xu ly.

## Out of scope
- Ke hoach mua sam/sua chua, kiem ke dinh ky, quan ly phong chuc nang
  chi tiet, dinh duong theo khau phan chuan Bo Y te.
