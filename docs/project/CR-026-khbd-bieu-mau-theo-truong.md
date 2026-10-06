# CR-026 - Kế hoạch bài dạy: biểu mẫu cấu hình theo trường + điều chỉnh sau bài dạy

## 1. Bối cảnh

DC-01 "Biên soạn kế hoạch bài dạy" là công cụ P0 đầu tiên của đề án (chuỗi
DC-01→DC-04). Đề án chỉ rõ: Phụ lục IV CV 5512 là **khung tham khảo, không bắt
buộc** → "nền tảng phải cho phép cấu hình biểu mẫu theo từng đơn vị" (Tầng 2).
Trước CR này, fallback DC-01 hard-code đúng 1 khung 4 hoạt động và thiếu phần
điều chỉnh sau bài dạy + khối ký duyệt mà trường nộp giáo án thường yêu cầu.

Phân loại: **CR** - yêu cầu biểu mẫu cấu hình được.

## 2. Phạm vi thay đổi

- `supabase/migrations/20261006_cr026_khbd_templates.sql`: bảng `tvc.khbd_templates`
  (school_id nullable - null = mẫu hệ thống; activities jsonb [{name, minutes,
  hint}]; include_review/include_signoff; is_default), RLS đọc (hệ thống + trường
  mình), ghi chỉ `to_truong/bgh/admin`; view public `tvc_khbd_templates`
  `security_invoker=true`; seed mẫu hệ thống khung 4 HĐ CV 5512.
- `src/app/api/studio/context/route.ts`: `kind=khbd_templates`.
- `src/lib/tvc/registry.ts`: DC-01 thêm field `khbd_template` (select động).
- `src/components/tvc/tool-runner.tsx`: nạp options mẫu khi DC-01, auto-chọn mẫu
  `is_default`.
- `src/app/api/studio/tools/[code]/generate/route.ts`: fetch mẫu theo id →
  `ctx.extra.khbdTemplate` (RLS scope tự động: chỉ đọc được mẫu hệ thống + trường).
- `src/lib/tvc/fallbacks.ts`: `fbLessonPlan` render hoạt động theo mẫu (tên +
  số phút + gợi ý), mặc định vẫn 4 HĐ; section mới "IV. ĐIỀU CHỈNH SAU BÀI DẠY"
  và "KÝ DUYỆT" (tổ trưởng/người soạn) theo cờ của mẫu.
- `src/lib/tvc/prompts.ts`: prompt DC-01 truyền tên các hoạt động của mẫu cho AI.
- `src/app/(app)/studio/mau-khbd/page.tsx` + `khbd-templates-manager.tsx`:
  trang quản lý - GV xem, tổ trưởng/BGH/admin CRUD; nav "Biểu mẫu kế hoạch bài dạy".
- `src/lib/tvc/actions.ts`: `saveKhbdTemplate`/`deleteKhbdTemplate` + audit.

## 3. Lỗi phát hiện khi QA

- `khbd_templates.created_by` FK → `tvc.profiles`: tổ trưởng SCN chưa có profile
  tvc → insert fail. Fix: gọi `ensureTvcProfile()` trong `saveKhbdTemplate`
  (giống các action tvc khác). Đã verify profile được provision.

## 4. Verify

- Unit check `fbLessonPlan` (tsc emit + node): mặc định 4 HĐ + ĐIỀU CHỈNH +
  KÝ DUYỆT; mẫu trường 2-3 HĐ tuỳ biến đúng tên/phút; tắt cờ ẩn phần tương ứng.
- Playwright (dev :3113): totruong tạo mẫu "KHBD 3 hoạt động - Trường Demo"
  (2 HĐ, đặt mặc định) → DB có row school_id=demo school, audit
  `khbd_template.create` ghi nhận; DC-01 select hiện cả mẫu trường lẫn hệ thống;
  gvcn mở trang chỉ xem, không thấy nút thêm.
- typecheck/lint/build + check-consistency xanh.

## 5. Giới hạn

- Sinh bằng AI theo mẫu phụ thuộc chất lượng LLM; fallback rule-based chỉ đổi
  tên/thời lượng hoạt động, nội dung bước vẫn generic (đã ghi trong CR-024
  backlog B2 - rà soát sư phạm).
- Chưa có import mẫu từ file Word của Sở/trường - nếu cần sẽ là CR riêng.
- DC-06 bài trình chiếu (P1 đề án) vẫn chưa làm.
