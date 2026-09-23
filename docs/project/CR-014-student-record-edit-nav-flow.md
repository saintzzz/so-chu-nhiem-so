# CR-014 - Sửa hồ sơ học sinh trực tiếp + sắp xếp menu theo business flow

Date: 2026-10-12 · Reporter: user · Priority: medium

## Findings

1. **Ai sửa hồ sơ HS?** Hiện chỉ có `NationalIdField` (mã định danh) sửa inline client-side trên `/records/students`; không có form sửa họ tên/ngày sinh/giới tính/địa chỉ. RLS `students_staff_upd` cho **mọi school staff** ghi - quá rộng (GVBM cũng sửa được). Không ghi `student_record_history` khi sửa.

2. **Menu trái** chưa theo business flow: GVCN nhóm "Quản lý học sinh" đứng trước "Chuyên cần" (điểm danh là việc đầu ngày), "Sổ chủ nhiệm" trộn lẫn đầu năm/cuối kỳ; BGH có 1 nhóm "Quản trị" 17 mục không chia luồng.

## Đề xuất (đã chốt với user: "đề xuất và implement luôn")

### 1. Quyền sửa hồ sơ HS

| Role | Phạm vi | Căn cứ |
|---|---|---|
| GVCN | HS lớp chủ nhiệm mình | ROLE-MATRIX `records/* = gvcn` + Điều 27 Điều lệ (GVCN phụ trách hồ sơ lớp) |
| BGH | HS toàn trường | `records/* = bgh` (giám sát + sửa sai) |
| GVBM, tổ trưởng, PHT, kế toán | chỉ xem | siết RLS |

- Trường sửa: `full_name, code, dob, gender, address, national_id`. `status`/`class_id` (chuyển lớp, chuyển trường) giữ cho flow riêng - không mở trong form này.
- Server action `updateStudentRecord`: checkActionRole, verify sở hữu lớp/trường, diff từng trường -> ghi `student_record_history` + `audit_logs`.
- UI: nút "Sửa hồ sơ" trong panel expand của `/records/students` (gvcn + bgh) và nút "Sửa" mỗi hàng roster (gvcn).
- Siết RLS `students_staff_upd/ins`: gvcn chỉ lớp `gvcn_id = self`, bgh/admin theo trường. `del` giữ bgh/admin.

### 2. Menu theo business flow

**GVCN** (thứ tự ngày làm việc -> định kỳ):
1. Dashboard
2. Chuyên cần (đầu ngày: điểm danh -> báo cáo BGH -> nghỉ/muộn -> thông báo PH -> theo dõi -> lịch sử)
3. Giảng dạy & học tập (trong ngày: TKB -> sổ đầu bài -> điểm -> giáo án -> kỳ thi -> phân tích -> hỗ trợ -> trao đổi GVBM)
4. Quản lý học sinh (hồ sơ lớp)
5. Phụ huynh & hoạt động
6. Tư vấn & an toàn
7. Thi đua & năng lực
8. Sổ chủ nhiệm (định kỳ: đầu năm -> cuối kỳ -> hệ thống)

**BGH**: tách "Quản trị" 17 mục -> 4 nhóm: Điều hành / Nhân sự & tổ chức / Học sinh & chất lượng / Giám sát & truyền thông.

**PHT**: mirror BGH theo scope phân hiệu.

## Impact assessment

- RLS siết 3 policy `students_*` - GVBM mất quyền ghi students (đúng matrix; không UI nào của GVBM ghi students).
- `student_record_history` bắt đầu có data -> tab "Lịch sử cập nhật hồ sơ" trên `/register/audit` có nội dung.
- Nav: chỉ đổi thứ tự/nhóm, không đổi route.

## Estimate

~0.5 ngày: server action + editor component + 2 chỗ nhúng + migration + nav + verify.

## Ket qua implement + verify production

- Editor modal trong panel expand `/records/students` - GVCN thay dia chi "Nguyen Van An" -> DB update + `student_record_history` ghi dung old/new + editor. GVBM vao route -> redirect `/academics/grades`.
- Scope: GVCN chi thay lop `gvcn_id = self` (UI) + RLS + server action double-check.
- Nav verify: GVCN nhom theo flow ngay lam viec; BGH 4 nhom (Dieu hanh / Nhan su & to chuc / Hoc sinh & chat luong / Giam sat & phe duyet).

### Bug phat hien khi verify: RLS de quy vo han

- Loi: "infinite recursion detected in policy for relation students".
- Root cause: `classes_parent_student` (SELECT tren classes) query nguoc `students`. Inline `exists(select classes)` trong policy students/emulation_scores chay quyen user -> classes RLS -> query students -> students RLS -> `scn_class_in_school` ... lap vo han.
- Fix: function `scn_is_my_homeroom_class(cid)` SECURITY DEFINER (bypass RLS nhu `scn_class_in_school`) - ap dung cho ca students va emulation_scores.
- Verify sau fix: edit HS persist, emulation save OK, khong con loi recursion.
