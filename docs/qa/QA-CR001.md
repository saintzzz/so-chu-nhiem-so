# QA Report - CR-001 Ops Modules

Ngày kiểm thử: 2026-09-20 - môi trường production `so-chu-nhiem-so-theta.vercel.app`

## Phạm vi

9 nhóm tính năng của `docs/project/CR-001-ops-modules.md`: báo cáo ngày,
điều động dạy thay, workflow giáo án, trung tâm phê duyệt, dashboard tác vụ,
radar nâng cấp, trợ lý AI BGH, multi-campus/NQ37/TT15, phân cấp Sở-Phòng-UBND.

## Kết quả E2E (Playwright, production)

| Luồng | Kết quả |
|---|---|
| BGH login -> `/school/dashboard` | PASS (ROLE_HOME đúng) |
| Trung tâm phê duyệt: duyệt điều động | PASS - DB `approved`, counter 2->1 |
| Báo cáo ngày các lớp (BGH) | PASS - "0/8 lớp", theo campus |
| Radar: 24 cảnh báo persist, 4 category filter | PASS |
| Radar: "Tiếp nhận xử lý" | PASS - 24->23 mở, status `acknowledged` |
| AI advisor: "bao nhiêu mục chờ duyệt" | PASS - fallback Devin trả "10 mục" đúng DB |
| GVBM nộp giáo án | PASS - `submitted`, notify tổ trưởng |
| Tổ trưởng duyệt giáo án | PASS - `team_approved`, notify BGH + GV |
| BGH duyệt cuối | PASS - `approved`, `reviewed_by` set |
| PHT login, campus scoping | PASS - chỉ thấy lớp 9A2 (Phân hiệu Bản Mới) |
| Phòng GD login | PASS - dashboard "2 trường", cây Sở-Phòng-UBND |
| Deny: phong_gd -> `/school/approvals` | PASS - redirect `/dept/dashboard` |
| Console errors trên production | 0 (3 errors cũ từ session khác) |

## Static gates

- `node scripts/check-consistency.mjs` - all passed
- `npm run typecheck` - PASS
- `npm run lint` - 0 errors (2 warnings cũ trong seed.mjs)
- `npm run build` - PASS, 87 routes

## Lỗi đã sửa trong quá trình test

1. `profiles_role_check` chặn role mới - migration `extend_profile_roles`.
2. `staff-board` render tên chưa sort theo tên gọi VN - thêm `compareVietnameseName`.
3. Trang báo cáo ngày GVCN và BGH lệch ngày (fallback attendance của lớp vs
   của trường) - thống nhất theo school-wide + helper `todayVN()`.
4. `dept/users` thiếu tone cho role mới - bổ sung `ROLE_TONES`.

## Còn lại / theo dõi

- Gemini free-tier hết quota -> AI rơi vào fallback Devin (chậm ~30s, tốn
  credits). Đề xuất thêm `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` làm backup.
- Trang báo cáo ngày GVCN chỉ xử lý lớp chủ nhiệm đầu tiên khi GV chủ nhiệm
  nhiều lớp - cần bộ chọn lớp nếu mở rộng.

---

## Đợt 2 - Gộp màn hình & siết phân quyền (commit 94d555e)

### Thay đổi

- Gộp TT15 vào `/school/campuses` ("Cơ sở & đánh giá TT15"), xóa `/school/tt15`.
- Gộp danh sách GV + nhân sự hỗ trợ + ma trận NQ37 vào `/school/staff`
  ("Nhân sự trường"), xóa `/school/nq37`.
- Bỏ nav "Duyệt kế hoạch" trùng của BGH (đã có Trung tâm phê duyệt).
- Label: bgh -> "Hiệu trưởng / BGH", pht -> "Phó Hiệu trưởng (cơ sở)".
- Điều động dạy thay: chỉ BGH/PHT tạo (bỏ `gvcn` khỏi page guard + action).
- RLS migration `dept_readonly_ops_rls`:
  - Hàm mới `is_school_staff()` = gvcn, gvbm, to_truong, bgh, pht, ke_toan, admin.
  - Mọi policy `ALL` dùng `is_staff()` được tách thành SELECT (is_staff,
    dept vẫn đọc) + INSERT/UPDATE/DELETE (is_school_staff, dept không ghi).
  - `classes_write`, `signoff_insert/update/delete`, `notif_insert_staff`:
    bỏ `so_gd` khỏi đường ghi.

### Verify production

| Kiểm thử | Kết quả |
|---|---|
| Nav BGH | PASS - có "Nhân sự trường", "Cơ sở & đánh giá TT15"; không còn "Duyệt kế hoạch", NQ37 |
| `/school/staff` | PASS - đủ 3 section: Giáo viên / Nhân sự hỗ trợ / Định mức NQ37 |
| `/school/campuses` | PASS - form TT15 + lịch sử đánh giá render trong trang |
| UBND dashboard sau siết RLS | PASS - vẫn đọc được 2 trường, 11 lớp, 371 HS (read-only giữ nguyên) |
| GVCN -> `/school/substitutes` | PASS - redirect về `/dashboard`, không render UI |
| DB audit | PASS - 0 policy ALL còn dùng is_staff; 131 write policy đều role-guarded |
| tsc / lint / checker / build | PASS - 83 routes |

### Ghi chú

- Route `/school/nq37`, `/school/tt15` đã xóa - truy cập trả 404/redirect,
  đúng ý đồ gộp.
- Dept roles giờ read-only toàn bộ dữ liệu vận hành trường ở tầng RLS,
  không chỉ page guard.
