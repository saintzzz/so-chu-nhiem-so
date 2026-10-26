# External Review - CR-060 (module flags) + CR-061 (bank ratio)

Reviewer: reviewer-claude (cross-model subagent), doc bang `git show 8f4d173` + file-context.

## Round r-h0601 - REJECT

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | **Critical** | `sf_write`/`sf_read` dung `@>` (containment) thay vi `&&` (overlap) - khong user nao co ca 2 role nen khong ai ghi/doc duoc; `/dept/modules` dead on arrival | `@>` -> `&&` ca 3 predicates, re-apply policy tren live DB |
| 2 | High | `sf_read` nhanh 1 NULL cho dept roles (khong co school_id) + nhanh 2 bat kha thi -> matrix render "all on" du da tat | cung fix boi #1 (nhanh `&&` dung) - verify live: so_gd toggle -> row persist |
| 3 | High | `disabledModules()` throw trong root layout + migration thieu grants -> neu chua migrate, MOI route staff 500 | them `grant select to authenticated` + `grant all to service_role`; layout catch -> nav fail-open (hien du), route guards van fail-closed |
| 4 | High | CR-061 tach pool SAU fetch chung limit 120 -> bank he thong lon an het slot, "100% truong" van ra 0 cau truong | fetch 2 query rieng theo nguon (`.is(null)` / `.eq(mySchool)`), moi nguon cap rieng |
| 4b | - | quota `slice(0, wantSchool)` tinh tren pool chua loc `used` -> cau truong bi cell truoc an -> he thong bu sai | filter `notTaken` truoc khi slice |
| 5 | Medium | chi 2/6 endpoint studio co assertModule - audio/extract/materials-export van callable | them assertModule vao 3 route con lai + 3 action safety (`tu_van_an_toan`) |
| 6 | Medium | `/register/lock-records` nav-hidden nhung route van mo | `requireModule("hoc_ba")` trong page |
| 7 | Medium | RTM titles claim AC nhung chi assert source-text | relabel "(static)" + them assert cho `&&`/grants/2-query; evidence E2E ghi vao CR doc |
| 8 | Medium | scope doc vs code lech (11->4 keys, school_id NOT NULL, `/dept/modules` thay `/school/modules`) | "Rulings & implementation notes" trong CR-060 doc - ghi nhan co chu dich |
| 9 | Low | `updated_by` khong set | set tu getProfile() trong action |

## E2E evidence (live, local dev + RLS that)

1. Login `sovqt@demo.scn` (so_gd) -> `/dept/modules` render matrix 3 truong x 4 module, all-on.
2. Toggle `hoc_ba` OFF cho TH-KD -> row persist: `{module:'hoc_ba', enabled:false, updated_by:<sovqt uid>}` (truoc fix `&&`: se la 42501).
3. Login `huongbb@kd.scn` (GVCN KD) -> menu "Quan ly hoc sinh" khong con "Hoc ba so"; GET `/records/hoc-ba` -> redirect `/dashboard`.
4. Revert (xoa flag) -> /studio + hoc ba hoat dong lai binh thuong.

## Verdict hien tai

Cho round confirm sau khi commit fix.
