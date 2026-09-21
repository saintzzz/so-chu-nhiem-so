# CR-002: Cổng phụ huynh tương tác 2 chiều

**Trạng thái:** Approved (user duyệt "CR cả 3 tính năng" qua Q&A 20/09/2026)
**Nguồn:** Production rehearsal phát hiện portal PH hoàn toàn read-only - `appointments` không có writer, PH không reply được `messages`, không đăng ký HĐGD.
**Ngày:** 2026-09-20

## 1. Phạm vi thay đổi (đã duyệt)

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 1 | PH đặt lịch hẹn | Form trên portal: chọn GVCN lớp con, ngày giờ, mục đích -> `appointments` status `pending`. GV xem/xác nhận ở `/parents/appointments` (đã có). |
| 2 | PH trả lời tin nhắn | Inbox trên portal: đọc tin GVCN gửi + reply -> `messages` + `notifications` cho GV. |
| 3 | PH đăng ký HĐGD | Xem hoạt động `announced` của lớp con -> đăng ký -> `activity_attendance` status `registered`. |

## 2. Impact Assessment

### Data model / RLS (migration `parent_engagement`)
- `appointments`: thêm policy `appt_parent_ins` - INSERT check `parent_id IN (own parents) AND student_id IN (my_student_ids())`, status mặc định `pending`.
- `activity_attendance`: thêm policy `aa_family_ins` - INSERT check `student_id IN (my_student_ids())`; upsert theo (activity_id, student_id) để đăng ký/hủy.
- `messages`: `msg_send` đã cho mọi user gửi as self - không đổi RLS.
- `notifications`: dùng insert hiện có.

### Ảnh hưởng module hiện có
- `src/app/portal/parent/page.tsx`: thêm 3 section tương tác (client components) - trước đây 0 form.
- Server actions mới trong `src/app/portal/parent/actions.ts`: `bookAppointment`, `replyToTeacher`, `registerActivity` - role `phu_huynh`.
- `/parents/appointments` (GVCN): hiện thêm status `pending` + nút xác nhận (đã có `updateAppointmentStatus`).
- Notifications: appointment mới -> GVCN; reply -> GVCN; đăng ký HĐ -> GVCN.

### Không phá vỡ
- Các bảng chỉ thêm policy/insert path mới; SELECT hiện có giữ nguyên.
- Teacher-side views không đổi schema.

## 3. Estimate
~0.5 ngày: 3 server actions + 3 client components + 1 migration + E2E verify.

---

## Trạng thái triển khai (2026-09-21)

DONE - đã lên production và verify E2E. Chi tiết: `docs/qa/QA-CR002-003.md`.
