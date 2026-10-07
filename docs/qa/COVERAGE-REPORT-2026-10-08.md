# QA Coverage Report - Go-live demo gate 15/10/2026 (v2)

Ngày: 09/10/2026. Môi trường: **production** `https://sochunhiem.vieschool.com` (commit `a07720b` + migration `20261009_rls_setof_helpers_perf`).

Vòng 1 bị test lead **REJECT** (Studio/nhập điểm/trường trống chưa cover, assertion pass giả, matrix thiếu admin). Vòng 2 đã đóng toàn bộ gap ưu tiên cao.

## 1. Kết quả cuối

| Suite | Phạm vi | Kết quả |
|---|---|---|
| `scripts/qa-full-coverage.mjs` | Access matrix **97 routes × 10 roles** (allow→200 đúng route, deny→redirect role home) + 31 write flows UI→DB + console-error gate | **48/48** |
| `scripts/qa-security-edge.mjs` | 54 checks: RLS probes, API role matrix, tenant isolation per-school, edge/abnormal, Studio happy path, perf cold/warm | **54/54** |
| `scripts/e2e-cr034.mjs` | Demo gate: Sở GD tạo trường → admin → tạo GV → GV mới login → isolation → usage dashboard | **13/14** (xem §4) |

## 2. Coverage đã đạt

**Access matrix**: 97 routes (gồm `/dept/schools`, `/dept/usage`, toàn bộ `/studio/*`: library, literature, mau-khbd, questions, yccd) × 10 role, cả 2 chiều. Role `admin` test E2E riêng (S16/S17): `/dept/schools` accessible, `/register/roster` denied.

**Write flows UI→DB (W01-W32)**: điểm danh (xóa record cũ trước - assert deterministic), hạnh kiểm, thông báo PH, điểm thi đua (đúng `currentPeriodVN`), sửa HS + history, roster đổi lớp, sổ đầu bài, nộp giáo án, signoff machine pending→submitted→signed, sinh hoạt tổ, PH đặt lịch, duyệt giáo án 2 cấp, GVCN xác nhận lịch. Thiếu input data = FAIL (không auto-pass).

**Studio/TVC (S18-S22 + matrix)**: `POST /api/studio/tools/DC-01/generate` → 200 + doc (fallback rule-based khi AI quota) → `tvc_generations` row mới verified → export DOCX 9.6KB non-empty → `ke_toan`/`phu_huynh` export = 404. `/studio/*` page deny đúng cho ke_toan/ph/hs.

**API role matrix**: `phu_huynh`/`hoc_sinh` → `/api/ai/dept-brief`, `/api/ai/draft-message`, `/api/studio/tools/*/generate` → 403/404. Cron không auth 401, `?secret=` từ chối, devin-callback token sai 401.

**Tenant isolation per-school (S23/S24)**: account `gv004@nd.test`/`gv004@cva.test`/`gv004@kd.test` - chỉ thấy HS trường mình, query lớp trường khác = 0.

**Security RLS**: self-escalation bị trigger chặn; PH parents=1; ke_toan = 0 rows trên grades/counseling/incidents/parents/digest/ai_jobs/audit_logs/**attendance** (siết thêm theo ROLE-MATRIX); cross-school materials = 0.

**Edge/abnormal**: sai MK, email lạ, unauth redirect, 404 sạch, IDOR class, điểm=15 + click Lưu → validation, XSS không execute, email lỗi không tạo user (message đúng + DB clean), submit disabled, **logout thật qua nút aria-label** → protected → login, 0 JS errors (fail nếu có).

**Perf**: tách cold/warm. Warm TTFB 440-1670ms, full load <2.2s mọi trang; cold start <7.3s. **Radar: 14.2s → 1.1s** sau khi rewrite RLS helpers thành set-returning functions (hash semi-join thay nested-loop per-row) + parallel paging `fetchAllRows` + filter `students!inner.class_id`.

## 3. Vùng còn mở (không claim cover)

| # | Vùng | Trạng thái |
|---|---|---|
| G2 | Import Excel HS upload file thật | Chỉ render check |
| G4 | AI happy path qua Gemini thật (test đang chạy fallback vì quota) + rate-limit AI | Fallback verified; AI rate-limit chưa có |
| G9 | `grantParentAccess` E2E (cấp TK PH → PH login → thấy con) | Chưa E2E đầy đủ |
| G13 | Load test ~500 user | Chưa chạy - demo scale nhỏ, cần trước M3 |
| G16 | Email thật qua Resend | Ops config, chưa verify |
| Còn lại | Counseling/safety workflow sâu, timetable CRUD, multi-child PH, CSV formula injection | Render/access level |

## 4. Fail/ flake đã phân tích

- `e2e-cr034` run cuối: `createSchool` fail do **Supabase auth email rate-limit** (nhiều `createUser` liên tiếp trong test) - rollback sạch, không phải bug app. Run trước đó verify đầy đủ trong DB (school + admin + gvcn tồn tại đúng).
- `AM-* no-response`: transient timeout khi burst ~97 request - đã thêm retry 1 lần.
- `W04`: test bug - query sai period (lấy row đầu DB thay vì `currentPeriodVN()` của form). Đã sửa.
- `S23 Kim Đồng`: trường chưa seed HS (0 classes) - check foreign=0 vẫn pass, đánh dấu rõ "(truong chua co HS)".
- `E11`: race cookie sau login - sửa bằng `waitForURL` thoát `/login` trước khi assert.

## 5. Test data

Marker `FULL-*`, `THPT Demo Gate*`, auth users test đã dọn khỏi production sau mỗi run. `adm.test*` user trong S16 tự xóa sau test. `tvc_generations` test row đã xóa.

## 6. Diff so với vòng 1 (đã REJECT)

| Finding test lead | Trạng thái |
|---|---|
| Studio/TVC không test | DONE: matrix + generate→DB→export→deny |
| Nhập điểm không có save flow | DONE: E13 nhập 4.5 → Lưu → verify DB row mới |
| Trường trống/new-school | DONE: e2e-cr034 mở rộng (GV mới login, isolation, empty-state) |
| Admin không trong matrix | DONE: S16/S17 E2E tạo admin tạm |
| API role denial | DONE: S14/S15/S21/S22 |
| Assertion pass giả | DONE: strict hết (xem §2) |
| Console errors không fail | DONE: gate CONSOLE |
| Perf không tách cold/warm | DONE: P01 warm, P02 TTFB, P03 cold riêng |
| Matrix chép code không theo spec | Partially: `pht`/`/school/students`, `pht` export - **quyết định spec còn treo** (xem dưới) |

### Spec discrepancies cần PO chốt (không chặn demo nhưng phải quyết)

1. `pht` export được `/api/studio/materials/[id]/export` (trong `staff` list) nhưng không vào được trang `/studio/*` - đang để như code, cần xác nhận ý đồ.
2. `pht` → `/school/students`: ROLE-MATRIX ghi deny, implementation allow - đang follow implementation.
3. `ke_toan` đọc được `students` (tên HS) qua `students_staff_read` - matrix nói "không tiếp cận hồ sơ học tập", đã siết attendance/grades nhưng roster tên vẫn mở - cần xác nhận.
