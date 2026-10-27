# EXTERNAL-REVIEW-admissions (CR-062)

Review loop cho module Tuyen sinh dau cap (commits 1105455, 98eaf09,
7b81947). Reviewer: reviewer-gpt (cross-model).

## r-adm1 (commit 1105455) - REJECT: 5H + 5M + 1L

| # | Finding | Triage | Fix |
|---|---|---|---|
| 1 | so_gd write trong RLS nhung guard chan | Dung | MIG2: write policy bo so_gd (chi read) |
| 2 | Enroll khong retry-safe, orphan student | Dung | MIG2: RPC admission_enroll atomic |
| 3 | students insert thieu school_id | KHONG DUNG | students khong co cot school_id (qua class_id) |
| 4 | Khong check campaign-class cung truong | Dung | MIG2: school_mismatch trong RPC + JS check |
| 5 | Cap SBD race -> partial batch | Dung | MIG2: RPC advisory lock + 1 UPDATE |
| 6 | CAS no-op khong detect | Dung | check updated row count, bao loi stale |
| 7 | Diem loi bi drop thay vi reject | Dung | reject ngoai 0-10 + bat buoc du mon |
| 8 | Finalize bo sot thi sinh thieu diem | Dung | RPC raise missing_scores:N |
| 9 | Quota khong dung | Dung | cutoff = max(benchmark, diem hang quota); dong diem nguong deu do |
| 10 | Enroll N+1 | Dung | gop vao RPC single txn |
| 11 | Middle dot `·` | KHONG DUNG | `·` la convention 10+ file; rule chi cam em/en dash |

Live verify (DB): SBD TS0001-4 atomic; missing_scores:4 block; quota=2 +
benchmark=20 voi 3 thi sinh >=20 -> cutoff=25 (A 27 + D 25 do, B 24 truot);
enroll tao 2 students, retry 0; school_mismatch raise. Commit: 98eaf09.

## r-adm2 (commit 98eaf09) - REJECT: 3H + 5M + 1L

| # | Finding | Triage | Fix |
|---|---|---|---|
| 1 | v_student khong reset moi vong | Defensive dung* | MIG3: v_student := null dau vong lap (*PG docs: SELECT INTO no-row da gan NULL, reset them cho ro) |
| 2 | finalize pass ca row null score | Dung (defense) | MIG3: pass update co `total_score >= v_cutoff`, fail co `total_score is null or <` |
| 3 | Retry sau suffixed code -> dup | DUNG - bug that | MIG3: lookup ca (v_code, v_code_alt) deterministic |
| 4 | assign SBD khong check level | Dung | MIG3: wrong_level tru khoi_10 |
| 5 | finalize khong check level | Dung | MIG3: wrong_level tru khoi_10 |
| 6 | students_staff_ins khong co pht | Dung - verify pg_policies | MIG3: pht + scn_class_in_school |
| 7 | saveScores sua duoc sau finalize | Dung | chi exam_registered |
| 8 | reviewApplication approve ca khoi_10 | Dung | check level='khoi_6' truoc |
| 9 | Exception RPC chua map VN | Dung | map het wrong_level/campaign_not_found/class_not_found/school_mismatch/no_benchmark/missing_scores |

Live verify (DB): khoi_6 -> wrong_level ca assign lan finalize; occupier
'COLLIDE1' + app id_number='COLLIDE1' -> enrolled voi code suffix;
retry tra 0, khong dup. Commit: 7b81947.

## r-adm3 (commit 7b81947) - APPROVE

Reviewer xac nhan toan bo 9 fix cua r-adm2 dung trong code, khong con
blocker hay high-severity nao trong pham vi review. Loop dong.

## Residual / deferred
- Quota tie-break: dong diem nguong deu do; tieu chi phu (uu tien khu vuc,
  mon thi chinh) de cho CR sau khi truong yeu cau.
- Sua diem sau chot ket qua: khoa; mo lai can workflow re-open rieng (CR sau).
- Cong dang ky tuyen sinh public cho PH: scope CR sau.
