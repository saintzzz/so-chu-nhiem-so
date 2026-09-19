# Quản trị — BGH / Sở GD / admin (`/school/*`, `/dept/*`)

**Design language**: `Fluent` — theme `.theme-fluent` scoped trên vùng nội dung (xem `../README.md` → "Design language theo domain").

**Vai trò**: BGH, Sở GD&ĐT, admin.
**Routes**: `/school/dashboard` `/radar` `/assignments` · `/dept/users` `/dashboard` `/data` · `/parents/cmhs` · `/academics/exams`

## BGH

- **Dashboard cấp trường** (`/school/dashboard`): StatCard toàn trường — sĩ số, % chuyên cần, điểm TB, sự cố mở; radar cảnh báo sớm.
- **Phân công năm học** (`/school/assignments`): 3 section — phân công GVCN, GVBM, Tổ trưởng. Mỗi section: header có nút Lưu + bảng phân công.
- **TKB** (`/schedule/timetable`): toolbar template/import — BGH xếp TKB bằng Excel.
- **Ký duyệt sổ CN & khóa sổ học bạ**: toàn trường (khác GVCN chỉ lớp mình).

## Sở GD / admin

- **Quản trị người dùng** (`/dept/users`): bảng profiles — tạo/sửa role, reset mật khẩu; badge role theo `ROLE_LABELS`.
- **Dashboard cấp Sở** (`/dept/dashboard`): KPI toàn sở (nhiều trường) — group theo school.
- **Quản trị dữ liệu** (`/dept/data`): import/export hàng loạt, kiểm tra chất lượng dữ liệu.

## Nguyên tắc
Trang quản trị ưu tiên mật độ thông tin cao + filter mạnh; hành động destructive (xóa user, reset) luôn có confirm.
