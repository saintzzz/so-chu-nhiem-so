# CR-004: Chuyên cần theo ngày + sổ điểm cá nhân + sửa UX

**Ngày:** 2026-09-21
**Nguồn:** feedback trực tiếp của user trên production (2 ảnh chụp dashboard GVCN + phần đánh dấu vắng trong sổ đầu bài).

## 1. Phạm vi thay đổi (8 mục)

| # | Mục | Loại | Mô tả |
|---|-----|------|-------|
| 1 | Điểm danh: thẻ "Có mặt" + chọn ngày | UX + feature | Summary counters thêm thẻ "Có mặt"; cho phép chọn ngày để xem/sửa điểm danh ngày cũ (hiện khoá vào ngày gần nhất có data) |
| 2 | Chọn ngày/khoảng cho thống kê chuyên cần | feature | Các màn liên quan điểm danh (tracking, leaves, history, daily-report, dashboard cards) cho chọn ngày hoặc khoảng thời gian |
| 3 | Sơ đồ chỗ ngồi: thêm hàng/cột | feature | SeatingGrid hiện cố định cols/rows từ layout - thêm control thêm/bớt hàng, cột |
| 4 | Card "Đi muộn" hiện 0 | UX/bug | Dashboard chỉ đếm `late` của TODAY - khi hôm nay chưa điểm danh, thẻ hiện 0 dù ngày trước có HS muộn. Cần rõ scope ngày (xem mục 2) |
| 5 | Cộng điểm rèn luyện | feature | Form ghi nhận đã có ô Điểm (+/−) nhưng không có nơi xem tổng điểm rèn luyện của HS; cần surface tổng điểm + link vào xếp loại hạnh kiểm |
| 6 | Sổ đầu bài: tách trường | schema + UX | `period_logs.note` tách thành `lesson_title`/`lesson_content` (tên + nội dung bài học) và `teacher_comment` (nhận xét của GV) |
| 7 | Mất tên HS khi thu nhỏ | bug | Phần đánh dấu vắng/muộn trong sổ đầu bài: `truncate` + `min-w-0` ép tên còn 1 ký tự trên màn hẹp |
| 8 | Sổ điểm cá nhân giáo viên | feature lớn | Đổi từ nhập tổng hợp (1 ĐĐGtx/1 ĐĐGgk/1 ĐĐGck) sang sổ điểm GVBM thật: nhiều cột điểm miệng, KT 15 phút, KT 1 tiết (ĐĐGtx hệ số 1, lặp được), ĐĐGgk ×2, ĐĐGck ×3; ĐTBm tính theo hệ số |

## 2. Impact Assessment

### Data model
- `grades`: đã có `seq` + `assessment_type` - hỗ trợ sẵn nhiều dòng ĐĐGtx, **không cần migration**. Cần quy ước sub-type (miệng/15ph/1tiết) - đề xuất dùng `comment` hoặc thêm `subtype` text.
- `period_logs`: thêm cột `lesson_title`, `teacher_comment`; giữ `note` cho backward-compat hoặc migrate `note` -> `teacher_comment`.
- `attendance_records`: không đổi schema - chỉ thêm query param date.

### Code ảnh hưởng
- `components/attendance/daily-roster.tsx`: thêm thẻ Có mặt + date picker + load/save theo ngày chọn.
- `app/(app)/attendance/{tracking,leaves,history,daily-report}`: date/date-range param + UI selector (pattern ClassChips).
- `app/(app)/dashboard/page.tsx`: cards chuyên cần theo ngày được chọn (default hôm nay, fallback ngày gần nhất có data).
- `components/register/seating-grid.tsx`: controls +/− hàng/cột, lưu layout.
- `components/schedule/period-log-board.tsx`: tách 2 field, sửa truncate tên (bug 7), cập nhật collapsed summary hiển thị lesson_title.
- `components/conduct/record-form.tsx` + trang xếp loại: hiển thị tổng điểm rèn luyện/HS.
- `components/academics/grades-editor.tsx`: redesign lớn nhất - cột điểm động theo loại (miệng/15p/1tiết/GK/CK), thêm/xoá cột, ĐTBm live đúng hệ số. Giữ import/export.
- `lib/tt22.ts`: `semesterAverage` đã đúng hệ số - kiểm tra lại khi nhiều dòng gk/ck (hiện giả định 1 giá trị mỗi loại).
- Portal PH/HS: điểm chi tiết nhiều cột hiển thị tương thích (ĐTBm không đổi cách tính).
- RLS: grades RLS hiện theo student/school scope - không đổi.

### Không phá vỡ
- ĐTBm/ĐTBcn công thức TT22 giữ nguyên; chỉ tăng số dòng điểm thành phần.
- Export sổ điểm phải xuất đủ các cột điểm thành phần.

## 3. Estimate

~1.5-2 ngày: sổ điểm động ~0.75d, chọn ngày/khoảng chuyên cần ~0.5d, seating + period-log + 2 bug nhỏ ~0.5d.
