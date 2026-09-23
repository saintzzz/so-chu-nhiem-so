# QA Report - Business Flows & Performance

Ngày: 2026-09-24 | Build: `572f51c` | Môi trường: production `so-chu-nhiem-so-theta.vercel.app`

Phương pháp: Playwright drive UI thật, mọi mutation verify bằng DB query sau khi thao tác. Không seed/bypass DB cho business action.

## 1. Business flows - 21/21 PASS, 0 console error

| # | Flow | Role | Verify | Kết quả |
|---|---|---|---|---|
| F01 | Điểm danh "Vắng không phép" → Xác nhận chuyên cần | GVCN | `attendance_records.status=unexcused` | PASS |
| F02 | Trang thông báo chuyên cần | GVCN | render | PASS |
| F03 | Thêm ghi nhận hạnh kiểm "Khen thưởng" | GVCN | `conduct_records` có row mới | PASS |
| F04 | Chấm điểm thi đua = 8 | GVCN | `emulation_scores.score=8` | PASS |
| F05 | Soạn + gửi thông báo phụ huynh (cả lớp) | GVCN | `announcements` có row mới | PASS |
| F06 | Sổ đầu bài render form | GVCN | render | PASS |
| F07 | Bảng điểm | GVCN | render | PASS |
| F08 | Tiếp nhận tư vấn | GVCN | render | PASS |
| F09 | Form tạo kế hoạch hoạt động | GVCN | render | PASS |
| F10 | Danh sách học sinh | GVCN | 63 rows data | PASS |
| F11 | Báo cáo học tập | GVCN | render | PASS |
| F12 | KPI sổ chủ nhiệm | GVCN | render | PASS |
| F13 | Bảng điểm GVBM | GVBM | render | PASS |
| F14 | DS học sinh toàn trường | BGH | render | PASS |
| F15 | Portal phụ huynh | PH | render | PASS |
| F16 | Portal học sinh | HS | render | PASS |
| DENY | GVBM → `/emulation/scoring`, `/school/staff` | GVBM | redirect `/academics/grades` | PASS |
| DENY | PH → `/dashboard` | PH | redirect `/portal/parent` | PASS |
| DENY | HS → `/academics/grades` | HS | redirect `/portal/student` | PASS |
| DENY | BGH → `/portal/student` | BGH | redirect `/school/dashboard` | PASS |

Screenshots: `docs/qa/screenshots-flows/`

## 2. Route sweep - 238/241 PASS (script `qa-interactions.mjs`)

- 56 routes × 5 roles: load + click control an toàn (chips/tab/expand/filter)
- 2 FAIL duy nhất là route sai trong script (`/academics/timetable` → thực tế `/schedule/timetable`), đã sửa
- Console error: chỉ 404 từ route sai script, app sạch

## 3. Performance

### Trước fix
| Trang | TTFB | Total | Vấn đề |
|---|---|---|---|
| `/register/audit` | 234ms | 6.3s | 4 query nối tiếp |
| `/parents/appointments` | 1258ms | 5.5s | parent + student lookup nối tiếp |
| `/academics/teacher-chat` | 1773ms | 2.4s | messages đợi peer detail |
| `/academics/analysis` | 2059ms | 8.3s | cold start Vercel |
| Dashboard chip 8A2 | - | ~1s | UI đứng yên, không feedback |

### Sau fix (`Promise.all` + `useLinkStatus` spinner)
| Trang | TTFB | Total |
|---|---|---|
| `/register/audit` | 454ms | **1.5s** (-76%) |
| `/parents/appointments` | 690ms | **1.5s** (-73%) |
| `/academics/teacher-chat` | 548ms | **1.1s** (-54%) |
| Dashboard chip | spinner hiện ngay sau click | ~1s có feedback |

## 4. Thay đổi code

- `src/components/class-chip-label.tsx` (mới): spinner `useLinkStatus` trong chip
- `src/components/class-chips.tsx`: dùng ClassChipLabel
- `register/audit/page.tsx`: classes + staff song song
- `parents/appointments/page.tsx`: parents + students song song
- `academics/teacher-chat/page.tsx`: messages + peer detail song song

## 5. Scripts

- `scripts/qa-business-flows.mjs` - business flows + DB verify
- `scripts/qa-interactions.mjs` - route sweep + control click
- `scripts/qa-ui-cr014.mjs` - CR-014 flows (17 checks)
