# CR-001: Ops Modules từ school-management reference

**Trạng thái:** Approved (user duyệt scope "Tất cả 1-9" qua Q&A)
**Nguồn tham chiếu:** https://school-management-red-one.vercel.app (multi-campus, phân cấp Sở-Phòng-UBND, quy trình nghiệp vụ hàng ngày)
**Ngày:** 2026-09-18

## 1. Phạm vi thay đổi (đã duyệt)

| # | Tính năng | Mô tả |
|---|-----------|-------|
| 1 | Báo cáo ngày GVCN→BGH | Auto-đếm vắng/muộn/vi phạm/khen thưởng từ data thật, AI soạn nháp, BGH theo dõi tỉ lệ nộp |
| 2 | Điều động dạy thay | Request + gợi ý GV cùng môn rảnh tiết + phê duyệt BGH |
| 3 | Giáo án (KHBD) workflow | GVBM nộp → tổ trưởng duyệt → BGH duyệt |
| 4 | Dashboard tác vụ GV | "Chưa điểm danh / chưa nộp báo cáo / chưa đánh giá HK" |
| 5 | Radar nâng cấp | Phân loại rủi ro + persist `early_warnings` + acknowledge + AI đề xuất |
| 6 | Trung tâm phê duyệt BGH | Queue gộp: giáo án + dạy thay + kế hoạch HĐ |
| 7 | Trợ lý AI BGH | Chat tư vấn trên số liệu trường thật |
| 8 | Multi-campus | `campuses` (cơ sở chính/phân hiệu/điểm trường), classes + profiles gắn campus, vai trò PHT scoped |
| 9 | NQ37 + TT15 + phân cấp | Nhân sự hỗ trợ, ma trận định mức, đánh giá TT15 theo cơ sở, org_units Sở→Phòng→UBND + vai trò phong_gd/ubnd/ke_toan |

## 2. Impact Assessment

### Data model (đã migrate - `add_ops_modules`)
- Bảng mới: `org_units`, `campuses`, `daily_reports`, `substitute_requests`, `lesson_plans`, `support_staff`, `early_warnings`, `tt15_evaluations`
- Cột mới: `schools.org_unit_id`, `classes.campus_id`, `profiles.campus_id`, `profiles.org_unit_id`
- `is_staff()` mở rộng: `pht`, `ke_toan`, `phong_gd`, `ubnd`
- RLS: tất cả bảng mới dùng policy `is_staff()` (nội bộ nhà trường)
- Indexes: daily_reports(class,date), substitute(school,date), lesson_plans(school,status), early_warnings(school,status), classes(campus)

### Ảnh hưởng module hiện có
- **RBAC:** thêm 4 role → `Role` type, `ROLE_HOME`, `STAFF_ROLES`, nav config, seed
- **Nav:** gvcn +Báo cáo ngày; gvbm +Giáo án; to_truong +Duyệt giáo án; bgh +Báo cáo ngày/Điều động/Phê duyệt/Nhân sự/NQ37/TT15/Trợ lý AI; so_gd +phân cấp
- **Dashboard GVCN:** thêm pending-task card (đọc attendance_records + daily_reports + conduct_evaluations)
- **Radar:** persist sang `early_warnings` thay vì chỉ computed (data linkage rule)
- **Không phá vỡ:** campus_id nullable - lớp không gán vẫn hoạt động; mọi trang hiện có giữ nguyên

### Data linkage (theo rule consistency)
- daily_reports.auto-counts ← attendance_records + conduct_records cùng ngày
- substitute_requests ← timetable_entries (gợi ý GV rảnh) + teacher_subjects (cùng môn)
- early_warnings ← attendance/incidents/counseling/grades (computed → persisted, dedupe_key)
- Event → notification: nộp báo cáo → BGH; duyệt dạy thay → GVCN/GV liên quan; giáo án chuyển trạng thái → GV nộp

### Estimate (tách khỏi estimate gốc)
- Schema + seed: ~0.5 ngày (đã xong)
- UI 9 nhóm tính năng + nav + types: ~2 ngày
- Tester E2E theo vai trò + consistency checker mở rộng: ~0.5 ngày
- **Rủi ro:** scope lớn - ưu tiên mỗi tính năng "đủ dùng thật" (ghi đọc DB thật, đúng RBAC) trước khi đẹp

## 3. Re-entry point

BA xác nhận requirements (bảng trên) → Tech Lead confirm schema (đã migrate, ADR cập nhật) → Developer implement UI → Tester E2E → Deployer.

## 4. Artifact cascade

- [ ] PRD.md - thêm section ops modules
- [ ] ROLE-MATRIX.md - thêm pht/ke_toan/phong_gd/ubnd
- [ ] ARCHITECTURE.md - thêm bảng mới + flows
- [ ] Nav + types + checker rules
- [ ] QA-REPORT.md - test mới
