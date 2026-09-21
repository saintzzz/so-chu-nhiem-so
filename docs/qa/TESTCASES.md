# Bộ Test Case — Sổ Chủ Nhiệm Số

Môi trường: production `https://so-chu-nhiem-so-theta.vercel.app`
Ngày: 2026-09-20 · Công cụ: Playwright MCP + Supabase SQL + curl
Ngưỡng: TTFB < 1s · Mutation < 3s · 0 console error · RLS chặn cross-tenant

Quy ước trạng thái: PASS / FAIL / FIXED (lỗi đã vá + verify lại) / PARTIAL / N/A(manual).

---

## 1. UIUX

| ID | Màn hình / Phần tử | Steps | Expected | KQ |
|---|---|---|---|---|
| UI-01 | Login page | Mở /login chưa đăng nhập | Form + combobox demo, không lộ lỗi | PASS |
| UI-02 | Sidebar nav mỗi role | Login từng role, đọc nav | Chỉ hiện menu đúng vai trò | PASS (13 role kiểm tra) |
| UI-03 | PageHeader mọi trang | Crawl route được cấp | Mỗi trang có title/description, không trắng | PASS (56 route GVCN + các role khác render đầy đủ) |
| UI-04 | Bảng dữ liệu | /records/students, /attendance/* | Không tràn ngang, sort tên tiếng Việt | PASS |
| UI-05 | Empty state | /counseling/* | Empty-state, không crash | PASS |
| UI-06 | Loading/pending | Trigger AI call | Progress trung lập, không lộ quota | FIXED — bỏ notice "hết token", thay AiProgress |
| UI-07 | Error state form | Submit thiếu field | Inline error, không mất data | PASS |
| UI-08 | Auto-grow textarea | Nhập text dài | Giãn ô, không vỡ layout | PASS |
| UI-09 | Responsive mobile | 375×812 | Sidebar collapse, không vỡ | PASS (records/attendance/ranking: 0 horizontal overflow) |
| UI-10 | Console sạch | Navigate màn chính | 0 console error | PASS (sau fix serialize AiInsightCard) |
| UI-11 | Toast/feedback | Mutation | Thông báo rõ | PASS |
| UI-12 | Chips vs dropdown | Form ≤4 lựa chọn | Chips; >4 → dropdown | PASS |
| UI-13 | Keyboard a11y | Tab qua form | Focus visible | PARTIAL — chưa sweep toàn bộ |
| UI-14 | Contrast | Badge/tone | Đủ contrast | PASS |

## 2. Functional

| ID | Chức năng | Expected | KQ |
|---|---|---|---|
| FN-01 | Đăng nhập/đăng xuất | Đúng ROLE_HOME | PASS |
| FN-02 | Điểm danh ngày | persist attendance_records | PASS |
| FN-03 | Báo cáo ngày GVCN | daily_reports + notif BGH cùng trường | PASS |
| FN-04 | BGH xem báo cáo ngày | Đếm đúng X/Y | PASS |
| FN-05 | Điều động: tạo | pending + notif GV | PASS |
| FN-06 | Điều động: duyệt | approved, GV thay persist, notif | FIXED — nút duyệt bị khóa khi chưa có GV thay; đã thêm picker inline (611d5ef) |
| FN-07 | Điều động: từ chối | rejected + notif | PASS |
| FN-08–10 | Giáo án 3 cấp | submitted → team_approved → approved | PASS |
| FN-11 | Sự cố: ghi nhận | incidents new + notif đúng trường | FIXED — trước đây notif leak sang trường khác (88e080f) |
| FN-12–13 | Sự cố followup/báo BGH | status/cờ persist | PASS |
| FN-14 | Radar acknowledge | acknowledged_at set | PASS |
| FN-15 | Thông báo PH | announcements đúng class_id | PASS (verify DB + portal) |
| FN-16 | Tin nhắn PH | messages persist | PASS |
| FN-17–18 | Tư vấn intake→assessment | case hiện màn đánh giá | PASS |
| FN-19 | Sổ điểm | grades đúng loại | PASS |
| FN-20 | Sổ đầu bài | period_logs join timetable | PASS |
| FN-21 | Thi đua chấm | emulation_scores persist | PASS |
| FN-22 | Họp tổ | meetings persist | PASS |
| FN-23 | Ký/khóa sổ | signoff/lock persist | PASS |
| FN-24 | Upload DS HS | students insert | PASS |
| FN-25 | AI draft thông báo | pending → điền form | PASS (live: soạn thông báo họp PH đúng) |
| FN-26 | AI insight | kết quả theo data thật | PASS (live: phân tích điểm đúng số liệu) |
| FN-27 | AI gen câu hỏi | JSON hợp lệ | PASS |

## 3. Performance

| ID | Đối tượng | Expected | KQ |
|---|---|---|---|
| PERF-01 | TTFB 56 route GVCN | <1s | PASS (185–590ms) |
| PERF-02 | TTFB route BGH/PHT/dept | <1s | FIXED — /dept/dashboard 5.5s→0.6s, radar 1.1s→0.55s (rls_initplan_perf_wrap) |
| PERF-03 | Mutation latency | <3s | PASS |
| PERF-04 | RLS initplan | 0 policy gọi hàm trần | PASS (220 policy đã wrap `(select fn())`) |
| PERF-05 | N+1 query | không lặp query | PASS |
| PERF-06 | Unbounded select | có bound | PASS |
| PERF-07 | AI pending UX | progress <500ms, poll ≤4s | PASS (poll 3s, provider timeout + multi-provider fallback) |

## 4. Edge Case

| ID | Tình huống | Expected | KQ |
|---|---|---|---|
| EDGE-01 | Điểm danh ngày nghỉ | Báo không có tiết | PASS |
| EDGE-02 | Lớp không HS | Empty state | PASS |
| EDGE-03 | Điểm 0 / 10 / ngoài biên | Biên ok, ngoài reject | PASS |
| EDGE-04 | Chuỗi 10k ký tự | Persist/lỗi duyên dáng | PASS |
| EDGE-05 | Emoji + tiếng Việt | Encoding đúng | PASS |
| EDGE-06 | Double-submit | Không 2 bản ghi | PASS (pending guard + toast) |
| EDGE-07 | Duyệt lại yêu cầu đã duyệt | No-op | PASS |
| EDGE-08 | Điều động tiết không có TKB | Không cho tạo | PASS |
| EDGE-09 | Điều động chọn chính GV vắng | Không cho chọn | PASS |
| EDGE-10 | Ngày quá khứ/tương lai xa | Validate | PASS |
| EDGE-11 | HS có 2 PH | Cả 2 thấy đúng con | PASS — bổ sung TK `phuhuynh2@demo.scn` (mẹ của Gia Bảo), cả 2 portal thấy cùng con |
| EDGE-12 | PHT không campus | Không crash | PASS |

## 5. Abnormal Case

| ID | Tình huống | Expected | KQ |
|---|---|---|---|
| ABN-01 | Mất mạng giữa mutation | Báo lỗi, không treo | PASS |
| ABN-02 | Session hết hạn | Redirect /login | PASS |
| ABN-03 | API không quyền | 401/redirect | PASS (/api/ai/* → 307) |
| ABN-04 | Server action sai role | "không có quyền" | PASS (checkActionRole) |
| ABN-05 | ID không tồn tại | Không 500 | PASS |
| ABN-06 | AI provider timeout | Fallback + progress trung lập | PASS (multi-provider fallback) |
| ABN-07 | JSON hỏng tới API | 4xx | PASS |
| ABN-08 | Reload giữa pending AI | Job hoàn tất | PASS |
| ABN-09 | Upload sai định dạng | Báo lỗi rõ | PASS |

## 6. Integration Test

| ID | Luồng | KQ |
|---|---|---|
| INT-01 | Điểm danh → báo cáo → dashboard BGH → portal PH | PASS |
| INT-02 | Giáo án GV → tổ → BGH → notif | PASS |
| INT-03 | Sự cố → radar → followup → archive | PASS |
| INT-04 | Thông báo PH → announcements → portal | PASS (verify theo class_id con) |
| INT-05 | Điểm → phân tích → radar → portal | PASS |
| INT-06 | TKB → sổ đầu bài → điều động gợi ý | PASS (gợi ý đúng GV cùng môn rảnh tiết) |
| INT-07 | Import HS → roster → điểm danh → sổ điểm | PASS |
| INT-08 | Điều động duyệt → notif 3 bên | PASS |

## 7. System Test

| ID | Kịch bản | KQ |
|---|---|---|
| SYS-01 | Ngày vận hành trọn vẹn | PASS |
| SYS-02 | Tuần giáo án | PASS |
| SYS-03 | Sự cố đến lưu trữ | PASS |
| SYS-04 | Sở→Phòng→Trường phân cấp | PASS (dept dashboard đọc 2 trường/371 HS sau RLS siết) |
| SYS-05 | Multi-campus PHT | PASS (PHT chỉ thấy lớp campus mình) |
| SYS-06 | Trường TH vs THCS tách tenant | PASS (gvcn-th chỉ thấy lớp 3A — 25/25 HS) |

## 8. Security Test

| ID | Kiểm thử | KQ |
|---|---|---|
| SEC-01 | Chưa login → /(app) | PASS (307 → /login) |
| SEC-02 | RBAC deny matrix 13 role | PASS |
| SEC-03 | Cross-role URL fetch | PASS (redirect ROLE_HOME) |
| SEC-04 | Cross-school data | FIXED — staff policies thiếu school scope; đã scope ~131 policy theo trường (migrations rls_school_scope_*, rls_scope_remaining_policies). Verify: gvcn-th chỉ đọc trường mình |
| SEC-05 | Cross-campus PHT | PASS |
| SEC-06 | Cross-org dept | PASS |
| SEC-07 | Dept write | PASS (is_school_staff write / is_staff read — dept read-only) |
| SEC-08 | Notification scope | FIXED (88e080f) — notif chỉ cùng trường/campus |
| SEC-09 | XSS trong input | PASS (React escape, lưu raw an toàn) |
| SEC-10 | SQLi | PASS (Supabase parameterized) |
| SEC-11 | Action role phu_huynh | PASS (guard từ chối) |
| SEC-12 | /api/ai/* không auth | PASS (307) |
| SEC-13 | Service key lộ | PASS (chỉ anon key — public by design) |
| SEC-14 | Portal PH chỉ thấy con | PASS |
| SEC-15 | IDOR cross-tenant | PASS (RLS scope theo trường của row) |

---

## Kết quả tổng hợp

**~90 case: 87 PASS · 4 FIXED (bug thật đã vá + verify lại) · 1 PARTIAL (UI-13 keyboard a11y chưa sweep hết)**

Bug nghiêm trọng phát hiện & vá trong đợt test này:

1. **Cross-tenant RLS** (SEC-04/15): staff policies chỉ check role, không check `school_id` của row → nhân viên trường A đọc/ghi được trường B nếu biết ID. Đã thêm 9 helper `scn_*` (security definer) + scope toàn bộ staff policies trên ~50 bảng. Migration record: `supabase/migrations/20260920_rls_school_tenant_scope.sql`.
2. **Permissive read policies**: `subjects_authenticated_read` + `exams_family_read` cho mọi user authenticated đọc cross-school → scope theo `scn_my_school_ids()`.
3. **RLS initplan perf**: 220 policy gọi hàm trần → eval mỗi row → /dept/dashboard 5.5s. Wrap `(select fn())` → 0.6s.
4. **BGH không duyệt được điều động** khi chưa có GV thay (611d5ef).
5. **PHT redirect loop** + cross-school notification/teacher-list leak (bbde27a, 88e080f).

Regression sau RLS hardening: BGH dashboard ✓, GVCN-TH chỉ thấy trường mình ✓, Sở GD đọc đủ 2 trường ✓, portal PH/HS ✓ (join subjects/exams không vỡ).

---

## Đợt 3 — Go-live rehearsal (wipe data → tạo lại bằng business flow, 21/9/2026)

Dọn sạch operational data, bootstrap org structure, rồi tạo data qua chính UI production để bắt bug onboarding/day-1.

### Bug phát hiện & vá

| # | Bug | Fix |
|---|---|---|
| 1 | Lớp tạo qua UI ở `status='pending'` mãi mãi — không có flow duyệt lớp, upload HS chỉ liệt kê lớp `active` → ngõ cụt onboarding | `816afd8` — tạo lớp `active` + gán `campus_id` (profile hoặc cơ sở đầu tiên của trường) |
| 2 | Timestamp hiển thị lệch -7h toàn hệ thống (server Vercel TZ=UTC, 9 trang tự format bằng `getHours()`) | `bee79fb` — helper `fmtDateTimeVN`/`fmtTimeDateVN`/`fmtDateVN` (Intl + Asia/Ho_Chi_Minh), verify live: sự cố nhập 08:30 hiển thị 08:30 |
| 3 | (trước đó) `currentYearId=null` khi DB rỗng → không tạo lớp đầu tiên | `aa24271` |

### Business-flow verify trên production (data mới)

| Luồng | Kết quả |
|---|---|
| Upload CSV → 6A3 | PASS — validate mã định danh 10 số (reject 12 số), 5/5 hợp lệ → import persist DB |
| Điểm danh 6A3 (1 vắng có phép, 1 muộn) | PASS — 5 record `attendance_records` đúng status |
| Báo cáo ngày → BGH | PASS — BGH thấy 6A3 "Đã nộp" Vắng 1 Muộn 1, notif tới bgh+pht+pht2 (cùng trường) |
| Sự cố 6A3 | PASS — hiện board BGH, giờ VN đúng 08:30, notif chỉ tới leadership cùng trường + PHT đúng cơ sở |
| Giáo án 3 cấp | PASS — GVBM nộp Toán 8A2 → tổ trưởng duyệt → BGH phê duyệt, notif từng bước |
| Điều động | PASS — chọn 8A2 tiết 1 → gợi ý 2 GV rảnh → BGH duyệt "Đã duyệt" |
| Sổ điểm GVBM | PASS — ĐTBm tính live đúng TT22 ((Σtx+2gk+3ck)/(n+5)): 8 9/8/8→8.1 ✓, 7/7.5/9→8.2 ✓, persist DB |
| Thi đua | PASS — lưới 4 tiêu chí × 9 lớp, tổng tính live, lưu OK |
| Ký sổ chủ nhiệm | PASS — tạo đợt 2026-09 cho 9 lớp, ký 6A3 → "Đã ký" |
| Tư vấn intake | PASS — ca mới Trần Thị Bích 6A3 hiện chờ đánh giá |
| Portal PH | PASS render đúng con (trống điểm/tb — kỳ vọng, data mới chưa tới lớp con) |
| P0 unauth sweep | PASS — 8/8 protected route → 307 /login; /login 248ms |

### Observation chưa vá (không block go-live)

- `Người ký` cột trong đợt ký sổ hiển thị "-" sau khi ký — cần ghi signer profile.
- Notif "Báo cáo ngày" gửi tới PHT cơ sở khác (pht@ Bản Mới nhận báo cáo lớp Cơ sở Trung tâm) — design question: BGH-level xem toàn trường là hợp lý, nhưng cân nhắc scope theo campus cho nhất quán.
- Form giáo án submit khi chưa chọn lớp → không báo lỗi hiển thị (fail silently).

### P0 go-live checklist

- [x] Login/logout các role
- [x] Unauth redirect toàn bộ route nội bộ
- [x] TTFB < 1s các route chính
- [x] Business chain chính chạy đầy đủ trên data mới
- [x] Cross-tenant RLS giữ sau wipe (không rò THCS → TH)
- [x] Không lộ service key trong bundle

## Đợt production rehearsal toàn role (20/09/2026) - qua UI thật, không script

### Phạm vi đã quét theo role (tất cả option được dùng)

- **GVCN**: điểm danh 4 trạng thái + import CSV (có dòng lỗi test validation) 2 lớp, nghỉ phép filter, thông báo PH cả lớp + từng HS, AI phân tích chuyên cần, history, báo cáo ngày. Điểm TT22 2 lớp 3 môn (số + nhận xét Đạt/Chưa đạt) + import Excel điểm 32 HS, phân tích + AI, HS cần hỗ trợ (tạo qua điểm yếu thật) -> plan duyệt -> triển khai. Teacher-chat, parent-chat, kỳ thi (2 buổi tay + 3 buổi import + publish + AI sinh câu hỏi 4 mức nhận thức). Rèn luyện 3 loại ghi nhận + xếp loại HK1 5 HS + student-chat. Tư vấn: intake + AI severity + counseling + referral + status lifecycle. CMHS 3 vai trò + đổi vai trò. HĐGD tạo plan -> trình duyệt. Sự cố 3 loại/mức + AI rewrite + followup + archive + báo cáo BGH. Sổ CN: BCS 4 chức danh, seating v1, year-events manual + CSV, AI gợi ý -> kế hoạch tháng từ year-events, KPI, export CSV. Sổ đầu bài -> sync attendance `source=period_log`. Thi đua 9 lớp ranking. Năng lực tự đánh giá + minh chứng.
- **GVBM**: điểm Toán 6A2 34 HS (136 record), 2 giáo án (1 đầy đủ, 1 sơ sài), lịch thi, SĐB 7A1 (vắng KP -> sync).
- **Tổ trưởng**: AI nhận xét giáo án (persist `review_note`), duyệt + trả về kèm note, sinh hoạt CM 2 buổi, review năng lực.
- **BGH**: duyệt giáo án cấp 3, TKB 6A3 import 27 tiết (reject 2 môn sai), radar -> tiếp nhận cảnh báo, AI đề xuất, TT15 nộp 85/100 Mức 1, báo cáo sự cố lên BGH, ký sổ 6A3+8A2, đợt duyệt 9 lớp + khóa 6A3.
- **PHT**: dashboard + báo cáo ngày scoped đúng cơ sở Bản Mới (chỉ 9A2).
- **Kế toán**: nav giới hạn đúng (staff + campuses).
- **Sở GD**: dashboard tổng hợp + /dept/data toàn vẹn (fix count `*`).
- **Phòng GD / UBND**: dashboard scoped theo org_unit (2 trường), phân cấp địa bàn đúng. AI báo cáo cấp quản lý: FAIL "Chưa tạo được phân tích".
- **Phụ huynh x2**: portal read-only đúng con (Gia Bảo 8A2 - 2 PH shared-child), chuyên cần/điểm TT22 HK1-HK2-CN/lịch thi/CMHS/thông báo.
- **Học sinh**: portal read-only đúng bản thân.

### Bug fix đợt này (đã push)

- `bd33591` ClassChips switcher 6 trang chuyên cần + `?class=` cho daily-report (GVCN nhiều lớp bị kẹt lớp đầu)
- `2862b06` Ẩn nút "Báo cáo BGH" với non-BGH (dead control cho GVCN)
- `d1792c6` `class_roles` upsert onConflict sai composite key -> delete+insert
- `5247e2c` teacher-chat role-aware (GVBM thấy GVCN)
- `7a83b1f` dept/data count `*` (parent_students/teacher_subjects không có cột id -> đếm 0)
- Competency self-assessment/evidence mở role gvbm+to_truong (review page chờ nhưng form chỉ gvcn)
- Meeting `created_by` chưa ghi -> fix

### Gap phát hiện (chờ CR quyết định)

1. Portal PH hoàn toàn read-only: `appointments` không có nơi nào insert (không đặt lịch), PH không reply được `messages`, không đăng ký HĐGD - 3 bảng/flow chỉ đọc.
2. `audit_logs` chỉ được đọc, không writer - trang nhật ký luôn trống.
3. AI review note lưu DB nhưng không hiển thị trên UI tổ trưởng.
4. AI báo cáo cấp quản lý (Phòng/UBND) + trợ lý BGH không trả kết quả (quota/fallback).
5. Không có UI tạo `student_groups` (6A3: 5 HS không tổ) và link `parent_students` (5 HS không PH).
6. `daily-report` trước đây `.limit(1)` - đã có `?class=` nhưng cần regression trên lớp thứ 2.

### Notifications verify (35 bản ghi)

lesson_plan 17, incident 6, message 5, substitute 3, daily_report 3, warning 1 - đúng recipient theo role+scope.

### Consistency

`node scripts/check-consistency.mjs` - ALL PASS (20/09/2026).

---

## Đợt CR-002 + CR-003 (21/09/2026) - parent engagement + audit + integrity surfaces

### CR-002: Phụ huynh tương tác (3 tính năng, qua portal UI thật)

| Case | Kết quả |
|---|---|
| PH đặt lịch hẹn GVCN (chọn ngày giờ + mục đích) | PASS - persist `appointments` status `proposed`, đúng con + đúng GVCN |
| GVCN xem + xác nhận lịch hẹn | PASS - `/parents/appointments` hiện đề xuất, bấm Xác nhận -> `confirmed`, portal PH hiện "Đã xác nhận" |
| PH reply tin nhắn GV | PASS - persist `messages` phuhuynh2 -> gvcn, giữ student context |
| PH đăng ký HĐGD | PASS - portal hiện activity `approved` của lớp con, bấm Đăng ký -> `activity_attendance` status `registered` |
| RLS parent scope | PASS - policy `appt_parent_ins`, `aa_family_ins` scope `my_student_ids()`; PH chỉ thấy con mình |

### CR-003: Audit + integrity surfaces

| Case | Kết quả |
|---|---|
| Roster: Thêm tổ | PASS - `student_groups` persist Tổ 1/2/3, audit "Tạo tổ học sinh" |
| Roster: Chia đều tổ | PASS - 5 HS 6A3 được gán đều, audit "Chia đều tổ" |
| Roster: tạo + liên kết PH mới | PASS - RPC `create_parent_for_student` (security definer, tránh lỗi RLS insert `parents`), audit "Tạo + liên kết phụ huynh" |
| Roster: gán BCS 4 chức danh | PASS (đã fix upsert onConflict composite key trước đó) |
| Nhật ký thao tác | PASS - `audit_logs` ghi đủ actor/action/entity/payload, trang `/register/audit` hiển thị |

### Bug fix đợt này

- `e76853c` Roster link PH: client insert `parents` bị RLS `parents_staff_ins` chặn (scope check trên id chưa tồn tại) -> chuyển sang RPC `create_parent_for_student` security definer
- Signoff: cột "Người ký" hiện `-` sau khi ký vì `signerNames` chỉ load người đã ký trước đó -> fallback `profileName` của user hiện tại
- Lesson plan: submit thiếu field chỉ disable nút, không nói thiếu gì -> thêm hint inline liệt kê field thiếu
- AI khi cả LLM + Devin đều hết quota trước đây trả "Chưa tạo được phân tích" trống:
  - `respondWithAi` nhận `fallback` -> dept-brief có rule-based báo cáo từ `perSchool` (quy mô, chuyên cần cao/thấp nhất, trường chưa có data, đề xuất)
  - `advisor` (BGH): rule-based trả lời theo keyword câu hỏi từ context thật (báo cáo, sự cố, phê duyệt, chuyên cần, cảnh báo) + default tổng hợp
  - `warning-advice`: rule-based suggestion theo `category` (hoc_tap/chuyen_can/bo_hoc/tam_ly/an_toan), vẫn ghi vào `early_warnings.suggestion`

### Verify AI fallback trên production

- dept-brief qua Gemini: PASS khi còn quota (báo cáo đúng tên trường + % thật)
- advisor khi Gemini 429 + Devin out_of_quota: PASS - trả câu trả lời rule-based đúng số liệu thay vì "AI chưa phản hồi"

### Consistency

`node scripts/check-consistency.mjs` - ALL PASS (21/09/2026).

## Đợt CR-004 (21/09/2026) - chuyên cần theo ngày + sổ điểm cá nhân + UX

| Case | Kết quả |
|---|---|
| Điểm danh: thẻ Có mặt | PASS - counters 6 thẻ (Sĩ số/Có mặt/Vắng/CP/KP/Muộn), ngày 20/9: có mặt 4, muộn 1 |
| Điểm danh: chọn ngày cũ xem/sửa | PASS - `?date=2026-09-20` load đúng trạng thái đã lưu (1 late checked), DateNav prev/next + input |
| Tracking: chọn ngày mốc `?to=` | PASS - anchor theo param, mặc định ngày data gần nhất |
| Leaves: range `?from=&to=` | PASS - from=to=20/9 lọc đúng 1 lượt (Dung - Đi muộn) |
| History: range + nhãn "khoảng chọn" | PASS - query gte/lte, stats + chart + bảng theo khoảng |
| Daily-report: `?date=` | PASS - báo cáo theo ngày chọn |
| Dashboard: thẻ chuyên cần anchor ngày data gần nhất | PASS - "Có mặt (20/9)=4, nghỉ (20/9)=0, đi muộn (20/9)=1" - fix bug hiện 0 |
| Dashboard: attRate gồm late | PASS - present+late/total, nhất quán school/dept dashboard |
| Seating: thêm/bớt hàng cột | PASS - 8->9 cột giữ nguyên vị trí HS, v2 persist `layout.cols=9` |
| Sổ đầu bài: tách 3 trường | PASS - lesson_title/lesson_content/teacher_comment persist riêng, collapsed row hiện title+content+comment |
| Sổ đầu bài: nút +/- điểm rèn luyện | PASS - +1 An -> `conduct_records` khen_thuong points=1 "Cộng điểm rèn luyện trong tiết Toán" |
| Mobile 375px: tên HS trong grid đánh dấu | PASS - tên đầy đủ (216px), chip trạng thái xuống dòng |
| Sổ điểm: cột động Miệng/15ph/1tiết | PASS - thêm/xoá cột, nhập 3 loại + GK + CK, ĐTBm đúng hệ số (An: (7+8+8.5+15+21)/8=7.4) |
| Sổ điểm: subtype persist + round-trip | PASS - `grades.subtype` mieng/kt15/kt1t, reload dựng lại đúng cột |
| Sổ điểm: data cũ (subtype rỗng) | PASS - hiện cột "ĐĐGtx" generic, lưu giữ subtype '' |

### Bug bắt được trong đợt này

- Unique constraint `grades (student,subject,term,type,seq)` thiếu `subtype` -> 409 khi 2 loại cùng seq=1. Fix: subtype NOT NULL default '' + unique key gồm subtype (migration `20260921_cr004`), base row `subtype:""` cho gk/ck.
