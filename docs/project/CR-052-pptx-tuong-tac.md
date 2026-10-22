# CR-052: PPT tương tác cho DC-06 - reveal đáp án + audio TTS

- **Status**: APPROVED (PO: "làm lần lượt theo SDLC")
- **Nguồn**: cross-learn #1-#3 từ slideforge (docs/project/CROSS-LEARN-slideforge.md) - deck hiện là văn bản tĩnh; chuẩn dạy học tích cực cần click để lật đáp án + audio mẫu đọc.

## Scope (bounded - không port nguyên pipeline slideforge)

1. **Reveal đáp án**: câu hỏi/bài tập trong slide có đáp án ẩn - shape đáp án gắn click-animation (entrance on click) trong `.pptx` thật qua pptxgenjs/patch XML như slideforge `build.mjs` (interactiveSeq).
2. **TTS audio**: đoạn văn/câu hỏi Tiếng Anh gắn narration `.mp3` (reuse `src/lib/tvc/tts.ts` - env-driven provider, expandKeys) + hyperlink `ppaction://hlinksldjump` hoặc media embed; opt-in qua field `audio` trong DC-06.
3. Giữ deck nhẹ: audio lưu Storage `tvc-media` + link, không nhúng base64 > deck cap.
4. **Opt-in**: field mới `interactive: yes|no` (default no = hành vi cũ), không phá doc cũ.

## Impact assessment

- **Code**: `src/lib/tvc/pptx.ts` (reveal + audio), DC-06 registry fields, generate route DC-06 (trả audio manifest), mới `src/lib/tvc/pptx-anim.ts` nếu cần patch XML.
- **DB**: audio file vào bucket tồn tại; không migration.
- **RBAC**: không đổi; TTS dùng quota `scn_ai_quota_take` như các AI call khác.
- **Rủi ro**: pptxgenjs không hỗ trợ trực tiếp click-animation -> phải patch slide XML sau khi build (slideforge đã chứng minh pattern này); TTS timeout -> budget 8s/segment + bỏ audio giữ text (pattern tts.ts).
- **Phụ thuộc**: edge-tts/OpenAI TTS key - khi không có key, render deck thường (fallback an toàn).

## Estimate

Dev ~4-6h (XML animation patch là phần lớn nhất) + test mở deck thật bằng PowerPoint/LibreOffice.

## AC

- AC-52.1: `interactive=yes` -> file .pptx mở được, slide có câu hỏi chứa đáp án ẩn xuất hiện khi click (verify bằng XML: `interactiveSeq` + trigger).
- AC-52.2: `audio=yes` (và có TTS key) -> slide có file audio liên kết chạy được; không có key -> deck vẫn sinh, không lỗi.
- AC-52.3: `interactive=no`/mặc định -> byte-identical pipeline cũ (regression).
- AC-52.4: deck <= 150MB cap; audio không vượt budget timeout route.
- AC-52.5: zip hợp lệ, không macro/OLE (giữ AC-16 slideforge-style safety).
