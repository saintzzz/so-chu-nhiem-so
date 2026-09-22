# CR-009 - Giáo án đính kèm, lịch sự kiện ra portal, chế độ tuyên dương, tài khoản demo & tinh gọn menu

## Nguồn
5 yêu cầu từ user sau khi dùng thử hệ thống + so sánh với
https://school-management-red-one.vercel.app (demo nghiệp vụ trường phổ thông).

## Phân tích hiện trạng

### 1. Duyệt giáo án không thấy nội dung
- `lesson_plans` chỉ có cột `content` (text). Không có file đính kèm.
- Form nộp đã bắt buộc content, nhưng màn tổ trưởng `/team/lesson-plans` chỉ
  hiện bảng 1 dòng/giáo án - nội dung nằm sau nút "Xem" trong ô `max-w-md`
  nhỏ => trông như "không có nội dung gì".
- Yêu cầu: giáo án nộp phải có nội dung/file đính kèm; người duyệt phải thấy
  rõ nội dung trước khi duyệt.

### 2. Lịch sự kiện upload nhưng HS/PH không thấy
- `school_year_events` (15 bản ghi) chỉ hiển thị ở `/register/year-events`
  (trang upload của GVCN). Portal phụ huynh/học sinh không render => dữ liệu
  chết.
- Fix: hiển thị lịch sự kiện năm học trên portal PH + HS.

### 3. Chế độ Tuyên dương trong sơ đồ lớp "không hoạt động"
- Nguyên nhân: `praisedIds` dựa trên `students.positive_points`, mà cột này
  toàn 0 vì nút +/− điểm trong sổ đầu bài (CR-004) chỉ ghi `conduct_records`,
  không cập nhật `positive_points` (chỉ roster "Ghi nhận" cập nhật).
- Fix: đồng bộ `positive_points` khi +/− trong sổ đầu bài + backfill từ
  `conduct_records` hiện có + hiện thông báo khi chưa có HS tích cực.

### 4. Danh sách tài khoản demo
- Dropdown login có 22 entries, nhiều trùng role. Giảm còn 1 tài khoản/role.

### 5. Menu quá nhiều
- GVCN hiện 13 nhóm / 55 mục. Site tham chiếu: 5 nhóm / ~13 mục cho GVCN,
  4 nhóm / ~26 mục cho BGH.
- Cần gộp nhóm, giấu bớt màn phụ thành tab/link trong trang mẹ.

## Phạm vi đề xuất (chờ confirm qua Q&A)
- Giáo án: bắt buộc nội dung HOẶC file đính kèm khi nộp; màn duyệt hiện sẵn
  nội dung (expand mặc định / panel chi tiết); chặn duyệt giáo án trống.
- Portal: section "Lịch sự kiện năm học" trên portal PH + HS.
- Tuyên dương: sync positive_points từ sổ đầu bài + backfill + empty state.
- Login: dropdown demo 1 tài khoản/role.
- Nav: gộp theo mô hình tham chiếu (xem đề án trong Q&A).

## Acceptance criteria
- Tổ trưởng mở giáo án thấy ngay nội dung/file; giáo án rỗng không nộp/duyệt được.
- Portal HS/PH hiển thị lịch sự kiện đã upload.
- Bật Chế độ Tuyên dương tô sáng HS có điểm >0; không có ai thì báo rõ.
- Login dropdown còn 1 tài khoản/role.
- Menu GVCN gọn lại theo cấu trúc tham chiếu; mọi route cũ vẫn truy cập được
  (không xoá chức năng, chỉ tinh gọn điều hướng).

## Kết quả triển khai (commit 6bffd7c)

### 1. Giáo án kèm file đính kèm
- `lesson_plans` thêm `file_path`, `file_name` (migration
  `20260922_cr009_lesson_plan_files.sql`).
- Bucket private `lesson-plans` + 3 RLS policies theo trường
  (path prefix = school_id): select cho cùng trường, insert cho
  gvcn/gvbm/to_truong/bgh/pht, delete cho gvcn/gvbm/bgh.
- Form nộp: input file (docx/pdf/ảnh/pptx/xlsx) + nội dung; bắt buộc
  ít nhất 1 trong 2. Upload client-side vào `lesson-plans/{schoolId}/{uuid}-{name}`.
- Màn duyệt (tổ trưởng/BGH): panel chi tiết rộng, hiện nội dung +
  link file ký `lessonPlanFileUrl` (1 giờ, role-checked).
- Verify production: nộp "CR009 - Giao an kem file test" qua UI → row có
  file_path/file_name, object tồn tại trong bucket; tổ trưởng expand thấy
  nội dung + link file, mở được signed URL.

### 2. Lịch sự kiện năm học trên portal
- `/portal/student` và `/portal/parent` thêm card "Sự kiện năm học":
  query `school_year_events` theo `school_id`, chỉ sự kiện từ hôm nay trở đi,
  tối đa 12, hiển thị ngày + tiêu đề + category chip.
- Verify: cả 2 portal render section đúng (Playwright production).

### 3. Chế độ Tuyên dương sơ đồ lớp
- `period-log-board` +/- giờ đồng bộ `students.positive_points`
  (read-modify-write; RLS `students_staff_upd` đã cho phép school staff).
- Backfill: 22 HS có điểm >0 từ `conduct_records` khen_thuong hiện có.
- `seating-grid` thêm empty-state rõ ràng khi praise mode không có HS nào.
- Verify: bật Tuyên dương trên production tô sáng được HS có điểm.

### 4. Dropdown tài khoản demo
- 22 → 15 tài khoản, 1 tài khoản/role, 3 `<optgroup>`:
  Trường THCS (8), Trường tiểu học (4 - giữ block riêng), Cấp quản lý (3).

### 5. Nav tinh gọn
- GVCN: 13 nhóm → 8 nhóm (Quản lý học sinh / Chuyên cần / Giảng dạy & học tập /
  Phụ huynh & hoạt động / Tư vấn & an toàn / Sổ chủ nhiệm / Thi đua & năng lực +
  Dashboard). Màn ít dùng (audit, lịch sử phiên bản, AI gợi ý, KPI, portal PH
  xem-trước...) xếp cuối nhóm Sổ chủ nhiệm - vẫn truy cập được, không xoá route.
- GVBM 3→2, BGH 5→2, PHT 3→2 nhóm. Section icons cập nhật theo nhãn mới.

## Gates
- typecheck PASS, lint PASS (0 warnings), build PASS, check-consistency ALL PASS.
- Playwright production: 0 pageerror/console error trong luồng verify.
