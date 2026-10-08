# CR-043 - Ngân hàng câu hỏi tiểu học 10.000 câu theo YCCĐ thật

## Phạm vi / lý do

Sau khi review 13 tool studio phát hiện ngân hàng câu hỏi cấp 1 gần như trống (lớp 2/3/5 = 0 câu) - DC-03 chỉ sinh được đề toàn placeholder `[THIẾU CÂU HỎI]`. User yêu cầu: ngân hàng 10.000 câu phủ khắp lớp 1-5, các môn, các YCCĐ thật, với nền là các dạng đề thực tế trước khi dùng AI mở rộng.

## Quyết định thiết kế

1. **Base bank = generator deterministic** (`scripts/gen-bank/`), không copy đề thi/SGK (bản quyền). Câu Toán có đáp án tính toán bằng số học - đúng tuyệt đối. Câu Tiếng Việt/Anh từ kho nội dung tự soạn theo chuẩn đề thi TH thực tế (odd one out, phân biệt ch/tr s/x l/n, từ loại, đọc hiểu Đ/S 4 ý, đề văn).
2. Mỗi câu map `standard_ids` -> UUID YCCĐ thật trong `tvc_curriculum_standards` (81 YCCĐ cấp 1: Toán 43, Tiếng Việt 23, Tiếng Anh 15).
3. `source=imported`, `review_state=approved` cho base (đáp án xác minh bằng cấu trúc). Câu AI gen sau này sẽ `source=generated`, `unreviewed`.
4. Dạng câu theo TT22 thực tế: MC 4 phương án, Đ/S 4 ý, TLN, tự luận; mức biet/hieu/van_dung/van_dung_cao khớp vocabulary `LEVEL_LABEL` của hệ thống.

## Kết quả triển khai (đợt 1 - base)

- 9.133 câu approved, phủ đủ 81/81 YCCĐ: Toán 5.305, Tiếng Việt 1.953, Tiếng Anh 1.875.
- qtype: MC 4.119, TLN 3.540, Đ/S 546, tự luận 928. level: biet 2.814 / hieu 3.912 / van_dung 2.183 / vdc 224.
- Đã sửa khi verify: đáp án âm trong biểu thức lớp 3/4 (guard `a > c*b`, `b < a`), lời giải rỗng cho MC, các bài toán chia có dư.
- **E2E DC-03**: ma trận Toán lớp 3 (TT22, 9 câu, 10đ) sinh đề thật qua API - 0 `[THIẾU]`, có đáp án + hướng dẫn chấm.

## Còn lại (đợt 2 - AI expansion)

- ~900 câu để đạt 10.000 + bù các YCCĐ nói/viết ít biến thể (TVIET5.2.1=26, TVIET5.3.1=32...).
- Sinh biến thể từ base qua provider chain hiện có (Gemini -> OpenRouter), `source=generated`, review bằng tay trước khi approve.
- Chạy `node scripts/gen-bank/run.mjs --insert` để re-seed (idempotent, dedupe theo stem).

## Verify

- `run.mjs --dry` báo coverage từng YCCĐ; insert batch 200.
- E2E đã test trên dev server (login anhptl@nd.scn -> POST /api/studio/tools/DC-03/generate -> đề 9 câu không thiếu).
