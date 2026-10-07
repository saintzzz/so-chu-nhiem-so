# QA Coverage Report - Go-live demo gate 15/10/2026

Ngày: 08/10/2026. Môi trường test: **production** `https://sochunhiem.vieschool.com` (commit `c155918`).

## 1. Đã chạy

| Suite | Phạm vi | Kết quả |
|---|---|---|
| `scripts/qa-full-coverage.mjs` | Access matrix 79 routes × 10 roles (allow + deny redirect đúng home) + 31 write flows UI→DB | **45/47** - 2 fail đã phân tích (xem §4) |
| `scripts/qa-security-edge.mjs` | 33 checks: RLS probes, API auth, edge/abnormal, perf | **31/33** - 2 fail perf = cold start, warm lại đạt |
| `scripts/e2e-cr034.mjs` | Demo gate flow: Sở GD tạo trường → admin trường → tạo GV → usage dashboard → RBAC | **11/11** |
| `node scripts/check-consistency.mjs` | Orphan FK, period-log↔attendance sync, subject scope, dead buttons, naming... | PASS |
| `npm run typecheck / lint / build` | tsc strict, eslint, Next build 124 routes | PASS |

## 2. Coverage chi tiết đã đạt

**Access control (AM-\*)**: mọi route trong ma trận `ROLE-MATRIX.md §3` được test cả 2 chiều với 10 role (gvcn, gvbm, to_truong, bgh, pht, ke_toan, so_gd, ubnd, phu_huynh, hoc_sinh) - allow → 200 đúng route, deny → redirect về role home. ~790 route×role checks.

**Write flows UI→DB (W01-W32)**: điểm danh, ghi nhận hạnh kiểm, thông báo PH, điểm thi đua, sửa hồ sơ HS + history, sổ đầu bài, nộp giáo án, signoff state machine (pending→submitted→signed), sinh hoạt tổ, PH đặt lịch hẹn, duyệt giáo án 2 cấp, GVCN xác nhận lịch, roster đổi lớp.

**Security (S01-S13)**: self-escalation role/school bị trigger chặn; PH chỉ thấy con mình (parents=1, materials=0, ai_jobs=0); ke_toan = 0 rows trên grades/counseling/incidents/parents/digest/ai_jobs/audit_logs; cross-school bgh-th 0 foreign students; gvbm scope < toàn hệ thống; cron 401 không auth + từ chối `?secret=`; devin-callback token sai 401.

**Edge/abnormal (E01-E12)**: sai MK, email không tồn tại, unauth redirect (app + portal), student ID không tồn tại → 404 sạch, IDOR `roster?class=` trường khác → 0 lộ, điểm=15 bị validation, XSS `<img onerror>` không execute + render escaped, email lỗi khi tạo GV, submit disabled khi thiếu required, logout → protected → login, 0 JS pageerror.

**Perf (P01-P02)**: 9 trang trọng điểm, warm TTFB 280-1400ms, full load <1.9s. Cold start radar ~11s (serverless, chấp nhận được cho demo scale).

## 3. VÙNG CHƯA COVER (tự khai)

| # | Vùng | Trạng thái | Rủi ro demo gate |
|---|---|---|---|
| G1 | **Studio / TVC module** (`/studio/*`: library, questions, mau-khbd, yccd, literature, [code]) + `/api/studio/*` | Không có trong access matrix, không có write-flow test nào | **CAO** - TVC360 là sản phẩm được demo cho trường |
| G2 | **Import Excel HS** (`/records/upload`) | Chỉ render check W09, chưa upload file thật + verify DB | Trung bình - trường tự nhập HS khi onboard |
| G3 | **Export** (`/register/export`, audit export, class-report XLSX) | Chưa verify file tải về đúng nội dung | Trung bình |
| G4 | **AI routes** (`/api/ai/*`: advisor, dept-brief, suggest-tasks, devin-callback happy path) | Chỉ test token sai → 401; happy path + fallback quota chưa test | Trung bình - AI gen là selling point |
| G5 | **Attendance daily mark → notify PH / digest cron** | Điểm danh đã test (W01) nhưng luồng notify/digest email chưa E2E | Thấp - cron digest weekly |
| G6 | **Counseling workflow** intake→assessment→referral | Chỉ render checks | Thấp cho demo |
| G7 | **Safety incident** report→bgh xử lý→followup→archive | Chỉ render checks | Thấp-trung bình |
| G8 | **Grade entry save** (GVBM nhập điểm → DB → ĐTBm TT22) | Chưa có write flow nhập điểm thật | **CAO** - core function |
| G9 | **grantParentAccess** end-to-end (cấp TK PH → PH login → thấy con) | Code review + unit-level OK, chưa E2E | Trung bình - demo gate feature |
| G10 | **Change password, /profile edit, notifications read** | Chưa test | Thấp |
| G11 | **Lock-records, seating assignment, year-events** | Chỉ render checks | Thấp |
| G12 | **Period-log absence → attendance_records sync** (rule cross-module) | checker verify tĩnh, chưa E2E đánh dấu vắng ở sổ đầu bài rồi thấy trong điểm danh | Trung bình |
| G13 | **Load test ~500 users** | Chưa chạy - chỉ có timing đơn request | Trung bình (demo gate scale nhỏ; cần trước M3) |
| G14 | **Equipment/campuses/nq37 CRUD** (ke_toan), school/assignments, substitutes, journals | Chỉ render/access checks | Thấp |
| G15 | **Timetable CRUD + conflict detection, manage** | Chỉ render checks | Trung bình |
| G16 | **Email thực tế gửi** (announcement → Resend, digest) | Chưa verify email ra đi thật (cần RESEND_API_KEY + domain) | Thấp - cấu hình ops |
| G17 | **portal/parent các tab con** (điểm, chuyên cần, TKB, messages, hoc-ba) | Chỉ 1 render check tổng | Trung bình - PH là điểm demo |
| G18 | **Đa ngôn ngữ dữ liệu**: tên có dấu, ký tự đặc biệt, chuỗi dài overflow UI | Chưa test | Thấp |

## 4. Fail đã phân tích (không phải bug app)

- `AM-ke_toan /dashboard → /api/auth/reset`: transient null profile sau login → đã fix `requireProfile` retry 1 lần (commit c155918).
- `W31 appointment`: bug test (assert sai row DB) - flow thật chuyển `proposed→confirmed` đúng, đã sửa assert.

## 5. Test data

Đã dọn toàn bộ marker `FULL-*`/`THPT Demo Gate*`/auth users test khỏi production sau mỗi lần chạy.
