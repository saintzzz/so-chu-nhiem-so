# QA Lifecycle E2E - 10/10/2026 (prod)

Test full luồng onboarding trường mới trên production `sochunhiem.vieschool.com`,
bám quy trình đầu năm học thật của trường VN (deep research: Sở/Phòng cấp chỉ
tiêu → trường lập phương án lớp → phân công GVCN/GVBM → GVCN nhận danh sách,
điểm danh, liên kết phụ huynh).

Script: `scripts/qa-lifecycle-e2e.mjs` - chạy `node scripts/qa-lifecycle-e2e.mjs [--keep]`.
Report JSON: `docs/qa/lifecycle-e2e-2026-10-10.json`.

## Kết quả: 23 PASS / 0 FAIL

| Stage | Luồng | Evidence |
|---|---|---|
| A - Sở GD | Tạo trường `QAE*` qua `/dept/schools` | `schools` row + auto-seed: 1 năm học, 2 tổ, 14 môn, profile `bgh` |
| B - BGH | Login lần đầu → tạo GVCN + GVBM → tạo lớp 6A1 → import CSV 6 HS → phân công GVCN → xem danh sách | `profiles` +2, `classes` row, `students` =6, `classes.gvcn_id` persisted, 6/6 tên hiển thị |
| C - GVCN | Login → điểm danh ngày (1 vắng KP) → liên kết + cấp tài khoản PH → deny `/school/users` → Studio A-01 generate | `attendance_records` =6 (1 `unexcused`), `parents`+`parent_students`+auth user PH, redirect `/dashboard`, AI 200 (7.4s) |
| D - GVBM | Login → deny `/records/students` + `/school/users` | Redirect về home riêng `/academics/grades` - không leak data |
| E - PH + output | Login PH → `/portal/parent` thấy HS liên kết; audit + profile check | `audit_logs` 3 actions (`attendance.confirm`, `Tạo + liên kết phụ huynh`, `parent.grant_access`); profiles=4 (bgh+gvcn+gvbm+phu_huynh) |
| F | Cleanup | Toàn bộ school/profiles/students/auth users của `QAE*` đã xóa |

Mọi mutation đều verify bằng query service-role sau khi UI báo thành công
(không chỉ nhìn UI state).

## Timing (prod, DB khỏe)

Login ~2s mọi vai trò. Tạo trường 5.1-5.8s. Tạo GV ~1.5s/tài khoản. Import 6 HS
1.8s. Điểm danh + lưu 1.7s. Liên kết PH + cấp account 3s. Studio A-01 generate
7.4s (chuỗi fallback Gemini multi-key đã deploy - commit `988c61c`).

## Mapping quy trình thực tế

| Bước thực tế (VN) | App | Ghi chú |
|---|---|---|
| Sở/Phòng cấp chỉ tiêu, trường tồn tại | `so_gd` tạo school `/dept/schools` | auto-seed năm học + tổ + môn |
| Trường lập lớp, phân công GVCN | BGH `/records/intake` + `/school/assignments` | phần "bốc thăm công khai" nằm ngoài app (minh bạch hóa) |
| Phân công GVBM + môn | `/school/assignments` + `/school/users` | teacher_subjects gán qua RPC |
| GVCN nhận danh sách, điểm danh | `/attendance/daily` | lưu `attendance_records` đủ 6/6 |
| Liên kết PH, cấp account | `/register/roster` → `/portal/parent` | email-only channel đúng thiết kế |
| Hồ sơ chủ nhiệm/sổ | `/records/*`, `/register/*` | đã cover trong suite qa-full-coverage |

## Incidents phát hiện qua Supabase MCP trong lúc debug

- `42703` × 14 + PostgREST 400 trên `audit_logs`/`teacher_subjects`: **lỗi script
  QA**, không phải app - script filter `school_id` trên 2 bảng không có cột đó
  (`audit_logs` dùng `actor_id`, `teacher_subjects` dùng `teacher_id`). Đã sửa.
- `get_ai_configs` RPC 404 × 1: không phải code repo này gọi (rpc thuộc
  `student-self-practice-web`), bỏ qua.
- Auth `/token` 400 burst ngắn + `invalid_credentials`: một phần do cleanup xóa
  user còn test cũ đang dùng; script đã có retry 3 lần.
- Supabase micro compute throttle theo đợt (burst credit) - các fail ban đầu
  (`profiles` 16-51s, page loadError) là hệ quả, không phải bug app. Khi DB khỏe
  toàn bộ flow xanh.

## Product notes (không block, cân nhắc backlog)

1. BGH tạo lớp qua `/records/intake` → `classes.gvcn_id` default = chính BGH
   (creator). Nên để trống hoặc chặn role BGH khỏi gvcn_id - hiện sửa được qua
   `/school/assignments`.
2. `check-consistency` chưa chạy nổi trên DB prod-size: `attendance_records`
   full-scan vượt statement timeout khi instance throttle. Cần phân trang/lọc
   trong script.

## Known limits

- Deny-path kiểm bằng redirect URL (đúng chuẩn "redirect về home riêng").
- Studio A-01 verify status 200; nội dung doc đã có kiểm thử riêng trong
  đợt multi-key fallback (commit `988c61c`).
