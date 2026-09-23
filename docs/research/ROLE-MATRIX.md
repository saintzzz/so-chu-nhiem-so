# Ma trận vai trò & trách nhiệm - Giáo dục Việt Nam hiện hành

Nguồn pháp lý:

- **TT 32/2020/TT-BGDĐT** - Điều lệ trường THCS, THPT và trường phổ thông có nhiều cấp học (Điều 11-16, 27-38, 44)
- **TT 28/2009/TT-BGDĐT** (sửa bởi TT 15/2017) - Chế độ làm việc GV phổ thông, nhiệm vụ GVCN (Điều 4)
- **TT 22/2021/TT-BGDĐT** - Đánh giá kết quả học tập và rèn luyện của HS THCS/THPT
- **TT 12/2020/TT-BGDĐT** (nay là TT 15/2025 + TT 45/2026) - Chức năng Sở/Phòng GD&ĐT

## 1. Vai trò app → vai trò thực tế

| Role code | Vai trò VN | Căn cứ | Ghi chú |
|---|---|---|---|
| `gvcn` | Giáo viên chủ nhiệm | Điều 28 Điều lệ + Điều 4 TT 28/2009 | Kiêm nhiệm GVBM của lớp mình |
| `gvbm` | Giáo viên bộ môn | Điều 27 Điều lệ | |
| `to_truong` | Tổ trưởng chuyên môn | Điều 14 Điều lệ | Kiêm nhiệm GVBM (do HT bổ nhiệm) |
| `bgh` | Hiệu trưởng + Phó hiệu trưởng | Điều 11 Điều lệ | App gộp BGH thành 1 role |
| `pht` | Phó hiệu trưởng phụ trách | Điều 11 Điều lệ | Tách riêng khỏi `bgh` - quản lý vận hành, không ký duyệt sổ |
| `ke_toan` | Kế toán / cán bộ tài chính trường | Điều 15 Điều lệ (tổ văn phòng) | Quản lý tài sản, thiết bị, nhân sự hành chính - không tiếp cận hồ sơ học tập HS |
| `so_gd` | Cán bộ Sở GD&ĐT | TT 12/2020, 15/2025 | Cơ quan quản lý nhà nước cấp tỉnh |
| `phong_gd` | Cán bộ Phòng GD&ĐT | TT 12/2020, 15/2025 | Cơ quan quản lý nhà nước cấp huyện |
| `ubnd` | Lãnh đạo UBND | Luật Tổ chức chính quyền địa phương | Giám sát, nhận báo cáo - không can thiệp nghiệp vụ trường |
| `phu_huynh` | Cha mẹ HS / Ban đại diện CMHS | Điều 44 Điều lệ | |
| `hoc_sinh` | Học sinh | Điều 34-38 Điều lệ | |
| `admin` | Quản trị hệ thống | - | Vai trò kỹ thuật, không phải vai trò nghiệp vụ |

## 2. Ma trận trách nhiệm → phân hệ app

### GVCN (Điều 4 TT 28/2009 + Điều 28 Điều lệ)

| Nhiệm vụ pháp lý | Phân hệ app | Quyền |
|---|---|---|
| Nắm vững HS lớp mọi mặt, hồ sơ HS | `records/*` | CRUD |
| Theo dõi chuyên cần, nghỉ học/đi muộn, báo PH | `attendance/*` | CRUD |
| Tổng hợp kết quả học tập lớp, phối hợp GVBM | `academics/*` (analysis, support, plans, chats) | CRUD |
| Nhận xét, đánh giá xếp loại HK/HL, đề nghị khen thưởng kỷ luật | `conduct/*`, `emulation/*` | CRUD |
| Phối hợp gia đình HS, Ban đại diện CMHS | `parents/*` | CRUD |
| Hướng dẫn hoạt động tập thể, HĐGD do trường tổ chức | `activities/*` | Lập kế hoạch + thực hiện |
| Ghi nhận/báo cáo sự cố an toàn HS | `safety/report`, `followup`, `archive` | CRUD |
| Tư vấn, phát hiện HS cần hỗ trợ tâm lý | `counseling/*` | CRUD |
| Sổ chủ nhiệm (hồ sơ bắt buộc, Điều 27.3d) | `register/*` (trừ signoff, lock-records) | CRUD |
| Ghi sổ đầu bài tiết mình dạy + theo dõi lớp CN | `schedule/*` | CRUD |
| Tự đánh giá năng lực, minh chứng cuối năm | `competency/*` | CRUD |
| Dự giờ học của lớp mình chủ nhiệm | `schedule/period-log` (xem mọi tiết) | Read |

### GVBM (Điều 27 Điều lệ)

| Nhiệm vụ pháp lý | Phân hệ app | Quyền |
|---|---|---|
| Giảng dạy theo TKB, ghi sổ đầu bài | `schedule/timetable`, `schedule/period-log` | CRUD (tiết của mình) |
| Đánh giá, cho điểm HS theo TT 22/2021 | `academics/grades` | CRUD (môn mình) |
| Phối hợp GVCN về HS | `academics/teacher-chat` | CRUD |
| Ghi nhận sự cố trong giờ dạy | `safety/report` | Create |

### Tổ trưởng chuyên môn (Điều 14 Điều lệ)

| Nhiệm vụ pháp lý | Phân hệ app | Quyền |
|---|---|---|
| Xây dựng KH dạy học của tổ, sinh hoạt CM ≥1 lần/2 tuần | `team/home`, `team/meetings` | CRUD |
| Tham gia đánh giá, xếp loại GV theo chuẩn nghề nghiệp | `team/teachers`, `team/review` | Duyệt |
| Kiêm nhiệm GVBM: dạy, ghi sổ đầu bài, cho điểm | `schedule/*`, `academics/grades`, `academics/teacher-chat`, `safety/report` | CRUD phạm vi GV |

### BGH - Hiệu trưởng & Phó HT (Điều 11 Điều lệ)

| Nhiệm vụ pháp lý | Phân hệ app | Quyền |
|---|---|---|
| Quản lý, điều hành, chất lượng giáo dục toàn trường | `school/dashboard`, `school/radar` | Read |
| Xét duyệt kết quả đánh giá xếp loại HS, ký học bạ | `register/signoff`, `register/lock-records` | Duyệt |
| Phê duyệt kế hoạch giáo dục, HĐGD | `activities/plan` | Duyệt |
| Xử lý sự cố an toàn toàn trường | `safety/bgh` | Xử lý |
| Quyết định khen thưởng, kỷ luật HS | `emulation/ranking` | Duyệt |
| Giám sát mọi phân hệ nghiệp vụ (đọc) | `records`, `attendance`, `academics`, `conduct`, `counseling`, `parents`, `safety`, `emulation` | Read |
| Quản lý TKB toàn trường | `schedule/timetable` | Read |

### PHT - Phó hiệu trưởng phụ trách (Điều 11 Điều lệ)

| Nhiệm vụ pháp lý | Phân hệ app | Quyền |
|---|---|---|
| Điều hành vận hành trường được phân công | `school/*` (trừ `assignments`, `users`) | Read/quản lý |
| Xử lý sự cố an toàn theo phân công | `safety/bgh` | Xử lý |
| Giám sát TKB | `schedule/timetable` | Read |
| **Không** phân công GVCN/lớp, không quản users | `school/assignments`, `school/users` | Deny (chỉ BGH) |
| **Không** tiếp cận hồ sơ chi tiết HS | `school/students` | Deny (theo CR-016) |

### Kế toán (tổ văn phòng - Điều 15 Điều lệ)

| Nhiệm vụ pháp lý | Phân hệ app | Quyền |
|---|---|---|
| Quản lý nhân sự hành chính, lương | `school/staff` | Read |
| Quản lý cơ sở vật chất, thiết bị | `school/campuses`, `school/equipment` | CRUD |
| Báo cáo tài chính theo NQ37 | `school/nq37` | CRUD |
| **Không** tiếp cận hồ sơ/dữ liệu học tập HS | `school/students`, `records/*`, `academics/*` | Deny (theo CR-016) |

### Sở/Phòng GD&ĐT + UBND (TT 12/2020, TT 15/2025)

| Nhiệm vụ pháp lý | Phân hệ app | Quyền |
|---|---|---|
| Tham mưu quản lý nhà nước, quản lý đội ngũ | `dept/users` | CRUD (so_gd) |
| Kiểm tra, giám sát chất lượng giáo dục | `dept/dashboard` | Read |
| Quản lý dữ liệu ngành | `dept/data` | CRUD (so_gd) |
| Giám sát CSVC, báo cáo, địa bàn | `dept/facilities`, `dept/reports`, `dept/wards` | Read |
| **Không** can thiệp nghiệp vụ trong trường | mọi route khác | Deny |

### Phụ huynh (Điều 44 Điều lệ)

| Nhiệm vụ pháp lý | Phân hệ app | Quyền |
|---|---|---|
| Được thông tin tình hình học tập, rèn luyện con | `portal/parent` | Read (con mình) |
| Trao đổi, phản hồi với GVCN/nhà trường | `portal/parent` (messages) | Create |

### Học sinh (Điều 34-38 Điều lệ)

| Nhiệm vụ pháp lý | Phân hệ app | Quyền |
|---|---|---|
| Xem điểm, chuyên cần, TKB, thông báo của mình | `portal/student` | Read (bản thân) |

## 3. Ma trận quyền route (implement - đồng bộ `scripts/qa-full-coverage.mjs`)

| Route | Roles được phép |
|---|---|
| `dashboard` | gvcn |
| `attendance/daily-report` | gvcn |
| `attendance/*` (còn lại) | gvcn, bgh |
| `records/*` | gvcn, bgh |
| `academics/grades`, `academics/exams` | gvcn, gvbm, to_truong, bgh |
| `academics/lesson-plans` | gvcn, gvbm |
| `academics/analysis`, `support`, `plans` | gvcn, bgh |
| `academics/teacher-chat` | gvcn, gvbm, to_truong |
| `academics/parent-chat` | gvcn |
| `conduct/*` | gvcn, bgh |
| `counseling/*` | gvcn, bgh |
| `parents/*` | gvcn, bgh |
| `activities/*` | gvcn, bgh |
| `safety/report` | gvcn, gvbm, to_truong, bgh |
| `safety/bgh` | bgh, pht |
| `safety/followup`, `archive` | gvcn, bgh |
| `register/roster`, `seating`, `seating-history`, `year-events`, `suggestions`, `plans`, `kpi`, `export` | gvcn |
| `register/signoff`, `lock-records`, `audit` | gvcn, bgh |
| `schedule/timetable` | gvcn, gvbm, to_truong, bgh, pht |
| `schedule/period-log` | gvcn, gvbm, to_truong |
| `emulation/*` | gvcn, bgh |
| `competency/*` | gvcn, gvbm, to_truong |
| `team/*` | to_truong |
| `school/assignments`, `school/users` | bgh |
| `school/staff`, `school/campuses`, `school/equipment`, `school/nq37` | bgh, pht, ke_toan |
| `school/*` (còn lại) | bgh, pht |
| `dept/users`, `dept/data` | so_gd |
| `dept/*` (còn lại) | so_gd, phong_gd, ubnd |
| `portal/parent` | phu_huynh |
| `portal/student`, `portal/student/hoc-ba` | hoc_sinh |
| `profile`, `notifications` | mọi role trong trường (trừ phu_huynh, hoc_sinh) |

## 4. RLS write-scope (CR-016 - thực thi ở DB, không chỉ route guard)

| Bảng | Quy tắc ghi |
|---|---|
| `period_logs`, `period_absences` | Chỉ GV được phân công tiết đó (`scn_is_my_ttentry`) hoặc bgh/admin |
| `grades` | GVBM/GVCN chỉ ghi lớp+môn mình dạy (`scn_student_in_my_teaching`); GVCN không ghi đè điểm GVBM |
| `register_signoffs` | GVCN: pending/rejected -> submitted; BGH/admin: approve/reject/reopen + tạo đợt; GVCN không tự ký |
| `classes` (phân công lớp, GVCN) | Chỉ bgh/admin |
| `emulation_scores` | GVCN: lớp mình chủ nhiệm; BGH/admin: toàn trường |
| `attendance_records`, `conduct_records` | GVCN lớp CN / GV tiết dạy / bgh / admin |
| `notifications` insert | Staff hoặc PH/HS có liên kết trong trường, recipient cùng trường |
| Các bảng nghiệp vụ còn lại | Role-scoped theo `my_role()` + helper `scn_*_in_school`/`scn_student_in_my_homeroom` - chi tiết `supabase/migrations/20260925_cr016_role_scope.sql` |

## 5. Khác biệt có chủ đích so với thực tế

- `bgh` = Hiệu trưởng (quyền ký duyệt, phân công); `pht` = Phó HT (vận hành, không ký sổ/phân công)
- Chưa mô hình: Tổ văn phòng đầy đủ (văn thư, y tế, thư viện - Điều 15, hiện chỉ có `ke_toan`), TPT Đội/cán bộ tư vấn riêng, Hội đồng trường, Ban đại diện CMHS (chỉ có phụ huynh thường)
- `admin` là vai trò kỹ thuật, giới hạn ở `dept/*` + `school/*` read
