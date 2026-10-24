# CR-018: Studio - nhúng audio vào PPTX, mở rộng TTS (Anh + Việt), slide themes

## Nguồn yêu cầu

Người dùng: "công cụ soạn học liệu đã hỗ trợ đến mức nào rồi? xuất pptx đẹp chưa?
môn tiếng anh tiếng việt có hỗ trợ xuất bài giảng có phát âm âm thanh như dự án
slideforge chưa?" -> xác nhận "có làm" cho nâng cấp theo kịch bản slideforge.

## Hiện trạng (đã audit)

- TTS chỉ có ở **A-03** (hội thoại nghe): `src/lib/tvc/tts.ts` - OpenAI
  `gpt-4o-mini-tts`, 2 giọng, mp3 upload bucket `tvc-media`, block `audio`
  render `<audio controls>` trong web preview.
- `docToPptx` (`src/lib/tvc/pptx.ts`): audio block chỉ in caption `[Audio] ...` -
  **không nhúng audio** vào slide. Layout duy nhất: bìa navy + title + bullets.
- A-01 (bài đọc), A-02 (từ vựng), V-02 (văn bản đọc hiểu) không có audio.

## Phạm vi

### P1 - Audio embed vào PPTX + audio cho A-01/A-02
- `pptx.ts`: audio block -> fetch mp3 từ `tvc-media`, nhúng `addMedia`
  (type audio, base64) vào đúng slide chứa block. Giữ caption dưới icon.
- `tts.ts`: thêm `synthesizeSpeech(text, voice)` - narration 1 giọng
  (dùng chung cho A-01/A-02/V-02), vẫn tôn trọng provider/endpoint allowlist
  + route budget.
- generate route: mở rộng TTS cho:
  - **A-01**: narrate section bài đọc chính (<= 3500 ký tự).
  - **A-02**: narrate danh sách từ (`input.words`, mỗi từ đọc 1 lần, có khoảng
    lặng) - track "Nghe và lặp lại".
- Audio fail / thiếu key -> giữ nguyên doc, không chặn generate (giữ chính sách
  hiện tại).

### P2 - Tiếng Việt TTS
- **V-02**: narrate văn bản đầu vào (`input.text`) - audio "Bài đọc nghe" cho
  HS tiểu học/luyện nghe-đọc. Voice tiếng Việt qua `TTS_VOICE_VI` (default
  `nova` - gpt-4o-mini-tts đọc tiếng Việt ổn).

### P3 - Slide themes
- DC-06 thêm field `theme` (4 theme: `navy` mặc định, `emerald`, `plum`,
  `light`). Lưu vào `DocContent.theme` lúc generate.
- `docToPptx(doc, author)`: đọc `doc.theme` -> bảng màu (bìa, title, accent
  bar dưới title, footer số slide). Không đổi DOCX.

## Mo rong trong luc implement

`OPENAI_API_KEY` local la key OpenRouter -> `api.openai.com/audio/speech` 401
-> TTS khong bao gio chay duoc o moi truong nay. Can provider mien phi
khong key de: (a) verify e2e duoc, (b) giam chi phi production. Da them
**edge-tts** (`@andresaya/edge-tts@1.9.1`) lam provider fallback:

- `TTS_PROVIDER`: `auto` (default = openai -> edge) | `openai` | `edge`.
- Giong edge: `TTS_EDGE_VOICE_A` (en-US-AndrewNeural),
  `TTS_EDGE_VOICE_B` (en-US-AvaNeural), `TTS_EDGE_VOICE_VI`
  (vi-VN-HoaiMyNeural) - tieng Viet that su, khong chi co OpenAI.
- `synthesizeDialogue` (A-03) va `synthesizeSpeech` (A-01/A-02/V-02/DC-06)
  cung qua `ttsSegment` -> het key OpenAI thi roi xuong edge tu dong.
- edge di qua `aiProviderAllowed("edge")` +
  `aiEndpointAllowed(api.msedgeservices.com)` - ton trong allowlist.
- 10/2026 MS chi chap nhan Sec-MS-GEC v2 -> `msedge-tts@2.1.0` chet
  (WS handshake 200 thay 101); doi sang fork da port thuat toan v2
  (xem rany2/edge-tts#490, #492).

## Ngoài phạm vi

- TTS hash-cache toan cuc kieu slideforge (`sf.tts_cache`) - giai doan sau.
- Voice picker chi tiet tung nhan vat trong UI - giu env voice.
- Gemini TTS provider (can billing tach, tam chi co openai + edge).

## Verify

- Generate A-01/A-02/V-02 -> doc có block audio, web preview phát được.
- Export A-03/V-02 .pptx -> mở PowerPoint thấy icon audio, click phát được.
- DC-06 chọn từng theme -> pptx đúng màu.
- Không có TTS key -> mọi tool vẫn generate bình thường (không audio).
