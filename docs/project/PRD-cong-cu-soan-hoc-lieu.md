# PRD — Công cụ soạn học liệu (TVC360 Studio)

**Phase 2 output — BA** | Date: 2026-10-09 | Status: Đã triển khai (as-built PRD)
**Liên quan:** CR-023 (module tool), CR-041 (AI gen câu hỏi), CR-043 (ngân hàng 10k), CR-031 (media), CR-026 (biểu mẫu KHBD)

## 1. Problem

Giáo viên Việt Nam mất nhiều giờ soạn học liệu thủ công: giáo án theo CTGDPT 2018, ma trận đề theo TT 22/2021 (tiểu học) và CV 7991 (THCS/THPT), đề kiểm tra, phiếu học tập, slide, bài tập tiếng Anh. Các công cụ AI ngoài thị trường không gắn YCCĐ thật, không có ngân hàng câu hỏi, và sinh nội dung không theo biểu mẫu Bộ GD&ĐT.

## 2. Personas

| Persona | Role | Core needs |
|---|---|---|
| GVBM tiểu học/THCS | `gvbm` | Soạn KHBD, phiếu học tập, đề kiểm tra theo đúng YCCĐ mình dạy; xuất Word/PPTX/PDF |
| GVCN | `gvcn` | Ra đề định kỳ từ ngân hàng, kiểm tra chất lượng câu hỏi trước khi dùng |
| Tổ trưởng chuyên môn | `to_truong` | Duyệt học liệu/câu hỏi của tổ, giữ chuẩn ma trận |
| BGH | `bgh` | Ký duyệt đề, kiểm soát nguồn câu hỏi |

## 3. Functional requirements

### 13 công cụ đã triển khai (`src/lib/tvc/registry.ts`)

| Code | Tool | Loại | Yêu cầu chấp nhận |
|---|---|---|---|
| DC-01 | Biên soạn KHBD | AI + fallback | Khung CTGDPT 2018: Mục tiêu (KT/NL/PC) - Thiết bị - Tiến trình theo hoạt động (Mục tiêu/Nội dung/Tổ chức/Sản phẩm/Đánh giá) - Điều chỉnh - Ký duyệt; hỗ trợ biểu mẫu trường (`khbd_template`); co-draft theo đặc điểm lớp |
| DC-02 | Ma trận + đặc tả | rule-based | TT22 4 mức (NB/TH/VD/VDLH) cho cấp TH, CV 7991 3 mức cho THCS/THPT; VDLH gán cell TLN nhỏ; bù làm tròn tổng điểm; spec có requirement + năng lực |
| DC-03 | Sinh đề từ ma trận | rule-based | Rút câu theo `standard_ids`+qtype+level, fallback mức gần, chống trùng stem, `pack` (đề CT + dự phòng + đáp án + biên bản phản biện), `shuffle` 2 mã đề, `tf_score` linear/QĐ 764 lũy tiến, `approved_only` |
| DC-04 | Ngân hàng câu hỏi | trang riêng | `/studio/questions`: lọc môn/lớp/YCCĐ/dạng/mức/trạng thái, import CSV/XLSX/DOCX/PDF/ảnh (AI đọc), duyệt câu hỏi |
| DC-05 | Phiếu học tập | AI + fallback | Bố cục in: Khởi động - Khám phá/Luyện tập - Vận dụng; đáp án tách appendix; phân hóa HS khá giỏi |
| DC-06 | Bài trình chiếu | AI + fallback | Slide theo tiến trình KHBD, ghi chú GV + gợi ý hình từng slide; `?from=<material>` nhận giáo án DC-01; xuất .pptx thật |
| T-01 | Biến thể bài toán | AI + fallback | 10-30 biến thể giữ cấu trúc bài gốc, cấm lặp bài gốc |
| T-02 | Công thức/ký hiệu | trang soạn thảo | Bàn phím 42 ký hiệu/5 nhóm, chèn tại con trò (caret vào trong `{}`), preview KaTeX live, copy LaTeX |
| V-01 | Kho ngữ liệu | trang riêng | `/studio/literature`: văn bản thẩm định, ghi nguồn; link "Sinh câu hỏi" → V-02 `?lit=` prefill |
| V-02 | Câu hỏi đọc hiểu | AI + fallback | 3 mức (Biết/Hiểu/VD) đủ 4 dạng TT22 từ văn bản cho trước |
| A-01 | Bài đọc theo bậc | AI + fallback | Nguyên gốc, kiểm soát CEFR (A1-B2), bảng từ vựng + câu hỏi; `sectionsLookEnglish` guard |
| A-02 | Bài tập từ vựng | AI + fallback | Nhiều dạng: điền khuyết/nối/chọn/đặt câu/ô chữ/flashcard |
| A-03 | Hội thoại + nghe | AI + fallback | Hội thoại tiếng Anh bắt buộc (language guard), transcript + bài nghe 4 dạng |

### Cross-tool links (đã verify)

- DC-02 → lưu ma trận → "Sinh đề từ ma trận này" → DC-03 `?matrix=<id>` preselect
- V-01 → chi tiết văn bản → "Sinh câu hỏi" → V-02 `?lit=<id>` prefill textarea
- DC-01 → material lesson_plan → "Sinh bài trình chiếu" → DC-06 `?from=<id>`
- Mọi material → `/studio/library/[id]` → Xuất Word (.docx), Xuất PPTX (type=slides), Xuất PDF (trang in), Gửi duyệt

## 4. Ngân hàng câu hỏi (CR-043)

- **Base bank deterministic** (`scripts/gen-bank/`): generator viết tay theo dạng đề thi TH thực tế — không copy SGK/đề thi (bản quyền). 20.810 câu `imported`/`approved`.
- **AI expansion** (`expand-ai.mjs`): biến thể từ câu base cùng YCCĐ, `source=generated`, `review_state=unreviewed` (GV phải duyệt trước khi vào đề thật). 295 câu.
- **Tổng: 21.105 câu**, phủ đủ 81/81 YCCĐ cấp 1 (Toán 43, Tiếng Việt 23, Tiếng Anh 15).
- Đáp án Toán tính bằng số học — đúng tuyệt đối; sweep: 0 MC hỏng, 0 đáp số âm, 0 Đ/S thiếu mệnh đề, 0 dot-decimal (dấu phẩy VN thống nhất).

## 5. AI provider policy

- Chuỗi: Gemini (`GEMINI_API_KEY`) → OpenAI-compatible slot trỏ OpenRouter (`OPENAI_API_KEY`+`OPENAI_BASE_URL`+`OPENAI_MODEL`) → Anthropic (`ANTHROPIC_API_KEY`+`ANTHROPIC_MODEL`) → engine Devin (quota) → rule-based fallback.
- Model/provider đọc từ env, không hard-code; output qua `isDocContent` + `cleanDoc` + validator riêng từng tool.
- Câu AI-gen không bao giờ tự động approved.

## 6. Non-functional

- Không chặn page render bằng AI call (generate là action riêng, maxDuration 120s; có async job path qua Devin session + callback).
- Mọi tool page có `requireRoles`, generate route kiểm role + feature grant.
- Audit: `logAudit` trên save/review mutations.
- Vietnamese copy: dấu gạch `-`, không em/en-dash; số thập phân dấu phẩy.

## 7. Acceptance criteria — đã verify 2026-10-09

- [x] 13/13 tool render trong `/studio`, mỗi tool sinh được học liệu (AI hoặc fallback)
- [x] DC-03 trên 4 ma trận (Toán L1/L5, TV L3, TA L4): 0 `[THIẾU]`, đáp án kiểm tay đúng 12/12
- [x] Export docx/pptx đúng MIME; print page 200; id giả → 404
- [x] DC-02→DC-03, V-01→V-02, DC-01→DC-06 deep-links hoạt động qua UI thật
- [x] Ngân hàng 21.105 câu, 81/81 YCCĐ, quality sweep sạch

## 8. Out of scope / backlog

- Audio TTS thật cho A-03 (mô tả nói "audio giọng đọc" — hiện chỉ transcript; TTS trình duyệt ở question-bank chưa nối vào material)
- `ngu_van` grade range 1-12 cần tách cấp (chờ CR)
- 55 duplicate stems nhỏ (~0,3%) trong bank — chấp nhận, xem lại khi dedupe đợt sau
