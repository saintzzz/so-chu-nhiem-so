# CR-003: Bề mặt toàn vẹn dữ liệu (audit log, tổ học sinh, liên kết PH-HS)

**Trạng thái:** Approved (user duyệt "Viết audit hook" + "Fix hết tất cả" qua Q&A 20/09/2026)
**Nguồn:** Production rehearsal phát hiện `audit_logs` không có writer (trang nhật ký luôn trống); `student_groups` và `parent_students` có RLS insert nhưng không có UI -> 5 HS lớp 6A3 không tổ, không PH.
**Ngày:** 2026-09-20

## 1. Phạm vi thay đổi (đã duyệt)

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 1 | Audit writer | Helper `logAudit(action, entity, entityId, payload)`; wire vào các server action mutation quan trọng: seating, KPI, year-events, ký sổ, khóa sổ, tạo lớp, import HS/TKB, phê duyệt, sự cố. |
| 2 | Tạo tổ học sinh | Trên roster (`/register/roster`): nút "Thêm tổ" + gán HS vào tổ -> `student_groups` + `students.group_id`. |
| 3 | Liên kết PH-HS | Trên roster/chi tiết HS: chọn parent hiện có (hoặc tạo parent record tối thiểu name+phone+email, không auth) -> insert `parent_students`. |

## 2. Impact Assessment

### Data model / RLS
- Không đổi schema. `sg_staff_ins`, `ps_staff_ins`, `audit_insert` đã tồn tại.
- `parents` insert: cần policy cho staff (hiện chỉ có đọc theo school) - thêm `parents_staff_ins` nếu thiếu.

### Ảnh hưởng module hiện có
- `src/lib/audit.ts` mới + gọi trong các action hiện có (không đổi signature trả về).
- Roster page: thêm section quản lý tổ + panel liên kết PH.
- Trang `/register/audit` bắt đầu có data thật.

### Không phá vỡ
- Audit insert là fire-and-forget sau mutation chính - lỗi audit không fail business action.
- Group/parent link là write-path mới, không đổi read path hiện có.

## 3. Estimate
~0.5 ngày: helper + wire ~10 actions + 2 UI block + verify.
