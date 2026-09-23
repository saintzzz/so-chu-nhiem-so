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

## Implementation result (2026-10-12)

| # | Trang thai | Ghi chu |
|---|---|---|
| 1 | Done | 366 HS backfill address; card dashboard render breakdown |
| 2 | Done | `?praise=1` persist qua chips doi lop; chip HS: `+N diem - ly do` |
| 3 | Done | AiInsightCard strip markdown emphasis |
| 4 | Done | PlanActions inline tren hang da co plan |
| 5 | Done | Compose preview so PH co email |
| 6 | Done | /safety/bgh -> bgh+pht; bo nav GVCN; verify redirect |
| 7 | Done | Dropzone + AiExtract file input (mo san section) |
| 8 | Done | submitted_by/at + flow 2 buoc; fix CHECK constraint them 'submitted'; scope chi lop CN |
| 9 | Done | Seed qua UI: appointments 1->3, exams 1->4, equipment 2->5, KPI 2->4, conduct_evaluations 5->32, messages 6->7 |
| 10 | Done | .xlsx 2 sheet (Tong hop + Chuyen can chi tiet 230 rows); fix month range ${period}-31 |
| 11 | Done | /api/ai/report-analysis + nut "Phan tich"; khong auto-generate |
| 12 | Done | UI readonly cot lop ngoai CN + RLS siets: gvcn chi lop gvcn_id=self |

### Bug phat hien them khi verify

- `register_signoffs_status_check` thieu 'submitted' -> update 400. Da alter constraint + migration.
- Signoff/lock-records/export dung `getAccessibleClasses` (CN + lop day) -> GVCN thay nut nop cho lop nguoi khac. Scope lai `gvcn_id = self`.

### Verify production (Playwright + DB)

- 28 checks, 27 PASS dau tien; fail con lai do selector test (link `?to=` thay `?parent=`) va CHECK constraint - da fix va verify lai.
- Signoff E2E: GVCN nop -> status submitted + submitted_by; BGH ky -> signed + signed_by (verify DB).
- Export: download `so-chu-nhiem-6A1-2026-09.xlsx`, sheet Chuyen can 230 rows du lieu that.
- Emulation: GVCN 8 input/33 readonly; BGH 36 input; RLS chan ghi lop ngoai CN.
- Messages: GVCN -> PH qua UI, row + notification insert.

Commits: c642d04, 40de2e9, 6e0ad05.
