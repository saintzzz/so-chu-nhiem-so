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
