# Cross-Learn: bài học business từ SlideForge

Date: 2026-10-22 · Phân tích so sánh business giữa `so-chu-nhiem` (Sổ Chủ Nhiệm
+ TVC360 Studio) và `slideforge` (slide→video/deck pipeline cho trung tâm Anh
ngữ). Mỗi mục = **CR candidate** — cần viết CR + impact assessment trước khi
implement; tài liệu này chỉ là artifact phân tích, không phải quyết định.

SlideForge PRD: 24 REQ-F + 13 REQ-N + 158 AC; đã qua 3 round external review.

## 1. Async job pipeline cho tác vụ nặng (Studio + import)

**SlideForge có:** `sf.jobs` queue với state machine đầy đủ
(`queued → extracting → classifying → awaiting_review → narrating → building
→ done/failed/cancelled`), worker `SKIP LOCKED` + lease token 120s +
heartbeat 15s, `job_events` timeline observable, retry/cancel/discard theo
`error_retryable`, stage timeout 10min + job budget 20min enforce trong
sweeper.

**scn hiện tại:** Studio generate đồng bộ trong server action
(`maxDuration 120s`); async chỉ là fallback khi provider hết quota
(`ai_jobs` + Devin session callback). Import ngân hàng (DOCX/PDF/ảnh → AI
đọc) cũng đồng bộ.

**Ứng dụng cho scn:** các tác vụ hay timeout/OOM — import file lớn vào ngân
hàng, sinh `pack` đề thi (đề CT + dự phòng + đáp án + biên bản), expand
bank hàng loạt — nên chạy qua queue kiểu sf.jobs: progress UI theo stage,
retry resume được, không chết theo serverless timeout. Quan sát được bằng
job_events thay vì action return.

## 2. Review stage có cấu trúc trước khi dùng output AI

**SlideForge có:** stage `awaiting_review` bắt buộc — GV sửa nhãn/text từng
segment trong review editor (versioned `review_version`, bulk ops,
shortcut scope rõ ràng), confirm mới chuyển sang narrating/building.

**scn hiện tại:** AI material vào thẳng library; question bank có
`review_state: unreviewed|approved|flagged` nhưng không có màn hình review
cưỡng chế từng item trước khi dùng — `approved_only` chỉ là option khi sinh
đề.

**Ứng dụng cho scn:** KHBD, đề kiểm tra, câu hỏi AI-gen — nghiệp vụ yêu cầu
người duyệt trước khi phát hành (to_truong duyệt câu hỏi, BGH ký đề). Mô
hình "generate → draft review → confirm → publish" đúng hơn "generate →
lưu → ai muốn duyệt thì duyệt".

## 3. Quota = budget + admission control (2 lớp)

**SlideForge có (BR-5):** 2 lớp — concurrent ACTIVE limit (2 job/teacher,
atomic bằng row-lock transaction, 2 request đồng thời không cùng qua) +
daily admission (20 job/ngay reset 00:00 ICT; failed/cancelled vẫn tính 1
admission; admin vẫn chịu concurrent limit).

**scn hiện tại:** `ai_budgets`/`ai_usage_counters` (quota theo chi phí/
lượt qua RPC `scn_ai_quota_take`) — fail closed tốt, nhưng không có
concurrent limit: N GV cùng bấm generate = N request 120s đồng thời.

**Ứng dụng cho scn:** thêm admission/concurrency layer phía trước budget
cost — kiểm tra nguyên tử trong cùng transaction như `sf_create_job`.

## 4. Retention & lifecycle policy

**SlideForge có (BR-11):** source file purge 30 ngày sau terminal; failed/
cancelled purge 7 ngày; soft-delete lesson 7 ngày restore window (admin
khôi phục); asset gắn vòng đời lesson (không purge cùng source); orphan
storage sweep 24h; pg_cron schedule.

**scn hiện tại:** chưa có retention policy cho materials, file import,
media câu hỏi — storage tăng vô hạn + DPIA chưa khai báo retention.

**Ứng dụng cho scn:** khai báo retention cho `tvc` materials + file import +
media (phù hợp DPIA-v1 đã có), soft-delete + restore cho materials/exams
(ngăn mất đề thi đã phát hành), cron purge + orphan sweep.

## 5. Regenerate với build identity mới

**SlideForge có (BR-12):** regenerate = job/build `n+1` NGAY ở
`awaiting_review` với snapshot extraction+review cũ; file cũ vẫn tải được
cho tới khi build mới `done` rồi swap atomic; CAS trên
`lesson.active_build_id` (1 regen pending/lesson); reservation release
đúng trên mọi transition; sweep dọn reservation kẹt.

**scn hiện tại:** edit/regenerate material ghi đè trực tiếp — deck/exam đã
phát hành cho GV khác có thể đổi giữa chừng hoặc hỏng nếu regen lỗi.

**Ứng dụng cho scn:** với đề thi/ngân hàng đã duyệt — versioning mạnh (đề
approved là immutable; chỉnh sửa tạo version mới, swap khi duyệt lại xong).
Bảo vệ "đã phát hành cho trường" khỏi mutation giữa chừng.

## 6. Signed-URL artifact delivery + download audit

**SlideForge có:** download = authorize → audit (`user_id, lesson_id, ts`)
→ signed URL 300s; không public link; upload qua signed URL 900s.

**scn hiện tại:** export docx/pptx/pdf sinh buffer trong request — OK cho
file nhỏ, nhưng không có audit ai tải đề thi nào.

**Ứng dụng cho scn:** đề kiểm tra + biên bản là tài liệu nhạy cảm — audit
download (ai tải đề nào, khi nào) là yêu cầu bảo mật đề thi, không chỉ
logging thường.

## 7. Copyright acknowledgement gate

**SlideForge có (BR-13):** lần upload đầu của mỗi account bắt buộc tick xác
nhận bản quyền, enforce SERVER-SIDE trong `sf_create_lesson`/`sf_create_job`
(`copyright_ack_at IS NOT NULL`), không chỉ client checkbox.

**scn hiện tại:** ngân hàng import DOCX/PDF có thể chứa nội dung SGK —
không có ack/enforcement nào.

**Ứng dụng cho scn:** cùng pattern — first-import ack lưu `ack_at` trong
profile + verify server-side trước khi nhận file; cộng với DPIA đã có.

## 8. Page-range limits cho tài liệu lớn

**SlideForge có (BR-4):** >40 trang bắt buộc chọn page range.

**scn hiện tại:** import ngân hàng đọc cả file bằng AI — file lớn = chi phí
+ timeout, không giới hạn.

## 9. File-type verification theo inner structure

**SlideForge có:** magic bytes + probe member bắt buộc (`word/document.xml`
cho DOCX) + zip entry/size caps + PDF sanitize (drop EmbeddedFiles/
OpenAction/JavaScript).

**scn hiện tại:** import accept theo extension/content-type — lớp hardening
này chuyển trực tiếp được (question bank nhận file từ nhiều GV).

## 10. Thứ tự nghiệp vụ khác đáng học

- **Idempotent write theo stage** (`sf_worker_bulk` delete-then-insert
  theo stage) — scn regeneration của material section nên idempotent tương
  tự thay vì append.
- **job_events timeline** — UI progress per-stage với timestamp thay vì
  spinner đơn.
- **Quota exhausted = giữ trạng thái chờ** (`awaiting_review` + báo
  E-QUOTA) thay vì mất input của user.
