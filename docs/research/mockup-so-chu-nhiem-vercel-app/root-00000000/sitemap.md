# Sitemap — mockup-so-chu-nhiem.vercel.app

Single-URL SPA (`/`). All navigation is client-side view switching — no real routes.
Below = sidebar structure per role. Format: `Section → sub-screens`.

## GVCN (Giáo viên chủ nhiệm) — 13 sections, ~57 screens

- Dashboard
- I. Hồ sơ lớp học → Tiếp nhận lớp · Upload danh sách học sinh · Chi tiết hồ sơ học sinh · Lịch sử cập nhật hồ sơ · Báo cáo tổng hợp (AI)
- II. Chuyên cần → Điểm danh hàng ngày · Nghỉ học / đi muộn · Thông báo phụ huynh · Theo dõi tình trạng · Lịch sử chuyên cần
- III. Học tập → Nhập / đồng bộ điểm · Phân tích kết quả · Học sinh cần hỗ trợ · Trao đổi với GVBM · Trao đổi phụ huynh · Kế hoạch hỗ trợ & tiến bộ
- IV. Rèn luyện → Nhận xét & vi phạm/khen thưởng · Đánh giá & xếp loại · Trao đổi học sinh
- V. Tư vấn học sinh → Tiếp nhận & phát hiện · Đánh giá mức độ · Chuyển tuyến chuyên gia
- VI. Phụ huynh → Soạn & gửi thông báo · Hộp thư phản hồi · Lịch hẹn trao đổi · Cổng thông tin phụ huynh
- VII. Hoạt động GD → Lập kế hoạch & phê duyệt · Thông báo & đăng ký · Điểm danh & đánh giá
- VIII. An toàn HS → Ghi nhận sự cố · Báo cáo BGH · Theo dõi & nhắc · Lưu trữ & tra cứu
- IX. Sổ chủ nhiệm → Danh sách học sinh & Tổ · Sơ đồ lớp · Lịch sử phiên bản sơ đồ · Upload lịch năm học · Gợi ý công việc (AI) · Kế hoạch tháng / sơ kết tuần · Đăng ký KPI · Ký duyệt sổ chủ nhiệm · Duyệt & khóa sổ học bạ · Xuất sổ · Nhật ký thao tác
- XIII. Thời khóa biểu & Sổ đầu bài → Thời khóa biểu · Sổ đầu bài
- X. Thi đua → Thu thập & tính điểm · Xếp hạng & khen thưởng
- XII. Năng lực GVCN → Tự đánh giá & kế hoạch · Minh chứng & đánh giá cuối năm

## GVBM (Giáo viên bộ môn)

- III. Học tập → Nhập / đồng bộ điểm · Trao đổi với GVCN
- XIII. Thời khóa biểu & Sổ đầu bài

## Tổ trưởng chuyên môn

- Tổ chuyên môn → Trang chủ · Danh sách giáo viên · Duyệt đánh giá năng lực · Sinh hoạt chuyên môn

## BGH (Ban Giám Hiệu)

- Quản trị → Dashboard cấp trường · Radar cảnh báo sớm
- VII. Hoạt động GD · VIII. An toàn HS · IX. Sổ chủ nhiệm · XIII. TKB & Sổ đầu bài · X. Thi đua (school-level views)

## Quản trị viên Sở GD&ĐT

- Quản trị → Quản trị người dùng · Dashboard cấp Sở GD&ĐT · XI. Quản trị dữ liệu

## Phụ huynh / Học sinh

- Portal layout (no sidebar): child/self status cards, notifications, appointments

## Cross-cutting

- Login screen (username/password + demo role select)
- Header: breadcrumb, Ctrl+K quick search, notifications (badge), role switcher, logout
- Sidebar: collapsible, accordion sections
