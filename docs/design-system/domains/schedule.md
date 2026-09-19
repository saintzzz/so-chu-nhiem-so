# XIII. Thời khóa biểu & Sổ đầu bài (`/schedule/*`)

**Design language**: `Fluent` — theme `.theme-fluent` scoped trên vùng nội dung (xem `../README.md` → "Design language theo domain").

**Vai trò**: mọi giáo viên + BGH (xem); **BGH/admin** (ghi).
**Routes**: `/schedule/timetable` `/period-log`

## TKB (`timetable`)

- Lưới **Tiết (1-5) × Thứ (2-7)** per lớp — cell: tên môn (bold) + GV + phòng (text-xs muted).
- Filter pill lớp ở header; BGH thấy toolbar `Template lớp này` / `Template toàn trường` / `Import Excel`.
- Template lưới: hàng=tiết, cột=thứ, cell `Môn | Giáo viên | Phòng`. Template toàn trường: dạng danh sách `Lớp | Thứ | Tiết | Môn | GV | Phòng`.
- Import upsert trên `(class_id, weekday, period)` — ghi đè ô trùng, giữ ô không có trong file.
- GVCN nhiều lớp: query `.in(class_id, [...])`, hiển thị kèm tên lớp từng entry.

## Sổ đầu bài (`period-log`)

- Danh sách tiết hôm nay theo thứ tự — mỗi dòng: tiết, lớp, môn, GVBM, phòng, tiết nội dung, chữ ký.
- GVCN 2 lớp thấy tiết của cả 2 (sort theo tiết rồi tên lớp).
