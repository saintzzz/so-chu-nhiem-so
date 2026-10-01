# CR-020: Audit trail coverage + export cho hồ sơ điện tử

**Date:** 2026-10-01
**Status:** Implemented
**Driver:** PO ecosystem review - TT 15/2026/TT-BGDĐT cong nhan ho so dien tu co gia tri phap ly tuong duong giay, dong nghia nha truong phai chung minh duoc "ai sua gi, khi nao". Trang `/register/audit` da ton tai nhung chi hien thi du lieu co log - phan lon mutation ho so (diem, diem danh, hanh kiem, so dau bai) chua goi `logAudit` nen audit trail trong rong o nhung cho quan trong nhat.

## What changed

1. **Mo rong coverage `logAudit`** (fire-and-forget, khong chan luong chinh) vao 5 write path ho so dien tu:
   - `components/academics/grades-editor.tsx` - `grades.save` sau RPC `scn_save_grades` (subject, term, so dong diem).
   - `components/attendance/daily-roster.tsx` - `attendance.confirm` sau upsert `attendance_records` (date, so HS).
   - `components/schedule/period-log-board.tsx` - `period_log.save` sau ghi so dau bai + dong bo vang (log_id, so vang).
   - `components/conduct/record-form.tsx` - `conduct.record.create` (type, points, student_id).
   - `components/conduct/evaluation-editor.tsx` - `conduct.evaluation.save` (term, so HS danh gia).
2. **Export CSV**: `src/app/(app)/register/audit/export/route.ts` - `GET /register/audit/export?type=audit|records&from&to&actor&q&class&student`, tra file CSV UTF-8-BOM (mo duoc bang Excel). Role guard `gvcn|bgh`, scope theo truong/lop giong trang audit.
3. **`/register/audit` page**: them nut "Xuat CSV" giu nguyen bo loc hien tai.

## Impact assessment

- Chi them goi `logAudit` (da la fire-and-forget) vao existing write path - khong thay doi data flow hay RLS.
- Export route chi doc `audit_logs`/`student_record_history` qua RLS + role guard tuong duong page.
- Khong migration moi.

## Estimate

~0.5 ngay. Risk thap.

## Verification

- typecheck + lint + `check-consistency.mjs` xanh.
- Luu diem/diem danh/so dau bai tren dev -> row moi xuat hien trong `/register/audit`.
- `GET /register/audit/export?type=audit` tra CSV dung bo loc.

## Follow-ups

- Can nhac immutable hash-chain hoac ky so khi TT 15/2026 huong dan chi tiet chung thuc ho so dien tu.
