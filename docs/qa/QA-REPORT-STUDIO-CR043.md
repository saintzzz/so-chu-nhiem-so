# QA Evidence — Công cụ soạn học liệu (13 tool) + Ngân hàng câu hỏi CR-043

Ngày: 2026-10-08. Môi trường kiểm chứng: **local dev** `localhost:3000` + **production** `https://sochunhiem.vieschool.com` (deploy từ `master`, commit gần nhất `5a80068`, docs `d566541`).
Phương thức: Playwright MCP trong session login thật `anhptl@nd.scn` (gọi đúng route `/api/studio/tools/<code>/generate` mà UI dùng) + PostgREST trực tiếp cho DB assertions.

## 1. Coverage 13/13 tool — môn × lớp

| Tool | Local dev | Production | Ghi chú chất lượng |
|---|---|---|---|
| DC-01 KHBD | ✅ toan3, tieng_viet4, tieng_anh5 | ✅ toan3 (31.6s, 45 blocks) | Khung CTGDPT đủ: KT/NL/PC → thiết bị → tiến trình HĐ → điều chỉnh → ký duyệt |
| DC-02 Ma trận | ✅ toan4, tieng_viet2, tieng_anh5 | ✅ tieng_viet2 (1.5s) | TT22 đủ 4 mức; cell VDLH → TLN 1đ; spec có requirement+năng lực |
| DC-03 Sinh đề | ✅ 4 ma trận + approved_only/shuffle/progressive | ✅ tieng_viet3 0 THIẾU | Đáp án kiểm tay 12/12 đúng (xem §3) |
| DC-04 Ngân hàng | ✅ 5 filter, phân trang | ✅ 200 | 21.105 rows |
| DC-05 Phiếu HT | ✅ toan2, tieng_viet3 | ✅ tieng_viet3 (16.9s) | Bố cục in: khởi động/khám phá/vận dụng + phân hóa HS giỏi |
| DC-06 Slides | ✅ toan4 (8 slide) | ✅ toan4 (13.5s, 30 blocks) | Ghi chú GV + gợi ý hình từng slide |
| T-01 Biến thể | ✅ toan5, toan2 | ✅ toan5 (9.5s) | 10 biến thể đúng cấu trúc tỉ số % |
| T-02 Công thức | ✅ 42 phím/5 nhóm, insert@cursor, KaTeX, copy | ✅ keyboard live | screenshot: `screenshots-studio/t02-formula-keyboard.png` |
| V-01 Ngữ liệu | ✅ 28 văn bản, link→V-02 | ✅ 200 | — |
| V-02 Đọc hiểu | ✅ tieng_viet4 | ✅ tieng_viet4 (12.2s) | 3 mức × 4 dạng TT22 |
| A-01 Bài đọc | ✅ anh3 A1 | ✅ anh4 A1 "My School Day" | Đoạn đọc English + vocab + câu hỏi |
| A-02 Từ vựng | ✅ anh4 | ✅ anh4 (10s) | 6 dạng bài: fill/match/choose/sentence/crossword/flashcard |
| A-03 Hội thoại | ✅ anh5 A1 | ✅ anh5 A1 "At the Market" | Dialogue EN sạch + transcript + 4 dạng bài nghe |

Mọi AI call trả `provider:"openai"` (OpenRouter `google/gemini-2.5-flash`, env đã set đủ Production/Preview/Development) — Gemini local hết quota nhưng chain fallback hoạt động đúng.

## 2. Ngân hàng câu hỏi — DB assertions (PostgREST count=exact)

| Metric | Giá trị | Cách đo |
|---|---|---|
| Tổng câu grade≤5 | **21.105** | `content-range: */21105` |
| `source=generated` | 295 | `review_state` phân bố: `{unreviewed: 295}` |
| `source=imported` (base) | 20.810 | = total − generated |
| Coverage YCCĐ | 81/81 | dry-run `run.mjs` per-standard counts |
| MC hỏng / ĐS thiếu ý / đáp số âm / đáp án trống | **0** | sweep toàn bank |
| Số thập phân dấu chấm | **0** (đã patch 156) | regex `\d+\.\d{1,2}` trên answer+solution |

## 3. Verify đề sinh ra (sample thật)

Ma trận Toán 5 `ca2f597a-…` — PHẦN I 10 câu TN (so sánh số TP, diện tích tam giác/tròn), PHẦN II 2 câu TL (tổng-hiệu). Đáp án appendix kiểm tay: `42,6>4,3` ✓ · `65,8<80,1` ✓ · S=20×20÷2=200cm² ✓ · S=7×7×3,14=153,86cm² ✓ · tổng 32 hiệu 10 → 21,11 ✓ …

Ma trận TV lớp 3 `63640928-…` — TN câu chính tả nhúng nội dung ("con sáo/con xáo"), TL đề văn "Kể lại một buổi học đáng nhớ" — đúng format đề TV thật.

## 4. Export + cross-link + negative tests

- `GET /api/studio/materials/<id>/export?fmt=docx` → 200, MIME docx đúng, 10.615 bytes
- `?fmt=pptx` (material slides) → 200, MIME pptx, 122.781 bytes
- "Xuất PDF" → trang in `/studio-print/<id>` (200, 37KB HTML) — in→PDF bằng trình duyệt, by design
- `fmt=pdf` trực tiếp → 400 (không hỗ trợ); id giả → 404 — đúng
- DC-02 lưu → link "Sinh đề từ ma trận này" → `/studio/DC-03?matrix=<id>` preselect → sinh đề: ✅ (Playwright click-through)
- V-01 detail → "Sinh câu hỏi" → `/studio/V-02?lit=<id>` prefill: ✅
- DC-06 `?from=<lesson_plan_id>` banner "Sinh slide từ giáo án đã soạn": ✅

## 5. Console/errors

Console sạch — 2 error duy nhất ghi nhận là negative test cố ý (`fmt=pdf` 400, id giả 404). Không hydration error, không failed request ngoài dự kiến.

## 6. Bug đã fix trong phiên test

| Bug | Fix | Commit |
|---|---|---|
| A-03 sinh hội thoại tiếng Việt | `sectionsLookEnglish` guard + prompt hardening | `ab6cbab` |
| Ma trận TH thiếu mức VDLH khi ít YCCĐ | level cycle offset `(si+ti)` + VDLH → TLN | `c0d5fdb` |
| Link DC-02→DC-03, V-01→V-02 thiếu | nút + `?matrix=`/`?lit=` prefill | `c0d5fdb` |
| Block rỗng trong doc | `cleanDoc` lọc para/list rỗng | `c0d5fdb` |
| Đáp án dấu chấm thập phân | `dec()` trong toan.mjs + PATCH 156 rows | `5a80068` |
| T-02 chỉ có textarea | `FormulaInput` 42 phím + KaTeX + copy | `64790cc` |

## 7. Còn lại (backlog, không chặn)

- A-03 chưa có audio TTS thật (transcript có, nút Nghe chưa nối)
- 55 duplicate stems (~0,3%) odd-one-out trùng tổ hợp
- `ngu_van` grade range 1-12 chưa tách cấp
