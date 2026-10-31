# CR-077: Provisioning trường trial cho khách dùng thử

## Bối cảnh / yêu cầu

Khách hàng muốn dùng thử hệ thống. Yêu cầu kinh doanh: **chỉ mở các tác vụ cơ bản nhất**, khóa toàn bộ phân hệ nâng cao để tránh lộ cấu trúc sản phẩm (chống copy). Cần bàn giao kèm user guide có thông tin đăng nhập.

## Quyết định triển khai (PO)

Dùng đúng tính năng hệ thống, không viết code mới cho entitlement:

1. **Tenant riêng** - tạo trường `THCS Trial - VieSchool` (mã `TRIAL01`, id `397c1a3d`) qua `/dept/schools` (server action `createSchool`) với seed demo: 4 lớp, 32 HS, 14 môn, 1 năm học.
2. **Tắt toàn bộ module** qua `/dept/modules` bulk-toggle 4 suite, sau đó **bật lại duy nhất `chuyen_can`** - module cốt lõi nhất để khách cảm nhận giá trị.
3. **Tài khoản trial** (mật khẩu `Trial@2026`): `hieutruong@` (bgh), `chunhiem@` (gvcn - chủ nhiệm cả 4 lớp), `giaovien@`/`giaovien2@`/`giaovien3@` (gvbm).
4. **Seed bổ sung**: 120 tiết TKB (phân công 4 GV không trùng slot - thỏa `uq_timetable_teacher_slot`), điểm danh hôm nay lớp 6A1 (có vắng phép + đi muộn).
5. **User guide PPTX** `docs/user-guide/HUONG-DAN-DUNG-THU.pptx` (script `scripts/gen-trial-guide-pptx.mjs`) - 7 slide: đăng nhập, dữ liệu mẫu, phạm vi mở/khóa, kịch bản 15 phút, FAQ.

## Impact assessment

- Không đổi schema, không đổi code module gate (tái dùng `school_features` + suite toggle CR-073).
- Dữ liệu trial cô lập hoàn toàn theo `school_id` (RLS).
- URL bàn giao: `https://vieschool.com/login` (cùng Supabase project với production).

## Bug phát hiện trong QA (đã sửa cùng CR này)

`dept/dashboard`: `key={r.name}` trong bảng xếp hạng thi đua - khi hệ thống có nhiều trường, tên lớp trùng nhau (6A1, 7A1...) gây React duplicate-key error. Fix: key theo `class.id`, label chart gắn mã trường + dedupe, bảng hiển thị thêm tên trường dưới tên lớp.

## Xác minh (Playwright + SQL)

- `school_features`: 20 module, chỉ `chuyen_can = true`.
- GVCN `chunhiem@trial.scn`: dashboard có dữ liệu thật (6 có mặt, 1 phép, 1 muộn, 87.5%), nav chỉ hiện Chuyên cần + nhóm core.
- BGH `hieutruong@trial.scn`: `/school/documents` (van_thu off) redirect về `/school/dashboard`; nav "Học sinh & chất lượng" không có "Sổ công văn"; dashboard trường hiển thị đúng 4 lớp.
- TKB: 120 rows, không vi phạm unique teacher slot; điểm danh 8 rows đúng check constraint (`present/excused/late`).
- Console: sạch (chỉ Fast Refresh dev).
