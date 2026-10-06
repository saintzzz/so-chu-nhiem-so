# CR-023: Tích hợp TVC360 thành module "Công cụ số giáo viên" trong Sổ Chủ Nhiệm Số

Ngày: 2026-10-06 | Loại: CR - feature lớn | Nguồn: yêu cầu PO + Đề án TVC360 19/08/2026

## 1. Thay đổi yêu cầu

Tích hợp bộ công cụ soạn học liệu của TVC360 (`tvc360-congcuso`) thành một
module bên trong Sổ Chủ Nhiệm Số, phục vụ giáo viên (gvcn, gvbm) ngay trong
nền tảng trường học. Phạm vi theo chỉ đạo PO:

- Áp dụng cấp tiểu học trước; các cấp khác nếu nhanh.
- Môn: Toán, Tiếng Việt, Tiếng Anh (TH bắt đầu Anh từ lớp 3).
- YCCĐ thêm/sửa/xoá được theo từng trường.
- Bám Đề án TVC360 + quy định/pháp luật VN (TT 32/2018 + sửa đổi, CV 7991,
  TT 22/2021 tiểu học, Luật 91/2025 BV DLCN).
- Tạm bỏ qua tích hợp EA.

## 2. Impact assessment

### Kiến trúc

- Cùng project Supabase `cxjpgfhqchjoernfmcra` và cùng pool `auth.users` →
  SCN user dùng trực tiếp các bảng `tvc.*` qua alias `tvc_*` (RLS đều
  `owner_id = auth.uid()` hoặc "authed read", không phụ thuộc `tvc.profiles`).
- Không merge repo, không deploy lại TVC360 - app độc lập vẫn giữ nguyên
  cho thị trường GV cá nhân (đúng Đề án G1). Module SCN tái dùng schema
  + thư viện lõi.
- Port code TVC sang `src/lib/tvc/` + `src/components/tvc/` trong SCN,
  gọi AI qua `src/lib/ai.ts` hiện có (tương thích `generateTextDetailed`).

### Dữ liệu

- `tvc.curriculum_standards`: thêm `school_id` (NULL = hệ thống, dùng chung;
  có giá trị = YCCĐ riêng của trường) + RLS cho staff trường quản lý.
- `tvc.subjects`: thêm `tieng_viet`; mở rộng `grade` 1-5.
- Seed YCCĐ TH: Toán lớp 1-5, Tiếng Việt lớp 1-5, Tiếng Anh lớp 3-5
  (bộ khung sưu tầm từ TT 32/2018 - trường chỉnh sửa tiếp).
- `tvc_questions.owner_id` = `auth.users.id` của GV SCN - không cần map.

### RBAC / phạm vi

- Truy cập module: `gvcn`, `gvbm` (chính); `to_truong`, `bgh` xem + quản lý
  YCCĐ trường. Roles khác default-deny.
- Ngân hàng câu hỏi per-owner (GV tự quản kho của mình) - khớp Đề án G1.

### Điểm chạm SCN hiện hữu

- `lesson_plans` (KHBĐ) và `academics/exams` đã có - sản phẩm sinh từ công
  cụ có thể lưu liên kết sau; v1 module đứng độc lập dưới `/studio`.
- Nav: thêm section "Công cụ soạn học liệu" cho gvcn/gvbm (+to_truong/bgh
  phần YCCĐ).

### Bổ sung kèm theo từ review Đề án (CR gộp)

- Exam-pack: đề chính thức + đề dự phòng + HDC + MTDT + biên bản phản biện.
- Chấm Đ/S cấu hình tuyến tính (định kỳ, mẫu FPT) / lũy tiến (QĐ 764).
- `van_dung_cao` chỉ là tuỳ chọn, không tự chèn vào ma trận 3 mức CV 7991.
- Đặc tả DC-02 xuất cột năng lực (TD/GQ/MH...).

### Ngoài phạm vi v1

- Marketplace/kiểm duyệt 4 lớp/chỉ số tác giả (Đề án P1+).
- Thi trên máy trong SCN (SCN đã có module thi riêng; cân nhắc sau).
- PPTX/QTI/LTI; cấp THCS/THPT seed (có sẵn 102 YCCĐ cũ vẫn dùng được).

## 3. Ước lượng

- Migration + seed YCCĐ: 0.5 ngày.
- Port libs (~1.8k dòng) + deps docx/xlsx: 1 ngày.
- UI: tool gallery + runner, question bank, YCCĐ manager, exam-pack: 2-3 ngày.
- QA + deploy: 0.5 ngày.

## 4. Rủi ro

- Seed YCCĐ TH do AI biên soạn cần trường rà soát - UI quản lý YCCĐ cho
  phép sửa tại chỗ, gắn nhãn "bộ khung tham khảo" khi hiển thị.
- RLS `tvc_*` phải mở ghi cho `school_id` scope của standards mà không phá
  policy chủ sở hữu hiện tại.

## 5. Kết quả triển khai + QA (2026-10-06)

### Đã làm
- Routes: `/studio`, `/studio/[code]`, `/studio/questions`, `/studio/library`,
  `/studio/library/[id]`, `/studio/literature(+[id])`, `/studio/yccd`,
  `/studio-print/[id]`; APIs: `context`, `tools/[code]/generate`,
  `questions/extract`, `materials/[id]/export`.
- Libs port vào `src/lib/tvc/`; components `src/components/tvc/`;
  `use-tvc-ai-job` adapter lên `ai_jobs` sẵn có.
- DB: `tvc.curriculum_standards.school_id`; môn `tieng_viet` (lớp 1-5),
  `tieng_anh` mở lớp 3; seed 64 YCCĐ TH (Toán/TV 1-5, Anh 3-5).
- Nav "Công cụ soạn học liệu" cho gvcn/gvbm/to_truong/bgh/pht.

### Bug thật bắt được trong QA
- **FK tvc.* -> tvc.profiles**: user SCN không có row -> mọi insert
  (materials/matrices/questions/generations) lỗi 23503. Fix:
  `ensureTvcProfile()` lazy-upsert (`src/lib/tvc/profile.ts`), RLS self-check
  `role='giao_vien'` sẵn phù hợp.
- **`security_invoker` mất trên view**: recreate view
  `tvc_curriculum_standards` bỏ quên option -> RLS bypass (test cho thấy
  gvcn insert được + update được YCCĐ hệ thống). Fix migration
  `tvc_views_security_invoker`: bật lại cho view đó + `tvc_questions`,
  `tvc_ai_jobs`, `tvc_exam_sessions`, `tvc_exam_submissions` (4 view khác
  cũng thiếu -> lỗ bảo mật đọc/ghi chéo tồn tại sẵn).
- **RLS quá rộng**: policy cũ dùng `is_school_staff()` (gồm gvcn/gvbm) ->
  siết về `to_truong/bgh/admin` khớp STD_ADMIN_ROLES.
- **`lesson_ref` NOT NULL**: saveStandard truyền null -> lỗi 23502. Fix `""`.
- **`form.answer` không bind UI** (bug gốc TVC360, luồng tạo câu tay không
  lưu được do validate bắt đáp án A-D): thêm input Đáp án per-qtype.
- Dev-origin: `allowedDevOrigins: ["127.0.0.1"]` cho Playwright.

### Verify
- typecheck/lint(0 err)/build/check-consistency: xanh.
- Playwright gvcn: DC-02 sinh ma trận 3 mức + đặc tả cột Năng lực -> lưu
  (tvc.matrices+materials row xác nhận); Xuất Word = DOCX zip 9KB hợp lệ;
  trang in A4; DC-03 pack=full -> 3 tab (đề CT / đề DB / BBPB) + đáp án +
  báo thiếu câu thật; câu hỏi mới `TOAN3.1.3-D01` gắn YCCĐ, KaTeX render,
  review_state=unreviewed.
- totruong: thêm/sửa/xoá YCCĐ trường `TOAN3.TC.9` -> xác nhận DB + audit log;
  YCCĐ trường hiện lại trong scope chọn của gvcn (cross-user school scoping).
- Denial: `phuhuynh@demo.scn` vào `/studio` -> redirect `/portal/parent`;
  gvcn insert YCCĐ trường bị RLS chặn; totruong không sửa được YCCĐ hệ thống.

### Còn nợ (follow-up CR)
- Seed YCCĐ TH do AI biên soạn - cần chuyên gia rà soát nội dung.
- Ngân hàng câu hỏi trường demo mới 1 câu - cần đợt nhập liệu/seed.
- Extract endpoint (docx/pdf/ảnh) chưa test file thật.
- QTI/LTI, chế độ Cùng soạn wizard, kiểm duyệt 4 lớp, DPIA (Luật 91/2025).
