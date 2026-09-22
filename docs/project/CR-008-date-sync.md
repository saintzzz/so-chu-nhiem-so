# CR-008 - Đồng bộ điều hướng ngày + Dashboard xem theo ngày/khoảng ngày

## Nguồn
Báo lỗi của người dùng sau đợt dense-data QA: "dashboard chưa có xem theo ngày,
chọn ngày, khoảng ngày; form điểm danh có nút mũi tên switch ngày nhưng data
không update theo".

## Phân tích nguyên nhân (audit code)

| # | Lỗi | Nguyên nhân gốc |
|---|---|---|
| 1 | `/attendance/daily` đổi ngày không cập nhật | `DailyRoster` giữ `statuses` trong `useState` khởi tạo từ props; page không truyền `key` nên React giữ nguyên instance, state cũ không reset khi `?date=` đổi |
| 2 | `/attendance/daily-report` cùng lỗi | `DailyReportForm` khởi `content/status` từ props, không `key` |
| 3 | `/register/seating` đổi lớp không cập nhật | `SeatingGrid` giữ `cells/cols/rows` từ props, không `key` |
| 4 | `ClassChips` mất query params | Chips chỉ build `?class=X` - đổi lớp mất `?date=`/`?from=`/`?to=` |
| 5 | `/schedule/period-log` không có UI chọn ngày | `?date=` chỉ đổi được bằng tay; `DEFAULT_DATE` hardcode |
| 6 | Dashboard không xem theo ngày/khoảng | Không đọc `searchParams`; thẻ chuyên cần luôn neo ngày có data gần nhất |

## Phạm vi
- Thêm `key` chống stale-state cho các board client: DailyRoster,
  DailyReportForm, SeatingGrid, PeriodLogBoard (theo convention đã có ở
  GradesEditor/EvaluationEditor).
- `ClassChips` nhận `params` giữ query khi đổi lớp.
- `period-log`: thêm `AttendanceDateNav` (date picker + nút ‹ ›).
- Dashboard: `?date=` (một ngày, mặc định ngày có data gần nhất) và
  `?from=&to=` (khoảng ngày) - thẻ chuyên cần + tỷ lệ phản ánh đúng lựa chọn;
  thanh điều khiển mới `DashboardDateBar`.

## Acceptance criteria
- Điểm danh: bấm ‹ › hoặc chọn ngày → danh sách trạng thái đổi theo ngày
  (verify bằng DB); đổi lớp giữ nguyên ngày đang xem.
- Dashboard: `?date=2026-09-21` hiện số liệu 21/9; `?from=..&to=..` hiện tổng
  hợp khoảng; ‹ › và date input hoạt động.
- Sổ đầu bài: chọn ngày qua UI, không cần gõ URL.
- Sơ đồ lớp: đổi lớp → sơ đồ lớp mới render đúng.
- Không regression: consistency check, typecheck, lint, build green;
  Playwright verify trên production.
