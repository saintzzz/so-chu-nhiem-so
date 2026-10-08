# CR-037: Nâng chất lượng KHBD sinh từ Studio DC-01

Ngày: 2026-10 | Loại: CR - chất lượng nội dung | Nguồn: phản hồi PO (ảnh chụp
`/studio/DC-01`): "Nội dung Kế hoạch bài dạy tệ về bố cục".

## 1. Vấn đề

Tool DC-01 (`Biên soạn kế hoạch bài dạy`) sinh DocContent qua prompt generic
(`src/lib/tvc/prompts.ts`). Lỗi quan sát trên prod:

- **Bố cục phẳng**: toàn bullet list - không theo cấu trúc CV 5512 (mỗi hoạt
  động phải có a) Mục tiêu, b) Nội dung, c) Hoạt động GV-HS, d) Sản phẩm,
  đ) Đánh giá).
- **AI bịa phụ lục**: sinh "ĐÁP ÁN / Phiếu bài tập số 1, số 2" không được yêu
  cầu nhét vào giáo án - prompt chỉ xin bảng dự kiến sản phẩm + đánh giá +
  ĐIỀU CHỈNH + KÝ DUYỆT. Không có validation lọc section lạc đề.
- **Fallback `fbLessonPlan`** cũng chỉ bullet mỏng, không theo khung 5 mục.

## 2. Phạm vi (đã duyệt: full fix)

- Prompt DC-01: ép cấu trúc CV 5512 (I. Mục tiêu / II. Thiết bị / III. Tiến
  trình - mỗi HĐ đủ a,b,c,d,đ / IV. Điều chỉnh sau bài dạy / Ký duyệt);
  cấm sinh phiếu bài tập, đáp án, nội dung ngoài giáo án.
- Post-validation `sanitizeKhbdDoc` (`src/lib/tvc/khbd-doc.ts`): bỏ section/
  appendix không thuộc khung biểu mẫu (ĐÁP ÁN, PHIẾU BÀI TẬP...); doc thiếu
  section bắt buộc -> dùng fallback. Áp cho cả nhánh AI lẫn async fallback.
- `fbLessonPlan`: nâng lên cùng khung 5 mục/hoạt động + bảng tổ chức.
- Render: mỗi hoạt động thể hiện bảng (Bước | Hoạt động GV - HS | Nội dung)
  qua block `table` có sẵn - không cần component mới.

## 3. Impact assessment

- File sửa: `src/lib/tvc/prompts.ts`, `src/lib/tvc/fallbacks.ts`,
  `src/app/api/studio/tools/[code]/generate/route.ts`,
  `src/components/tvc/tool-runner.tsx` (validate kết quả async job).
- File mới: `src/lib/tvc/khbd-doc.ts`, `docs/project/CR-037-*.md`.
- Không đụng schema, RLS, tvc360 repo (prompt riêng của app này).
- Rủi ro: prompt chặt hơn -> AI ít sáng tạo hơn; chấp nhận vì ưu tiên đúng
  biểu mẫu.

## 4. Acceptance criteria

- AC-1: Doc DC-01 từ AI có đủ section I-IV + hoạt động theo biểu mẫu, mỗi
  hoạt động có nhãn a)-đ) hoặc bảng tổ chức; không có appendix ĐÁP ÁN/PHIẾU.
- AC-2: sanitize loại bỏ section ngoài khung cả khi AI cố chèn; doc thiếu
  MỤC TIÊU/TIẾN TRÌNH bị loại -> fallback.
- AC-3: Async fallback path (tvc_ai_jobs) cũng qua sanitize.
- AC-4: Fallback `fbLessonPlan` render đủ 5 mục/hoạt động + bảng + ký duyệt.
- AC-5: Tests bắt được regression (prompt guard + sanitize behavior);
  typecheck/lint/check-consistency xanh; verify trên prod bằng Playwright.

## 5. Kết quả thực hiện (2026-10-08)

### Code đã làm

- `src/lib/tvc/khbd-doc.ts` (mới): `sanitizeKhbdDoc` + `khbdHasCoreStructure`.
  Normalize strip-diacritics nên match được cả tiêu đề không dấu; allowlist
  section theo khung CV 5512; blocklist tuyệt đối ĐÁP ÁN / HƯỚNG DẪN CHẤM /
  PHIẾU BÀI TẬP / PHIẾU HỌC TẬP / BÀI TẬP VỀ NHÀ / ĐỀ KIỂM TRA / LỜI GIẢI /
  MA TRẬN; doc thiếu Mục tiêu hoặc Tiến trình hoặc <6 blocks -> null.
- Route `generate`: DC-01 -> `sanitizeKhbdDoc(ai.doc)`, null -> fallback;
  provider chỉ gán AI khi doc đã qua sanitize.
- `tool-runner.tsx`: nhánh async (tvc_ai_jobs onDone) cũng sanitize DC-01
  trước khi setDoc - không còn đường lách sanitize.
- `prompts.ts` DC-01: ép cấu trúc I-IV + mỗi HĐ đủ a,b,c,d,đ với c) bắt buộc
  table 2 cột [Hoạt động GV-HS | Nội dung]; appendix chỉ 1 section
  "PHỤ LỤC: DỰ KIẾN SẢN PHẨM VÀ ĐÁNH GIÁ"; "TUYỆT ĐỐI KHÔNG sinh" phiếu
  bài tập/đáp án/hướng dẫn chấm/bài tập về nhà/đề kiểm tra.
- `fallbacks.ts` `fbLessonPlan`: mỗi hoạt động đủ 5 nhãn a)-đ), c) dạng
  table [Hoạt động của giáo viên và học sinh | Nội dung], appendix phụ lục
  đánh giá theo hoạt động, KÝ DUYỆT table 2 cột.

### Verify

- `node --test tests/r2-regression.test.mjs`: 118/118 PASS (4 test CR-037
  mới: giữ doc hợp lệ + lọc lạc đề, loại doc rỗng/thiếu khung, lọc
  appendix, guard prompt+route+fallback).
- tsc noEmit: 0 errors. eslint: 0 errors. next build: 125 routes OK.
  check-consistency: all PASS.
- E2E Playwright local (login gvcn@demo.scn -> /studio/DC-01 -> Toán lớp 8,
  YCCĐ TOAN8.1.1, biểu mẫu CV 5512 -> "Sinh học liệu"):
  - Render đúng: I. MỤC TIÊU / II. THIẾT BỊ / III. TIẾN TRÌNH với 4 hoạt
    động (mỗi HĐ đủ a) Mục tiêu b) Nội dung c) Tổ chức bảng 2 cột
    d) Sản phẩm đ) Đánh giá) / IV. ĐIỀU CHỈNH / KÝ DUYỆT bảng 2 cột /
    PHỤ LỤC đánh giá theo hoạt động.
  - Không còn section/heading "ĐÁP ÁN" hay "PHIẾU BÀI TẬP" rời rạc.
  - "Lưu học liệu" -> Đã lưu -> xuất hiện trong /studio/library.
  - Console: 0 errors.

### Trạng thái acceptance criteria

- AC-1..AC-5: đạt (E2E trên chạy nhánh rule-based vì local không có AI key;
  nhánh AI được bảo vệ bởi sanitize + test behavior).
- Prod verify (commit 78b914b, deploy READY): login -> /studio/DC-01 ->
  Ngữ văn lớp 6 + biểu mẫu CV 5512 -> render đúng I-IV + 4 HĐ đủ a,b,c,d,đ
  + KÝ DUYỆT + PHỤ LỤC đánh giá; không section lạc đề; 0 console errors.
