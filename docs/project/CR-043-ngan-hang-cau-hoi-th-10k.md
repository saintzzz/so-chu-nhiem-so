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

## Kết quả đợt 2 - AI expansion

- `expand-ai.mjs`: sinh biến thể từ câu base cùng YCCĐ qua provider chain (Gemini -> OpenRouter `google/gemini-2.5-flash` -> Anthropic `claude-haiku-5-5`), validate JSON + định dạng câu + dedupe stem, insert `source=generated`, `review_state=unreviewed` chờ GV duyệt.
- Kết quả: 360 câu gen qua 89 calls (2 lỗi); sau khi quét chất lượng xóa **65 câu Đ/S thiếu 4 mệnh đề a-d trong stem** -> còn **295 câu generated/unreviewed**.
- Fix validator: TF4 giờ bắt buộc đủ 4 mệnh đề a) b) c) d) trong stem (trước chỉ check đáp án).
- **Tổng bank cuối: 21.105 câu** (20.810 imported/approved + 295 generated/unreviewed), phủ đủ 81/81 YCCĐ.
- Generated quality sweep: 0 đáp số âm, 0 MC hỏng, 0 Đ/S thiếu ý, 0 đáp án trống, 0 thiếu lời giải; spot-check đáp án Toán đúng (150 phút, 24 km/h, 4800 m²...).

## Verify

- `run.mjs --dry` báo coverage từng YCCĐ; insert batch 200.
- E2E đã test trên dev server (login anhptl@nd.scn -> POST /api/studio/tools/DC-03/generate -> đề đủ câu không thiếu) + UI flow DC-02 -> DC-03 bằng Playwright.
- `npm run check` (lint+tsc+build) xanh, `check-consistency.mjs` all PASS.
- Retest các AI tool sau khi nâng provider (OpenRouter paid + Anthropic): DC-01, DC-05, DC-06, V-02, T-01, A-01, A-02, A-03 đều ra output đúng cấp lớp 1-5 (KHBD đúng khung CTGDPT 2018, phiếu học tập phân hóa, slide có ghi chú GV, bài đọc/hội thoại tiếng Anh đúng bậc A1).
