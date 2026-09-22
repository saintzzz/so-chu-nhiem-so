# CR-010: Dashboard theo nhiều lớp + date controls đồng bộ hiển thị

## Vấn đề báo cáo
1. Dashboard chỉ hiển thị số liệu của 1 lớp chủ nhiệm đầu tiên
   (`classes.eq(gvcn_id).limit(1)`) - GVCN chủ nhiệm/dạy nhiều lớp không xem
   được các lớp còn lại.
2. Ô chọn ngày/khoảng ngày không cập nhật giá trị hiển thị khi URL đổi:
   `<input type="date" defaultValue=...>` là uncontrolled - bấm ‹ › đổi
   `?date=` server render data mới nhưng input giữ nguyên giá trị cũ
   (cùng họ lỗi stale-state của CR-008 nhưng ở tầng control).

## Phạm vi
- `src/app/(app)/dashboard/page.tsx`:
  - Bỏ `limit(1)`, lấy mọi lớp GVCN chủ nhiệm + lớp có phân công dạy
    (timetable_entries.teacher_id / teacher_subjects).
  - Thêm class chips + `?class=` chọn lớp; giữ `date/from/to` khi đổi lớp
    và ngược lại (DashboardDateBar giữ `class`).
- `src/components/attendance/date-controls.tsx`:
  - `key={date}` / `key={from}` / `key={to}` trên các input date để remount
    khi giá trị server đổi (áp cho AttendanceDateNav, DashboardDateBar,
    AttendanceRangeNav) - fix hiển thị ở mọi trang dùng chung.

## Acceptance
- Dashboard hiện chips tất cả lớp chủ nhiệm + lớp dạy; đổi lớp đổi đúng
  toàn bộ KPI; `?class=` hợp lệ được tôn trọng, class lạ fallback lớp đầu.
- Bấm ‹ › trên dashboard/điểm danh/sổ đầu bài: ô ngày hiển thị đúng ngày
  mới; form khoảng ngày cũng sync sau khi submit/đổi mode.
- Gates: typecheck/lint/build + check-consistency; verify Playwright prod.

## Kết quả triển khai (commit b2a9582)

- Dashboard: bỏ `limit(1)` - gom mọi lớp chủ nhiệm (`classes.gvcn_id`) +
  lớp có tiết dạy (`timetable_entries.teacher_id`, đánh dấu "(dạy)").
  Class chips + `?class=`; header hiển thị "Lớp chủ nhiệm"/"Lớp đang dạy".
  Chips giữ `date|from,to`; DashboardDateBar + link drill-down giữ `class`.
- Date inputs: `key={date|from|to}` remount khi giá trị server đổi - fix
  hiển thị cũ sau khi bấm ‹ › hoặc đổi mode (áp cho mọi trang dùng
  AttendanceDateNav / AttendanceRangeNav / DashboardDateBar).

## Verify production (Playwright, gvcn@demo.scn)
- Chips hiện đủ 9 lớp: 6A3, 8A2 (chủ nhiệm) + 6A1,6A2,7A1,7A2,8A1,9A1,9A2 (dạy).
- Đổi 6A3→8A2 ngày 21/9: 29→28 có mặt, URL `?class=...&date=2026-09-21`.
- ‹ trên dashboard: input đổi 21/9→20/9 khớp URL; attendance ‹ › sync cả 2
  chiều; period-log ‹ 18/9→17/9; range submit 15-21/9 input giữ đúng;
  đổi mode range→day reset param sạch. 0 console error.
