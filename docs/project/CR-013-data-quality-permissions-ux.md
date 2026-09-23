# CR-013 — Chất lượng dữ liệu, phân quyền & UX nhất quán

Date: 2026-10-12 · Reporter: user · Priority: high (12 findings)

## Findings & root causes

| # | Vấn đề | Root cause | Fix |
|---|---|---|---|
| 1 | Dashboard "32 hồ sơ chưa hoàn thành" | Metric đúng nhưng 366/366 HS thiếu dob/address/gender (seed gap); card không nói thiếu gì | Backfill dob+gender cho seed; card hiện breakdown trường thiếu + link tới records |
| 2 | Chế độ tuyên dương reset khi đổi lớp; không có lý do | `praiseMode` là useState mất khi server-nav | Persist `?praise=1` (URL) hoặc localStorage; chip HS hiện "+N điểm" + lý do gần nhất |
| 3 | AI insight hiển thị `**Đề xuất:**` | AiInsightCard strip bullet nhưng không strip markdown `**`/`__` | Strip markdown emphasis trong applyResult |
| 4 | "Học sinh cần hỗ trợ" trông view-only | Khi tất cả pair đã có plan → 0 selectable, không thấy action; duyệt nằm ở trang khác | Hiện plans hiện có + trạng thái + action inline; giữ link sang /academics/plans |
| 5 | Soạn thông báo gửi "tất cả" không báo ai nhận | Email là kênh chính (PH không cần tài khoản) nhưng UI không preview coverage | Preview "X phụ huynh có email sẽ nhận / Y chưa có email" theo lớp/HS đã chọn |
| 6 | GVCN thấy "Báo cáo Ban Giám Hiệu" trong nav + vào được /safety/bgh | requireRoles(["gvcn","bgh","pht"]) + nav item; ROLE-MATRIX: bgh only | Route → bgh (+pht); bỏ nav item khỏi GVCN; GVCN vẫn ghi nhận/theo dõi sự cố lớp mình |
| 7 | Upload HS: không có drag-drop; AI extract chỉ paste text | Chỉ có hidden input + textarea | Thêm dropzone kéo-thả; AiExtract nhận file .xlsx/.csv (parse client → gửi text) |
| 8 | GVCN ký duyệt sổ chủ nhiệm | requireRoles(["gvcn","bgh"]) — sai matrix (bgh) | Workflow 2 bước: GVCN "Nộp sổ" (submitted) → BGH "Ký duyệt" (signed) |
| 9 | Nhiều màn trống | Seed sparse: appointments=1, exams=1, conduct_evaluations=5, messages=6, support_plans=2 | Seed data qua UI/features cho các màn trống |
| 10 | Xuất sổ = CSV, thiếu chuyên cần | exportCsv + attendance filter theo `period` | Xuất .xlsx (lib/excel có sẵn), multi-sheet: DS HS + chuyên cần + điểm |
| 11 | Báo cáo AI auto-generate mỗi load | ReportAiCard gọi LLM trong Suspense mỗi render | Chuyển sang AiInsightCard pattern (nút "Phân tích" → /api/ai/class-analysis) |
| 12 | Emulation scoring: GVCN chấm mọi lớp | ScoringGrid không scope lớp theo role | GVCN chỉ chấm lớp chủ nhiệm; BGH toàn trường (xem Q&A) |

## Impact assessment

- Routes touched: /dashboard, /register/seating, /attendance/tracking, /academics/support, /parents/compose, /safety/bgh (+nav), /records/upload, /register/signoff, /register/export, /records/report, /emulation/scoring
- Data: backfill students.dob/gender (seed-only, deterministic)
- RBAC: thắt chặt /safety/bgh, /register/signoff, /emulation/scoring — đúng ROLE-MATRIX
- Risk: signoff workflow đổi status enum → cần giữ tương thích bản ghi cũ

## Estimate

~1 ngày: 12 fixes nhỏ-vừa + seed data + E2E re-verify.
