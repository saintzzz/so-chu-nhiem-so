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

## Kết quả triển khai (đợt 1b - mở rộng base)

- Tổng bank: **20.810 câu** (base deterministic), phủ đủ 81/81 YCCĐ, top-up mỗi YCCĐ tới ~125 câu.
- Bổ sung qtype coverage cho các YCCĐ thiếu dạng: đọc hiểu TV có thêm MC + TLN (mỗi mẫu đoạn văn sinh câu hỏi theo slot), từ vựng TV/TA có thêm TLN (đồng/trái nghĩa, dịch từ, từ loại), ANH x.3.1/x.4.1/x.5.1 có TLN.
- qtype: TLN 10.117, MC 7.860, tự luận 2.057, Đ/S 776. level: hieu 9.064 / van_dung 5.477 / biet 5.595 / vdc 674.
- Data quality: 0 MC hỏng (đủ 4 phương án + đáp án A-D), 0 đáp số âm, 0 đáp án trống, 55 dup stems (~0,3%, odd-one-out trùng tổ hợp từ).

## Bug phát hiện qua E2E + fix

1. **`stemKey` dedupe collapse**: DC-03 gọi `stemKey(stem)` = phần trước "A." đầu tiên - các câu MC stem cố định ("Từ nào viết đúng chính tả?", "Khoanh tròn từ khác loại") chỉ khác nhau ở phương án -> collapse thành 1 câu dùng được -> `[THIẾU]` dù bank có hàng trăm câu. Fix: nhúng nội dung phân biệt vào stem trước options (chính tả nhúng cặp từ, odd-one-out nhúng nhóm từ, từ loại nhúng nhóm từ); xóa 1.548 câu mẫu cũ.
2. **`run.mjs` dedupe vs DB chỉ đọc 1.000 stem đầu** (PostgREST limit mặc định) -> re-run sẽ tạo trùng. Fix: paginate offset/limit.
3. **Combo qtype/level thiếu** -> ma trận đòi TLN vận dụng / Đ-S hiểu không có -> `[THIẾU]`. Fix bằng bổ sung dạng câu như trên.

## E2E DC-03 sau fix (4 ma trận thật qua UI flow)

| Ma trận | Kết quả |
|---|---|
| Toán L1 (48 câu) | 0 `[THIẾU]` |
| Toán L5 (48 câu) | 0 `[THIẾU]` |
| Tiếng Việt L3 (38 câu) | 0 `[THIẾU]` |
| Tiếng Anh L4 (46 câu) | 0 `[THIẾU]` |

UI flow verify: DC-02 sinh ma trận -> Lưu học liệu -> "Sinh đề từ ma trận này" -> DC-03 `?matrix=<id>` preselect -> "Rút câu hỏi & sinh đề" -> đề đầy đủ (đề CT + dự phòng + đáp án + biên bản phản biện), 0 `[THIẾU]`.

## Còn lại (đợt 2 - AI expansion)

- `expand-ai.mjs` đang chạy: sinh biến thể từ base qua provider chain (Gemini -> OpenRouter), `source=generated`, `unreviewed` chờ GV duyệt. ~1.400 câu dự kiến (81 YCCĐ x ~18).
- Chạy `node scripts/gen-bank/run.mjs --insert` để re-seed base (idempotent, dedupe theo stem, đã paginate).

## Verify

- `run.mjs --dry` báo coverage từng YCCĐ; insert batch 200.
- E2E đã test trên dev server (login anhptl@nd.scn -> POST /api/studio/tools/DC-03/generate -> đề đủ câu không thiếu) + UI flow DC-02 -> DC-03 bằng Playwright.
- `npm run check` (lint+tsc+build) xanh, `check-consistency.mjs` all PASS.
