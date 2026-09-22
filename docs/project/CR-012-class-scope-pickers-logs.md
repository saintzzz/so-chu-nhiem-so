# CR-012: Phạm vi lớp, bộ chọn học sinh/phụ huynh, hợp nhất nhật ký

## Nguồn
Feedback user sau CR-011 - 7 lỗi trải nghiệm GVCN/BGH khi thao tác trên
nhiều lớp chủ nhiệm và lớp đang dạy.

## Root cause (đã audit code + reproduce production)
1. `getAccessibleClasses` trả đủ lớp CN nhưng các trang register
   (roster/seating/signoff/lock-records/kpi/plans/suggestions/
   seating-history) **không render class chips** → không đổi lớp được.
2. `/conduct/student-chat` chỉ liệt kê HS có `profile_id` (tài khoản) →
   lớp 32 em chỉ thấy 1 em; không có lọc lớp.
3. `/schedule/timetable`: `ownCls` dùng `.limit(1)` và `visibleClasses =
   [ownCls]` → chỉ hiện 1 lớp CN đầu tiên.
4. `/schedule/period-log`: trộn tiết của tất cả lớp CN theo giờ, không
   filter lớp, không sort theo lớp.
5. `/academics/support` + `/academics/plans`: tạo kế hoạch hỗ trợ từng
   HS một; không chọn được nhiều HS cùng lúc.
6. `/academics/parent-chat`: chỉ hiện PH có tài khoản; không rõ nguồn
   dữ liệu (parents + parent_students); không lọc lớp; CRUD PH nằm
   giấu trong roster.
7. Nhật ký thao tác (`/register/audit`) và Lịch sử cập nhật hồ sơ
   (`/records/history`) là 2 menu riêng, không có filter.

## Phạm vi sửa
### A. Class scope & picker
- `getAccessibleClasses`: GVCN/GVBM nhận cả lớp chủ nhiệm và lớp có
  tiết dạy (timetable_entries.teacher_id); trả kèm cờ `isHomeroom`.
- Class chips (giữ `?class=` + params hiện có) trên mọi trang register
  đang thiếu.
- `/schedule/timetable`: bỏ limit(1); GVCN thấy chips tất cả lớp CN +
  lớp dạy + view "Lịch của tôi".
- `/schedule/period-log`: thêm filter lớp (chips) + sort lớp→tiết.

### B. Bộ chọn học sinh / phụ huynh
- `/conduct/student-chat`: chips lọc lớp + list đầy đủ HS của lớp; HS
  chưa có tài khoản hiển thị badge "Chưa có tài khoản" (không click
  được) thay vì biến mất.
- `/academics/parent-chat`: chips lọc lớp + list mọi PH đã liên kết HS
  (kể cả chưa có tài khoản, badge "Chưa có tài khoản") + nút đi tới
  phần liên kết PH trong roster.
- `/academics/support`: checkbox chọn nhiều HS trong bảng HS yếu +
  nút "Tạo kế hoạch cho N em" (bulk insert support_plans, bỏ qua cặp
  đã có plan).

### C. Nhật ký hợp nhất
- `/register/audit` nâng thành "Nhật ký & lịch sử": filter loại
  (thao tác / đổi hồ sơ HS), filter đối tượng (entity), filter người
  thao tác; `/records/history` redirect về đây với type=student_record.
- Nav: gộp 2 mục thành 1 "Nhật ký & lịch sử".

## Acceptance
- GVCN demo thấy đủ 2 lớp CN + lớp dạy trên roster/seating/TKB/
  period-log; đổi lớp đổi đúng data.
- student-chat: chọn lớp → list HS đủ; HS không tài khoản có badge.
- parent-chat: chọn lớp → PH theo lớp; PH không tài khoản có badge +
  link sang roster.
- support: tick nhiều HS → bulk tạo plan, verify DB.
- audit: 1 menu, filter loại/entity hoạt động; records/history
  redirect đúng.
- Gates: typecheck/lint/build/consistency PASS + Playwright prod.

## Implementation (đã hoàn thành)
- `server-utils.getAccessibleClasses`: GVCN/GVBM trả lớp CN + lớp đang
  dạy (timetable_entries.teacher_id), sort tên lớp `vi`.
- Class chips (`<ClassChips>`) trên roster, seating, kpi, plans,
  suggestions, seating-history. signoff/lock-records đã aggregate đa
  lớp nên tự hưởng scope mới.
- Timetable: bỏ `.limit(1)`, `ownClasses[]` + `taughtIds` →
  `visibleClasses` = CN ∪ dạy cho GV; badge `(CN)` theo từng lớp.
- Period-log: `?class=` chips (Tất cả + từng lớp), giữ `date` khi đổi
  lớp; GVCN xem cả tiết mình dạy ngoài lớp CN (`or` query); sort
  lớp→tiết (localeCompare vi).
- student-chat: chips lớp; list đủ HS lớp đã chọn; HS chưa có tài
  khoản hiển thị mờ badge "Chưa có tài khoản", không click được;
  fix thêm scope school cho BGH (trước query toàn hệ thống).
- parent-chat: chips lớp; list mọi PH của HS lớp; PH chưa có tài
  khoản hiển thị badge + phone/email; empty state link sang roster.
- support: `SupportPlanBoard` checkbox + bulk "Tạo kế hoạch cho N
  mục" qua server action `createSupportPlans` (checkActionRole, verify
  school + lớp phụ trách + subject thuộc trường, skip cặp đã có plan,
  ghi audit). Xoá SupportPlanButton client-insert.
- `/register/audit` = "Nhật ký & lịch sử" gộp 2 tab: audit_logs +
  student_record_history; filter loại/lớp/HS/người/khoảng ngày/
  trường dữ liệu; pagination giữ params. `/records/history` redirect.
  Pagination nâng cấp thành link thật (trước là text chết); nav gộp
  1 mục "Nhật ký & lịch sử" + thêm cho BGH.

## Gates
- typecheck PASS, lint 0 warnings, build PASS, consistency ALL PASS.
- Playwright production: xem QA log trong commit message / báo cáo.

## QA production (2026-09-22, Playwright + DB)
- roster/seating: 9 class chips (2 CN + 7 lớp dạy) ✓
- timetable GVCN: 9 chips, badge (CN) trên 6A3 + 8A2 ✓
- timetable GVBM: 8 chips (chỉ lớp dạy, trước thấy cả trường) ✓
- student-chat: chips 6A3/8A2; 6A3 = đủ 32 HS, 31 badge "Chưa có
  tài khoản", 1 HS có tài khoản click được + thread render ✓
- period-log: chips "Tất cả" + 5 lớp có tiết, giữ ?date khi đổi lớp,
  filter 6A3 chỉ còn tiết 6A3 sort theo tiết ✓
- support: hủy plan cũ → tick checkbox → "Tạo kế hoạch cho 1 mục" →
  DB có row pending mới + audit_logs ghi support_plans.create;
  duyệt + triển khai lại về trạng thái ban đầu ✓
- parent-chat: chips lớp; đủ 32 PH, badge + phone/email; empty-state
  link sang roster ✓
- audit gộp: 2 tab, filter actor/date/q (audit) + class/student/
  field (records); /records/history redirect ?type=records;
  Pagination render link thật; nav chỉ còn "Nhật ký & lịch sử" ✓
- RBAC deny: GVBM vào /register/audit + /conduct/student-chat đều
  redirect về /academics/grades ✓
- Console: 0 errors ✓
