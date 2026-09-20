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

---

# Full System Test - Đợt 3 (2026-09-20)

Phạm vi: RBAC toàn role, business flow E2E, data flow full-cycle, performance,
cross-school leakage. Môi trường: production `so-chu-nhiem-so-theta.vercel.app`.

## Ma trận RBAC (verify qua NEXT_REDIRECT marker + res.url)

| Role | Home | Allowed crawl | Deny test | Kết quả |
|---|---|---|---|---|
| gvcn | /dashboard | 56/56 route render | 17/17 deny -> /dashboard | PASS |
| gvbm | /academics/grades | 6/6 | deny -> /academics/grades; /safety/report cho phép có chủ đích | PASS |
| to_truong | /team/home | 8/8 | deny -> /team/home | PASS |
| bgh | /school/dashboard | 17/17 + 4 route giám sát (students, attendance, conduct, grades - có chủ đích) | deny đúng | PASS |
| pht | /school/dashboard | 9/9 (sau fix) | campus scope: chỉ lớp 9A2 | PASS |
| ke_toan | /school/staff | 2/2 | 8/8 deny -> /school/staff | PASS |
| so_gd | /dept/dashboard | 3/3 | 6/6 deny -> /dept/dashboard | PASS |
| phong_gd | /dept/dashboard | 1/1 | 7/7 deny -> /dept/dashboard | PASS |
| ubnd | /dept/dashboard | 1/1 | 6/6 deny -> /dept/dashboard | PASS |
| phu_huynh | /portal/parent | portal only | 7/7 route nội bộ -> /portal/parent (kể cả /portal/student) | PASS |
| hoc_sinh | /portal/student | portal only | 7/7 -> /portal/student | PASS |
| gvcn-th | /dashboard | lớp 3A, trường Tiểu học Chu Văn An | - | PASS |
| bgh-th | /school/dashboard | trường Tiểu học Chu Văn An (sau fix tên) | /dept/* deny | PASS |

## Business flow E2E (đợt này)

| Luồng | Kết quả |
|---|---|
| GVCN ghi nhận sự cố -> incidents + notif BGH | PASS - DB `new`, notif tới bgh@ |
| GVCN gửi thông báo PH -> announcements | PASS - persist, class_id=6A1, portal PH query đúng class_id con |
| GVCN tiếp nhận ca tư vấn -> assessment | PASS - case `Mới` xuất hiện ở màn đánh giá |

## Bug phát hiện & đã fix

1. **Cross-school notification leak**: `createIncident` gửi notif tới MỌI
   profile role=bgh toàn hệ thống (bgh-th nhận sự cố của THCS Nguyễn Du).
   Fix: scope `school_id` + PHT theo `campus_id` của lớp. Commit `88e080f`.
2. **Cross-school teacher list**: teacher-chat, exams proctor list, timetable
   BGH-view liệt kê GV mọi trường. Fix: `.eq("school_id")`. Commit `88e080f`.
3. **PHT redirect loop**: nav trỏ 3 route mà guard chặn pht
   (/school/dashboard, /safety/bgh, /schedule/timetable; ROLE_HOME.pht trùng
   trang bị chặn -> tự redirect). Fix: thêm pht vào guard + campus scope.
   Commit `bbde27a`.
4. **Tên trường hard-code**: /school/dashboard hiển thị "THCS Nguyễn Du" cho
   mọi trường. Fix: query `schools.name` theo profile. Commit `bbde27a`.
5. **Prompt AI hard-code "THCS"**: đổi "trường THCS Việt Nam" -> "trường phổ
   thông Việt Nam" (6 file). Commit `bbde27a`.

## Performance - root cause + fix hệ thống

- Triệu chứng: `/dept/dashboard` ~5.5s, `/school/radar` ~1.1s,
  `/register/signoff` ~1.0s.
- Nguyên nhân: 140 policy `qual` + 88 `with_check` gọi `is_staff()`,
  `is_school_staff()`, `my_role()`, `my_school_id()`, `auth.uid()` TRỰC TIẾP
  -> Postgres eval lại cho từng row.
- Fix: migration `rls_initplan_perf_wrap` - DO block wrap mọi hàm vào
  `(select fn())` (initplan, eval 1 lần/query) cho toàn bộ 220 policy.

| Route | Trước | Sau |
|---|---|---|
| /dept/dashboard | ~5500ms | ~600ms (9x) |
| /school/radar | ~1098ms | ~550ms |
| /register/signoff | ~1018ms | ~270ms |
| Các route còn lại | 185-950ms | 217-590ms |

Mọi route chính < 1s, đạt ngưỡng.

## Còn theo dõi

- `dept/users` (so_gd/admin) liệt kê toàn bộ profiles - có chủ đích (quản trị).
- AI fallback Devin ~10-30s khi LLM chính hết quota (giới hạn engine);
  UI chỉ hiện progress trung lập.
- E2E artifacts trong DB: incident "[E2E-TEST]", announcement "[E2E]",
  counseling case "[E2E]" của lớp 6A1 - có thể xóa khi lên data thật.
