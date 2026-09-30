# PM Report - VieSchool Education Ecosystem SDLC Run

**Date:** 2026-09-30
**Scope:** Full SDLC sweep across 3 products (Sổ Chủ Nhiệm Số, TVC360 Công cụ số Giáo viên, English Arena) driven by 2024-2026 MOET regulatory research + competitor teardown.

## 1. Research findings that drove requirements

| Source | Finding | Impact |
|---|---|---|
| TT 15/2026/TT-BGDĐT (hiệu lực 10/05/2026) | Điều lệ trường mới thay TT 28/2020 + 32/2020; hồ sơ GV tinh giản còn KHBĐ + Sổ chủ nhiệm; hồ sơ điện tử có giá trị pháp lý; cấm so sánh HS với nhau | SCN: sửa citation CMHS; định vị sổ CN số đúng hướng; kiểm chứng ranking chỉ ở cấp thi đua lớp |
| Dự thảo TT sửa 27/2020 + 22/2021 (CV 4582, 07/2026) | Kiểm tra trên máy tính, học bạ số, khai thác dữ liệu đánh giá điện tử | TVC360/EA: định hướng đúng; không build phụ thuộc cứng vào dự thảo |
| QĐ 764/QĐ-BGDĐT | Phần II Đúng/Sai chấm lũy tiến 1/2/3/4 ý = 0,1/0,25/0,5/1đ | TVC360 CR-07: ghi chú chấm vào hướng dẫn chấm của đề |
| Đối thủ: vnEdu HSS, SMAS, eNetViet, Azota, MagicSchool, TpT, Monkey Junior, Babilala, Duolingo, Lingokids, Khan Academy Kids, IXL | Khoảng trống: báo cáo phụ huynh, placement test, offline mode, chứng nhận in được | Backlog đề xuất (mục 5) |

## 2. Work delivered this cycle

### Sổ Chủ Nhiệm Số (`so-chu-nhiem`, branch `master`)
- `docs/research/REGULATIONS-UPDATE-2026.md` - artifact research quy định 2026.
- `docs/project/CR-018-tt15-2026-dieu-le.md` - CR thay căn cứ pháp lý.
- Sửa citation TT 32/2020 → TT 15/2026 tại `parents/cmhs` page + `cmhs-board` component; cập nhật ROLE-MATRIX + FUNCTIONAL-CHECKLIST.
- Fix UX: `/portal` trả 404 → redirect theo role home (`02ad443`).
- Commits: `9a13d4f`, `02ad443`.

### TVC360 (`tvc360-congcuso`, branch `master`)
- `docs/10-research-2026-09-30.md` + `docs/11-cr07-qd764-grading.md`.
- Appendix hướng dẫn chấm có ghi chú chấm phần II lũy tiến theo QĐ 764 (`ddaaaae`).
- Perf `/app/questions`: bỏ 2 cột nặng `answer`/`solution` khỏi list (lazy-load khi expand qua `getQuestionDetail`), chỉ fetch 100 câu đầu server-side, phần còn lại background-load qua `listQuestionsChunk` (`1c238f8`, `3e23cac`).

### English Arena (`student-self-practice-web`, branch `main`)
- `docs/sdlc/CR-21-regulatory-qa-2026.md` - research quy định + verify prod.
- CR-08 đánh dấu hoàn tất thực tế: student + admin auth trên prod hoạt động đầy đủ.
- Commit: `5fa1f6d`.

## 3. QA + performance results (production)

### Sổ Chủ Nhiệm - https://sochunhiem.vieschool.com
- qa-perf suite: **gần như toàn PASS** (TTFB<1s, load<3s warm). Fail duy nhất: `gvbm /academics/grades` cold TTFB 3.5s → warm 1.68s; keep-warm pg_cron + CI ping 10' giảm cold hit thực tế.
- Role denial verified: `hoc_sinh` vào `/school/dashboard` + `/emulation/scoring` → redirect `/portal/student`; `phu_huynh` vào `/academics/grades` → `/portal/parent`.
- `/portal` bare giờ redirect đúng role (đã fix + push).

### TVC360 - https://tvc360-congcuso.vercel.app
- `/app/questions` TTFB: **1528-1657ms → 500-801ms** sau progressive loading (verify prod).
- `/moderation` cold TTFB ~4s → warm ~360-420ms; keep-warm ping 10'.
- Exam generation re-verified: 30 câu, 0 trùng, đáp án đủ 30, TF format thống nhất, DOCX 238 oMath native.
- Lint/typecheck/build xanh (7 warning có sẵn, 0 error).

### English Arena - https://ea.vieschool.com
- Unit tests **720/720 PASS** (85 files). Build xanh (tsc + vite, 8.1s).
- Prod: student PIN login OK (5 vùng đất), admin console OK (tài khoản/lớp/gán/nội dung), 0 page errors.

## 4. Deployment health

| URL | Status |
|---|---|
| https://sochunhiem.vieschool.com | 200 (→ /login) |
| https://congcuso.vieschool.com | 200 |
| https://tvc360-congcuso.vercel.app | 200 |
| https://ea.vieschool.com | 200 |
| https://vieschool.com | 200 |

Lưu ý: `scn.vieschool.com` từng báo lỗi là hostname sai - canonical đúng là `sochunhiem.vieschool.com` (đã verify sống). DNS `vieschool.com` qua Cloudflare; apex proxy CF Worker tới `vieschool-landing`.

## 5. Backlog (ưu tiên từ research + đối thủ)

1. **SCN:** báo cáo phụ huynh định kỳ qua email (đã có Resend wiring); audit trail view cho hồ sơ điện tử (TT 15/2026 nhấn mạnh giá trị pháp lý hồ sơ số).
2. **TVC360:** chế độ "thi trên máy" chuẩn bị cho dự thảo sửa TT 22/2021 (đề + phiếu trả lời + chấm lũy tiến phần II tự động); marketplace chia sẻ tài liệu (TpT-style) đã nằm trong roadmap.
3. **EA:** placement diagnostic tự xếp lớp; parent weekly digest; certificate in được khi hoàn thành vùng đất; offline practice pack.
4. **Chung:** giám sát cold-start các route nặng (gvbm/grades, moderation) - cân nhắc tối ưu query sâu hơn nếu keep-warm chưa đủ.

## 6. Risks

- Dự thảo sửa TT 27/2020 + 22/2021 chưa ban hành chính thức - các tính năng thi máy/học bạ số phải theo dõi văn bản cuối.
- Question bank TVC360 đã sạch sau đợt chuẩn hóa (control char, format Đ/S, options thiếu, đáp án lệch lời giải) nhưng chưa có validate-on-save - câu mới nhập tay vẫn có thể lỗi. Đề xuất thêm validation form soạn câu hỏi.

## 7. Requirements traceability

- TT 15/2026 citation → CR-018 → commit `9a13d4f` → verify prod.
- QĐ 764 phần II → CR-07 (`docs/11`) → commit `ddaaaae` → verify đề sinh lại.
- Perf ngân hàng câu hỏi → `1c238f8` + `3e23cac` → verify prod TTFB 500-800ms.
- CR-08 EA prod auth → verify trực tiếp + `docs/sdlc/CR-21`.
- Role boundaries cả 3 → Playwright cross-role checks (mục 3).
