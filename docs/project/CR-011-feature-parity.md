# CR-011: Bù đắp feature-parity với site tham chiếu

## Nguồn
`docs/research/FEATURE-PARITY.md` - user duyệt "làm hết" cả 9 mục thiếu
hẳn + 5 mục cần nâng cấp.

## Phạm vi

### A. Màn mới (9)
1. `/profile` - hồ sơ cá nhân cho mọi role nhân sự (xem/sửa phone, avatar;
   hiển thị role, trường, lớp chủ nhiệm).
2. `/portal/student` bổ sung: Lịch học tuần (timetable theo lớp), chuỗi
   chuyên cần (số ngày đi học liên tiếp), Khen thưởng (conduct_records
   khen_thuong), Học bạ điện tử (ĐTBm môn + hạnh kiểm + xếp loại cả năm).
3. `/school/students` - BGH/PHT xem toàn bộ HS trường (lọc lớp, tìm tên).
4. `/school/users` - BGH quản lý tài khoản GV trong trường (đổi role,
   campus, department).
5. `/school/strategy` - KPI/mục tiêu cấp trường (bảng `school_kpis` mới).
6. `/school/equipment` - thiết bị số & CSVC (bảng `equipment` mới, CRUD).
7. `/school/nq37` - ma trận định mức biên chế: số GV/lớp thực tế vs chuẩn
   NQ37 (TH 1.5, THCS 2.25 GV/lớp), tỷ lệ support_staff đạt chuẩn.
8. `/school/journals` - PHT/BGH xem sổ đầu bài toàn trường/phân hiệu.
9. `/dept/wards` + `/dept/reports` + `/dept/facilities` - danh sách đơn vị
   con, báo cáo tổng hợp, CSVC tổng hợp.
10. `/schedule/manage` - BGH xếp/sửa TKB (thêm/xoá/sửa timetable_entries).

### B. Nâng cấp (3)
- `announcements` thêm `school_id` - thông báo toàn trường; portal PH/HS
  đọc cả thông báo trường.
- `/school/approvals` hoặc `/school/users` - BGH quản tài khoản GV.
- Exam-analytics cấp trường trong `/school/exam-analytics` (mục A).

### C. Schema
- `equipment` (school_id, campus_id, name, category, quantity, condition,
  note) + RLS school-scope.
- `school_kpis` (school_id, period, title, target, actual, unit, status,
  note) + RLS school-scope.
- `announcements.school_id` (nullable) + portal query mở rộng.
- `timetable_entries` - kiểm tra/đảm bảo policy cho bgh write.

## Acceptance
- Mọi route mới có requireRoles đúng, truy cập được qua nav, render đúng
  data thật, mutation verify trong DB.
- Không phá luồng cũ; typecheck/lint/build/consistency PASS;
  Playwright verify trên production.

## Implementation record (Developer)

| Mục | Route | Ghi chú |
|---|---|---|
| Hồ sơ GV | `/profile` | Tất cả staff roles; xem role/trường/cơ sở/tổ/lớp CN/môn dạy; sửa phone qua `updateMyProfile` |
| Hồ sơ + lịch tuần + streak HS | `/portal/student` | Card hồ sơ đầy đủ (dob/gender/national_id/address), lịch tuần từ `timetable_entries`, streak từ `attendance_records` (ngày có bản ghi liên tiếp present/late), thông báo toàn trường trong feed |
| Học bạ điện tử HS | `/portal/student/hoc-ba` | TT22: ĐTBm HK1/HK2/cả năm; môn nhận xét hiện Đạt/Chưa đạt; chi tiết điểm TP; hạnh kiểm; tổng hợp chuyên cần |
| Strategy/KPI trường | `/school/strategy` | Bảng `school_kpis`: CRUD chỉ tiêu, period linh hoạt, target/actual/unit, 4 trạng thái; roles bgh+pht |
| Thiết bị & CSVC | `/school/equipment` | Bảng `equipment`: thêm/sửa tình trạng/xoá (xoá chỉ bgh+ke_toan), phân bổ theo campus; roles bgh+pht+ke_toan |
| NQ37 | `/school/nq37` | Ma trận định mức: GV/lớp, 7 vị trí hỗ trợ đạt chuẩn, PHT cho phân hiệu; trang chi tiết của ma trận ở `/school/staff` |
| Sổ đầu bài cấp trường/phân hiệu | `/school/journals` | BGH xem toàn trường; PHT tự scope `campus_id`; lọc theo ngày |
| Dept | `/dept/wards`, `/dept/reports`, `/dept/facilities` | Scope theo `org_units` phân cấp (so_gd: toàn tỉnh; phong_gd: con + mình; ubnd: mình); reports tổng hợp lớp/HS/GV/chuyên cần 30N; facilities = campuses + thiết bị hỏng |
| TKB editor | `/schedule/manage` | Grid lớp × (Thứ 2-7 × tiết 1-5); thêm/sửa/xoá; conflict validation server-side: trùng lớp, trùng GV, trùng phòng |
| Tài khoản GV | `/school/users` | BGH đổi role/campus/tổ chuyên môn; RLS `tvc_profiles_admin_update` |
| Thông báo toàn trường | `/school/announce` | `announcements.school_id` + `class_id=null`; policy `ann_family` mở rộng cho HS/PH theo school_id |
| Phân tích thi | `/school/exam-analytics` | Kỳ thi, buổi thi, ĐTB thi (ddg_gk+ddg_ck) theo lớp toàn trường |
| HS toàn trường | `/school/students` | Lọc theo lớp, đủ cột mã/định danh/trạng thái |
| Support staff | `/school/staff` | Đã có sẵn từ trước (NQ37 matrix + CRUD) - giữ nguyên, NQ37 tách báo cáo riêng |

### RLS/policy
- `equipment`, `school_kpis`: staff read same-school (+dept), write scoped role.
- `timetable_entries` `tt_write`: siết lại - thêm `pht`, bắt buộc `scn_class_in_school(class_id)` (trước chỉ check role, không check trường).
- `ann_family`: đọc thông báo trường qua `school_id` (áp dụng từ migration trước).

### Nav
- BGH: +6 mục Quản trị, +2 mục Giám sát; PHT tương tự (không có Tài khoản GV); kế toán +2; dept roles +3; mọi staff role có "Hồ sơ cá nhân".

### Gates
- typecheck PASS, lint 0 warning, build PASS (112 routes), check-consistency ALL PASS (kể cả 2 check vn-sort mới bắt).

### Playwright production verify (2026-09-22)
- BGH: 10/10 route render đúng (profile, users, students, strategy, equipment, announce, journals, exam-analytics, nq37, schedule/manage).
- Mutations: thêm KPI, thêm thiết bị, gửi thông báo trường - tất cả persist vào DB và hiển thị lại trên trang.
- TKB editor: conflict teacher PASS ("Giáo viên đã dạy lớp 8A2 ở khung giờ này"), delete + re-add ô tiết PASS, dữ liệu khôi phục đúng sau test.
- Portal HS: lịch học tuần T2-T7, streak "Đi học liên tiếp", hồ sơ đầy đủ, thông báo trường PASS; `/portal/student/hoc-ba` render TT22 đầy đủ.
- Portal PH: thấy thông báo toàn trường PASS.
- phong_gd: /dept/wards, /dept/reports, /dept/facilities PASS.
- RBAC deny: hoc_sinh→/school/users redirect, phong_gd→/school/strategy redirect, gvcn→/school/users redirect - PASS.
- 0 page errors toàn bộ sweep.
