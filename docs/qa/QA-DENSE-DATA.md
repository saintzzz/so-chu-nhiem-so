# QA - Full test với data thực tế (dense data)

Ngày: 21/09/2026. Môi trường: production `so-chu-nhiem-so-theta.vercel.app`.

## 1. Chuẩn bị data

Yêu cầu: lớp 5 học sinh là không chấp nhận được; dùng tính năng hệ thống (không seed script) để tạo data như thực tế.

### Sĩ số sau nạp

| Lớp | HS | Có PH | Có điểm | Có chuyên cần | Sơ đồ |
|---|---:|---:|---:|---:|---:|
| 1A | 25 | 25 | 25 | 25 | 1 |
| 3A | 25 | 25 | 25 | 25 | 1 |
| 5A | 24 | 24 | 24 | 24 | 1 |
| 6A1 | 34 | 34 | 34 | 34 | 1 |
| 6A2 | 34 | 34 | 34 | 34 | 1 |
| 6A3 | **5 -> 32** | 32 | 32 | 32 | 1 |
| 7A1 | 33 | 33 | 33 | 33 | 1 |
| 7A2 | 33 | 33 | 33 | 33 | 1 |
| 8A1 | 32 | 32 | 32 | 32 | 1 |
| 8A2 | 32 | 32 | 32 | 32 | 1 |
| 9A1 | 31 | 31 | 31 | 31 | 1 |
| 9A2 | 31 | 31 | 31 | 31 | 1 |

- 6A3: nạp 27 HS qua **Import Excel trên UI** (`/records/upload`), đúng quy trình nghiệp vụ.
- Tổng quan bảng: attendance ~2.300 bản ghi (6 ngày × 12 lớp), grades ~7.800 (nhiều loại điểm TT22: miệng, 15 phút, 1 tiết, GK, CK), period_logs 146, period_absences 145, daily_reports 25, conduct_records 62, incidents 45, counseling_cases 38, seating_charts 12, notifications 86.
- Toàn vẹn: 0 orphan FK (grades/attendance/parent_students), 0 điểm tham chiếu môn sai trường.

## 2. Kiểm tra quan hệ xuyên role/màn hình

| Luồng | Kết quả |
|---|---|
| GVCN gửi thông báo lớp 8A2 (UI `/attendance/notify`) -> PH của Gia Bảo thấy trên portal | PASS |
| Cùng thông báo hiện trên portal học sinh | PASS |
| Đánh vắng/muộn trong sổ đầu bài -> `period_absences` + `attendance_records(source=period_log)` đồng bộ | PASS (trang "Nghỉ học / đi muộn" hiển thị nguồn "Sổ đầu bài") |
| GVCN nộp báo cáo ngày -> BGH `/school/daily-reports` thấy 9/9 lớp, đúng số liệu và cơ sở | PASS |
| GVBM (Trần Văn Minh) vào sổ đầu bài chỉ thấy tiết mình dạy, không trùng slot sau CR-006 | PASS |
| PH/HS portal hiển thị đúng điểm TB theo môn (8.3-8.5), lịch thi, chuyên cần của đúng em | PASS |
| PH vào `/dashboard` -> redirect `/portal/parent`; GVBM vào `/safety/followup` -> denied | PASS |
| Notifications: 86 bản ghi, có `daily_report` đến BGH/PHT khi GVCN nộp | PASS |

## 3. UI/UX với data đầy

Kiểm tra vỡ khung/overflow ở desktop 1905px, 1440px và mobile 375px (DOM scan: phần tử vượt viewport ngoài vùng scroll chứa, text bị cắt không ellipsis).

| Trang | Kết quả |
|---|---|
| Điểm danh ngày (32 HS, 6 thẻ trạng thái) | OK |
| Theo dõi tình trạng (empty state khi không ai qua ngưỡng) | OK |
| Sổ điểm 32 HS x cột động (Miệng/15'/1 tiết/GK/CK) | OK, không overflow, ĐTBm đúng hệ số |
| Sổ đầu bài (collapsed row đủ: tiết, môn, GV, phòng, sĩ số, vắng/muộn, có mặt x/y) | OK mobile + desktop |
| Sơ đồ lớp 32 HS | OK sau khi tạo lại v3 (xem bug D2) |
| Hồ sơ HS (sort theo tên, điểm TB, % chuyên cần, hạnh kiểm) | OK |
| An toàn BGH (36 sự cố, mô tả dài nhiều dòng) | OK |
| Tư vấn, Thi đua (12 lớp), Kỳ thi, Lịch sử chuyên cần theo khoảng ngày | OK |
| Dashboard Sở GD (2 trường, 366 HS, 91.5% chuyên cần, 29 sự cố mở) | OK |
| Bảng nặng ở 375px | scroll trong container, không tràn document |

## 4. Lỗi phát hiện và xử lý

| # | Lỗi | Xử lý |
|---|---|---|
| D1 | Portal học sinh hiển thị ngày thông báo lệch 1 ngày so với portal PH (slice UTC vs `fmtDateVN`) | Đã fix: student page dùng `fmtDateVN` - commit `ceac08f` |
| D2 | 3 `attendance_records` trạng thái `present` đè `period_absences` (18/9: Chi-muộn, Ánh-vắng CP, Anh-vắng KP) | Đã sync lại `status` + `source=period_log`; `check-consistency` PASS |
| D3 | Sơ đồ 6A3 (v2, 9x5) chỉ chứa 5 HS seed cũ - 27 HS import mới không có ghế | Đã tạo v3 (8x4) đủ 32 ghế. **Gap UX còn lại**: sau import HS mới, sơ đồ không tự gán ghế/cảnh báo - đề xuất CR nhỏ |
| D4 | Sidebar "Báo cáo ngày cho Ban Giám Hiệu" bị cắt nhẹ ở 1440px | Minor - cần xác nhận có phải ellipsis chủ đích |

## 5. Hiệu năng

- TTFB dashboard ~33ms, DOMContentLoaded ~520ms.
- `/academics/grades` lớp 32 HS: ~653ms (trong ngưỡng <1s server).
- Console: 0 error; warnings chỉ là font preload (benign).

## 6. Còn lại / đề xuất

- Lớp tiểu học (1A/3A/5A) chưa có `emulation_scores` -> bảng xếp hạng Sở hiện 0 điểm cho 3 lớp này (data gap, không phải lỗi UI).
- ~~Đề xuất CR: sau import HS mới, sơ đồ chỗ ngồi nên tự gán ghế trống hoặc cảnh báo "X HS chưa có chỗ".~~ Đã làm - **CR-007** (commit `677e79a`): banner "Còn X học sinh chưa có chỗ ngồi" kèm tên + nút "Xếp chỗ tự động" điền ô trống, hết ô thì gợi ý thêm hàng/cột. Verify E2E: tạo v4 thiếu 2 HS -> banner hiện đúng 2 em -> auto-assign -> lưu v5 đủ 32/32 ghế.
- `check-consistency.mjs`: ALL PASS sau khi fix D2.

## CR-008 - Đồng bộ điều hướng ngày (2026-09-22)

Báo lỗi: dashboard thiếu xem theo ngày/khoảng ngày; form điểm danh bấm ‹ › không đổi data.

### Bugs tìm được (audit toàn bộ date-driven pages)
1. `DailyRoster` giữ `statuses` trong useState, page không truyền `key` → đổi `?date=` server trả data mới nhưng React giữ state cũ (root cause lỗi user báo).
2. `DailyReportForm`, `SeatingGrid`, `PeriodLogBoard` cùng pattern stale-state.
3. `ClassChips` chỉ build `?class=` → đổi lớp mất `?date=`/`?from=`/`?to=`.
4. `/schedule/period-log` có `?date=` nhưng không có UI chọn ngày (phải gõ URL).
5. Dashboard không đọc searchParams - luôn neo ngày có data gần nhất.

### Fix
- Truyền `key={classId-date}` / `key={date}` cho 4 board client.
- `ClassChips` nhận `params` giữ query khi đổi lớp.
- Thêm `AttendanceDateNav` vào period-log.
- Dashboard: `?date=` (1 ngày) + `?from=&to=` (khoảng) + `DashboardDateBar`; thẻ chuyên cần link sang trang chi tiết đúng ngày/khoảng.

### Verify trên production (Playwright + đối chiếu DB)
| Case | Kết quả |
|---|---|
| Điểm danh 21/9 | Sĩ số 32, có mặt 29, vắng 2, muộn 1 - khớp DB |
| Bấm ‹ → 20/9 | Đổi thành có mặt 31, vắng 0, muộn 1 - khớp DB (trước fix giữ nguyên 29/2/1) |
| Bấm › về 21/9 | State đổi đúng cả 2 chiều, từng radio HS cập nhật |
| Đổi lớp 6A3 → 8A2 | URL giữ `date=2026-09-20`, roster lớp mới render đúng |
| Dashboard `?date=18/9` | 28 có mặt / 3 nghỉ / 1 muộn - khớp DB |
| Dashboard `?from=18/9&to=21/9` | Lượt có mặt 61, vắng 5, muộn 3, tỷ lệ 92.8% - khớp DB |
| Dashboard ‹ | `?date=17/9` hiện 28/2/2 |
| Range ngược (from>to) | Fallback day mode, không crash |
| Sổ đầu bài ‹ | Thứ 5 17/9 render đúng TKB (Mỹ thuật/Sinh học/Lịch sử/Vật lý) |
| Daily-report ‹ | Form reset - 17/9 trống, không sót nội dung 18/9 |
| Console | 0 errors |

Gates: typecheck/lint/build clean, `check-consistency.mjs` ALL PASS. Commit `2296944`.
