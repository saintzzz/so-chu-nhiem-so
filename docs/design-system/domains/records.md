# I. Hồ sơ lớp học (`/records/*`)

**Design language**: `Fluent` — theme `.theme-fluent` scoped trên vùng nội dung (xem `../README.md` → "Design language theo domain").

**Vai trò**: GVCN (lớp mình), BGH (toàn trường).
**Routes**: `/records/intake` `/records/upload` `/records/students` `/records/history` `/records/report`

## Mục đích
Tiếp nhận lớp, nhập danh sách học sinh, tra cứu hồ sơ tổng hợp, báo cáo AI.

## Patterns

- **Danh sách lớp** (`intake`): `DataTable` [Lớp, GVCN, Sĩ số, Năm học, Trạng thái, link]. Status badge: `active`=success, `pending`=warning, `archived`=muted.
- **Upload danh sách HS** (`upload`): dropzone dashed + `Chọn file` + `Tải template`. Preview table có cột `Kiểm tra` (Hợp lệ=xanh / lỗi=đỏ inline). Panel "Nhập vào lớp" dưới preview.
  - Cột nhận diện: `ma_hs`, `ma_dinh_danh` (10 số, validate regex), `ho_ten`, `ngay_sinh`, `gioi_tinh`.
- **Chi tiết hồ sơ** (`students` — `StudentsExplorer`): thanh search (tên/mã) + filter lớp dạng pill + bảng expandable. Mở rộng hiển thị 4 panel: Thông tin / Học tập / Chuyên cần / Rèn luyện. **Mã định danh Bộ GD&ĐT** sửa inline (`NationalIdField`).
- **Báo cáo AI** (`report`): label "Phân tích AI" — **không hiển thị tên model/provider**; disclaimer nhỏ phía dưới.

## Dữ liệu nhạy cảm
`national_id` 10 số — font mono, validate `/^\d{10}$/`, nullable.
