# CR-073: Suite-level entitlement mapping (4 phân hệ)

## Vấn đề
Mô hình bán hàng là 4 phân hệ (Quản lý trường / Dạy-học / PH-HS / Dashboard-
báo cáo-tích hợp), khách mua lẻ module hoặc trọn gói. `/dept/modules` chỉ có
ma trận module lẻ - bật/tắt 9 module của 1 phân hệ cho 1 trường mất 9 thao tác.

## Quyết định (PO)
- Entitlement thực vẫn là `school_features` per-module (không đổi semantics:
  không row = bật - convention repo hiện có, suite-entitlement "mặc định tắt"
  là quyết định chính sách riêng nếu sau này đổi).
- `SUITES` registry trong `src/lib/modules.ts` = single source of truth cho
  mapping phân hệ -> module keys.
- `/dept/modules` thêm "Gói bán theo phân hệ": chọn trường -> 4 card phân hệ
  (n/N module đang bật) + Bật cả nhóm / Tắt cả nhóm qua `setSuiteModules`
  (bulk upsert + 1 audit entry `suite.enable|disable`).

## Mapping (single source: MODULES + SUITES)
- quan_ly (Quản lý trường & hành chính): tuyen_sinh, khoan_thu, bien_dong_hs,
  thu_vien, hoc_ba, xet_tot_nghiep, chuyen_can, dieu_dong, van_hanh_nang_cao
- day_hoc (Hỗ trợ dạy & học): studio, lms_lite, ky_thi_danh_gia, to_chuyen_mon
- ph_hocsinh (Chăm sóc PH-HS & giữ chân): phu_huynh_hoat_dong, tu_van_an_toan,
  thi_dua
- baocao_tichhop (Dashboard, báo cáo & tích hợp): tich_hop
  (dashboard/report lõi = CORE - luôn bật, không bán lẻ)

## Acceptance
- so_gd/admin bật/tắt cả phân hệ cho 1 trường trong 1 click; matrix phản ánh đúng.
- Role khác bị deny (checkActionRole so_gd|admin).
- Audit log ghi 1 entry/suite thay vì N entry rời.
