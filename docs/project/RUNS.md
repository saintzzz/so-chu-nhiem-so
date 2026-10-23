# RUNS — pipeline run log

Mỗi pipeline run (full / CR / quick-flow) ghi 1 dòng: intake id, track,
phases, số lần lead-review reject, defect bắt được vs thoát, thời gian.

| ID | Track | Phases | Lead rejects | Defects caught | Escaped | Ghi chú |
|---|---|---|---|---|---|---|
| CR-053 | CR | BA→Design→TL→Dev→Test→Deploy | BA×3, Design×1, TL×2 | 3 (stage-insert P0001, classParam silent fallback, nav children rỗng) | 0 | Học bạ số; RTM 26/26; E2E workflow+deny+lock verified; ext review no blocker |
| DOC-2026-10-23 | docs | Cập nhật user guide + deck giới thiệu | - | - | - | v2.1→v2.2: thêm §2.13 Học bạ số (usecase + login từng bước), MO-TA-CHUC-NANG, slide mới; regen USER-GUIDE-vieschool.pptx |
| CR-053-r33/r34 | review-loop | ExtRev r33 (6 majors) -> fix -> r34 re-review | 0 | 7 (client-trusted snapshot, form-seed nulls, rejected->draft, decided_by/at mutable, stale-check thieu, docx fallback computed, Promise.all gia) | 0 | d483ba0+4dd999e; migration 20261223 applied prod; Playwright prod: GVCN chip->override gate + DOCX ok, BGH locked view ok, guard live tren DB |
