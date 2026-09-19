# III. Học tập (`/academics/*`)

**Vai trò**: GVCN, GVBM (môn mình dạy), Tổ trưởng, BGH.
**Routes**: `/academics/grades` `/analysis` `/support` `/teacher-chat` `/parent-chat` `/plans` `/exams`

## Sổ điểm (`/academics/grades` — `GradesEditor`)

Trọng tâm của domain. Hai chế độ theo `schools.level`:

### THCS/THPT (Thông tư 22/2021)

- Cột: STT · Mã định danh · Họ và tên (+ ngày sinh) · ĐĐGtx (nhiều điểm, cách nhau space/phẩy) · ĐĐGgk · ĐĐGck · **ĐTBm tự tính** · Nhận xét.
- Môn đánh giá bằng nhận xét (`assessment_method='comment'`): cột Đánh giá (Đạt/Chưa đạt) + Nhận xét.
- Màu ĐTBm: ≥8 success · ≥6.5 foreground · ≥5 warning · <5 error.

### Tiểu học (TT27)

- Cột: STT · Mã định danh · Họ tên · **Mức GK** (T/H/C) · Nhận xét GK · **Mức CK** · Điểm KTĐK · Nhận xét CK.
- Mức: T = Hoàn thành tốt · H = Hoàn thành · C = Chưa hoàn thành.

### Template / Import (mẫu biểu CSDL ngành)

- Mẫu 1: `STT | Lớp | Mã định danh Bộ GD&ĐT | Họ và tên | Ngày sinh | ĐĐGtx1..5 | ĐĐGgk | ĐĐGck | Nhận xét` — prefill toàn bộ lớp.
- Mẫu nhận xét môn: `STT | Mã định danh | Họ tên | Ngày sinh | Đánh giá | Nội dung nhận xét`.
- Import map cột **theo tên header** — chấp nhận cả mẫu ngành lẫn template nội bộ cũ; match HS theo national_id → code → tên+dob; báo dòng không khớp.
- **Xuất Mẫu 3** (`ClassReportExport`, filter bar): ma trận lớp × tất cả môn + KQ rèn luyện + KQ học tập. KQ học tập: ĐTB tất cả môn → Tốt≥8 / Khá≥6.5 / Đạt≥5 / Chưa đạt<5.

## Các trang khác

- `analysis`: StatCard KPI + bảng phân bố điểm; biểu đồ nếu có.
- `support`: danh sách HS cần hỗ trợ (ĐTB thấp / chuyên cần kém) — badge mức độ.
- `teacher-chat`/`parent-chat`: giao diện chat 2 cột (danh sách + khung tin nhắn).
- `plans`: bảng kế hoạch với status flow draft→active→done.
- `exams`: panel "Thêm buổi thi" (form + template/import) **trên** bảng buổi thi.
