# CR-025 - LLM content harness tích hợp SDLC: mở rộng YCCĐ + ngân hàng câu hỏi

## 1. Bối cảnh

Sau CR-024, nội dung tiểu học đã bám văn bản chương trình nhưng coverage còn mỏng
(90 câu soạn tay cho 80 YCCĐ - trung bình ~1.1 câu/mã trong khi một đề TH cần ~5
câu/mã/mức). Việc nhân rộng thủ công không khả thi. User đề xuất dùng flow LLM
("flow với ChatGPT") để sinh nội dung và tích hợp vào SDLC.

Phân loại: **CR** - thêm pipeline sinh dữ liệu tự động có kiểm soát.

## 2. Thiết kế: content harness như một stage trong SDLC

```
[BA/Content spec]          [Developer: harness]         [Tester: auto QA gate]         [Review gate: con người]
YCCĐ từ CT + đề án    ->   gen-tvc-content.mjs      ->   validate + dedupe + DB       ->   chuyên gia (backlog
(prompts khóa format,       LLM provider env-based         write với nhãn rõ nguồn          CR-024 B1/B2) duyệt
 schema, ngữ quy tắc)       (Gemini>OpenAI>Claude)         generated/unreviewed              trước khi dùng thi thật
```

Nguyên tắc:
- **LLM chỉ đề xuất, không quyết định.** Mọi output qua `validate()` mirror của
  `src/lib/tvc/question-validate.ts` (format MC A-D trên dòng riêng, Đ/S 4 ý a-d +
  answer pattern, SA có đáp án, essay có lời giải >= 20 ký tự, level/qtype hợp lệ,
  tham chiếu ngữ cảnh phải có `context`).
- **Nhãn trung thực**: câu AI sinh `source=generated` + `review_state=unreviewed`
  - không giả dạng đã duyệt; gate `usable()` ở DC-03 vẫn cảnh báo trong đề.
- **Dedupe**: so stem normalized với toàn bộ bank trước khi insert.
- **Bản quyền**: system prompt ép "ngữ liệu tự viết, không sao chép SGK".
- **Provider linh hoạt** đúng convention repo: env `GEMINI_API_KEY`/`OPENAI_API_KEY`/
  `ANTHROPIC_API_KEY`, `AI_PROVIDER`/`AI_MODEL` override; retry + throttle 1.5s/call.

## 3. Implement

`scripts/gen-tvc-content.mjs` - 3 kênh sinh:

- `--mode=questions --subject=.. --grade=.. --per-std=N`: gọi API trực tiếp
  (Gemini > OpenAI > Anthropic theo env). Dùng khi có key và chưa hết quota.
- **`--mode=questions --from-file=...json`**: kênh "LLM web" - prompt đưa lên
  ChatGPT web (tài khoản Plus, qua Playwright), copy JSON trả về -> script
  validate + dedupe + insert y như kênh API. Đây là fallback khi API rate-limit
  (Gemini free-tier ~20 req/session) và cho phép tận dụng model mạnh hơn qua UI.
  Format file: array `{std_code, qtype, level, points, stem, context, correct,
  solution}`.
- `--mode=yccd --subject=.. --grade=.. --count=N`: sinh YCCĐ còn thiếu qua API.

- `--mode=questions --subject=toan --grade=4 --per-std=2 [--dry] [--owner=...]`:
  duyệt từng YCCĐ, prompt sinh N câu đa dạng qtype/mức, validate từng câu, dedupe,
  insert `tvc.questions` với mã `<YCCĐ>-<D|F|S|E>AI<nn>` để phân biệt câu tay.
- `--mode=yccd --subject=... --grade=... --count=N [--dry]`: sinh YCCĐ còn thiếu
  theo tiền tố mã (`TOAN/TVIET/ANH<lớp>.<mạch>.<stt>`), prompt nạp danh sách mã hiện
  có để tránh trùng, validate regex mã + không trùng.

## 4. QA gate trong harness (bắt được khi chạy thật)

| Lỗi LLM | Xử lý |
|---|---|
| MC không xuống dòng A-D | reject; prompt siết "mỗi lựa chọn một dòng" + regex chấp nhận `(?:^|\n| )A.` |
| Trả HTML/non-JSON (rate-limit, quota) | retry x2 + chuyển provider kế; ghi log |
| Câu tham chiếu đoạn đọc thiếu `context` | reject (không vào bank) |
| Stem trùng câu sẵn có | skip, đếm `dup` |

## 5. Kết quả chạy thực tế (6/10/2026)

| Kênh | Batch | Kết quả |
|---|---|---|
| API Gemini | TOAN4 + TOAN5 (per-std=2) | 15 câu ghi; gate reject ~23 câu sai format |
| ChatGPT web (Plus, qua Playwright) | ANH5 15 + TOAN4 20 + TVIET4 14 + ANH3-4 20 + TVIET1-3/TOAN1-2 20 | **89 câu ghi**, 0 lỗi sau khi chuẩn hoá prompt |

Tổng bank sau CR: **211 câu** (90 tay approved + 121 AI unreviewed), phủ tất cả
80 YCCĐ TH. Gate bắt được các lỗi thật: MC options inline cùng dòng (auto-fix
split), `level` tiếng Việt (map về mã), options tách object `{"A":...}` (nhúng lại
stem), JSON hỏng do nháy kép không escape (yêu cầu LLM xuất lại với nháy đơn),
`std_code` không tồn tại (reject), stem trùng (dedupe).

**Nhận xét kênh**: ChatGPT Plus web cho chất lượng JSON tuân thủ cao hơn Gemini
flash free-tier (context transcript/đoạn đọc tự viết đầy đủ, rubric essay có HDC)
và không bị rate-limit RPM - khuyến nghị dùng kênh web cho batch lớn, API cho
vòng lặp nhỏ.

## 6. Giới hạn và điều kiện dùng

- LLM sinh đúng văn phong nhưng **không chứng minh độ đúng sư phạm** - mọi câu
  `unreviewed` phải qua backlog B2 (chuyên gia/tổ bộ môn) trước khi đánh `approved`.
- Quota Gemini free-tier giới hạn RPM - chạy theo lô nhỏ (--grade, --per-std thấp).
- Chỉ chạy trên môi trường có key trong `.env.local`; không commit key.

## 7. Follow-up (không làm trong CR này)

- Cron/job định kỳ sinh-dedupe câu cho các YCCĐ mỏng.
- Đưa harness thành công cụ `/studio` có UI (GV chọn YCCĐ -> preview -> duyệt).
- Ghi `tvc.generations` cho mỗi batch sinh để audit nguồn AI.
