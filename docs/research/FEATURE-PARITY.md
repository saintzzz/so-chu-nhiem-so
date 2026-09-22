# So sánh chức năng: App vs site tham chiếu

Nguồn đối chiếu:
- `school-management-red-one.vercel.app` (audit trực tiếp 8 role qua Playwright)
- `mockup-so-chu-nhiem.vercel.app` (audit nav ở session trước)

Convention: ✅ có | 🟡 có nhưng thiếu chiều sâu | ❌ thiếu | ➕ ta có, ref không có

## 1. Giáo viên (GVCN + GVBM gộp)

| Ref (teacher/*) | Chức năng | App ta | Trạng thái |
|---|---|---|---|
| dashboard 360° | KPI lớp + việc cần làm | /dashboard (đa lớp, date/range) | ✅ (vượt ref) |
| schedule | TKB tuần cá nhân | /schedule/timetable | ✅ |
| attendance | Điểm danh theo ca | /attendance/daily + leaves/tracking/history | ✅ |
| grades | Sổ nhập điểm | /academics/grades (TT22 động) | ✅ |
| lesson-plans | Giáo án | /academics/lesson-plans + file đính kèm | ✅ (vượt ref) |
| journal | Sổ đầu bài | /schedule/period-log | ✅ |
| daily-report | Báo cáo ngày (vắng/muộn/vi phạm/khen) | /attendance/daily-report | ✅ |
| homeroom | Sổ CN điện tử + DS HS | /register/* (11 màn) | ✅ (vượt ref) |
| profile | Hồ sơ giáo viên cá nhân | **không có route** | ❌ |
| subject-head (tổ trưởng) | Không gian tổ CM | /team/* (5 màn) | ✅ |

## 2. BGH / Hiệu trưởng (admin/*)

| Ref | Chức năng | App ta | Trạng thái |
|---|---|---|---|
| dashboard | Điều hành nhà trường | /school/dashboard | ✅ |
| approvals | Trung tâm phê duyệt + quản lý tài khoản | /school/approvals (duyệt thôi) | 🟡 thiếu phần quản lý tài khoản GV |
| kpi + strategy | KPI toàn trường, chiến lược 5 năm, phân bổ chỉ tiêu phân hiệu | /register/kpi (chỉ GVCN đăng ký) | ❌ thiếu strategy/KPI cấp trường |
| data-lock | Khóa sổ dữ liệu | /register/lock-records | ✅ |
| transcripts | Duyệt & khóa học bạ | /register/lock-records | ✅ |
| campuses | Cơ sở & phân hiệu | /school/campuses (+TT15) | ✅ |
| equipment | Thiết bị số & CSVC | không có | ❌ |
| notifications | Thông báo trường | /parents/compose (chỉ tới PH) | 🟡 thiếu thông báo toàn trường/BN |
| exam-analytics | Phân tích điểm thi | /academics/analysis (lớp, không cấp trường) | 🟡 |
| nq37-compliance | Định mức biên chế NQ37 | không có | ❌ |
| early-warnings | Radar cảnh báo sớm | /school/radar | ✅ |
| support-staff | Nhân sự hỗ trợ giáo dục | /school/staff (nhân sự chung) | 🟡 |
| lesson-plans (duyệt) | Phê duyệt giáo án BGH | /school/approvals | ✅ |
| substitute-dispatch | Điều động dạy thay đa điểm trường | /school/substitutes | ✅ |
| schedule (xếp TKB) | Xếp TKB thông minh | /schedule/timetable (chỉ xem) | 🟡 thiếu TKB editor |
| students | Hồ sơ HS cấp trường | /school/* chưa có màn này riêng | 🟡 (xem qua register/roster của lớp) |
| daily-reports | Báo cáo ngày tổng hợp | /school/daily-reports | ✅ |
| emulation | Bảng vàng thi đua | /emulation/* | ✅ |
| tt15-evaluation | Đánh giá TT15 | /school/campuses (gộp) | ✅ |
| users-manager | Quản trị người dùng | /dept/users (chỉ so_gd/admin) | 🟡 BGH không quản được GV trong trường |

## 3. Học sinh (student/*)

| Ref | Chức năng | App ta | Trạng thái |
|---|---|---|---|
| dashboard | Chào + khen thưởng + lịch hôm nay + thông báo + streak chuyên cần | /portal/student (điểm/chuyên cần/hạnh kiểm/thi/sự kiện/thông báo) | 🟡 thiếu: lịch học hôm nay, streak, khen thưởng |
| schedule | Lịch học tuần | không có trong portal HS | ❌ |
| grades | Bảng điểm môn | portal/student (ĐTBm bảng) | ✅ |
| attendance | Nhật ký chuyên cần cá nhân | StatCard chuyên cần (không có nhật ký chi tiết) | 🟡 |
| transcript | Học bạ điện tử của em | không có | ❌ |
| profile | Hồ sơ cá nhân | không có | ❌ |

## 4. PHT / Phó hiệu trưởng phân hiệu

| Ref | App ta | Trạng thái |
|---|---|---|
| dashboard phân hiệu | /school/dashboard | ✅ |
| journals (sổ đầu bài phân hiệu) | không có view riêng | ❌ |
| lesson-plans duyệt | /school/approvals | ✅ |
| warnings | /school/radar | ✅ |
| classes + students | không có màn danh sách lớp/HS cấp phân hiệu | 🟡 |
| KPI principal-dashboard | /register/kpi | 🟡 |

## 5. Cấp quản lý (Sở/Phòng/UBND)

| Ref | App ta | Trạng thái |
|---|---|---|
| department/dashboard | /dept/dashboard | ✅ |
| wards (DS Phòng GD) | không có | ❌ |
| thpt-schools | /dept/dashboard (trường) | 🟡 |
| reports (báo cáo tổng hợp Sở) | không có trang báo cáo riêng | ❌ |
| ward/schools + reports + facilities | /dept/dashboard gộp | 🟡 (ref có 3 trang riêng, ta 1) |

## 6. Ta CÓ mà ref KHÔNG có (vượt)

Phụ huynh portal đầy đủ (tin nhắn, lịch hẹn, hoạt động, CMHS, sự kiện năm học), counseling 3 màn, safety 4 màn, activities 3 màn, competency tự đánh giá, register/* 11 màn sổ CN, AI advisor, records intake/upload/history, sơ đồ chỗ ngồi kéo-thả + praise mode, notifications in-app + email Resend, RBAC 12 role + RLS tenant, seating history, KPI GVCN.

## Tổng kết gap cần quyết định

**❌ Thiếu hẳn (5):**
1. Hồ sơ cá nhân (GV + HS) - trang profile
2. Học bạ điện tử cho HS (transcript)
3. Lịch học tuần trong portal HS + streak chuyên cần
4. Trang Strategy/KPI cấp trường cho BGH
5. Thiết bị số & CSVC (kế toán/BGH)
6. NQ37 định mức biên chế
7. Sổ đầu bài cấp phân hiệu cho PHT
8. Dept: wards list, reports tổng hợp, facilities
9. TKB editor (xếp TKB cho BGH)

**🟡 Có nhưng cần nâng (5):**
- BGH quản lý tài khoản GV, thông báo toàn trường, exam-analytics cấp trường, support-staff riêng, students cấp trường
