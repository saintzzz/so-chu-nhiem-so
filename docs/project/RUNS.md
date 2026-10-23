# RUNS — pipeline run log

Mỗi pipeline run (full / CR / quick-flow) ghi 1 dòng: intake id, track,
phases, số lần lead-review reject, defect bắt được vs thoát, thời gian.

| ID | Track | Phases | Lead rejects | Defects caught | Escaped | Ghi chú |
|---|---|---|---|---|---|---|
| CR-053 | CR | BA→Design→TL→Dev→Test→Deploy | BA×3, Design×1, TL×2 | 3 (stage-insert P0001, classParam silent fallback, nav children rỗng) | 0 | Học bạ số; RTM 26/26; E2E workflow+deny+lock verified; ext review no blocker |
