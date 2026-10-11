# External Review - CR-049 hardening, Codex Cloud round 5

- Reviewer: ChatGPT Codex Cloud (browser task qua Chrome CDP)
- Commit reviewed: `4e39cb3` (CR-049 P1-P3: org-scope RLS, AI PII layer,
  quota/budget, digest outbox, grade CAS, TT22 provisional)
- Report: `docs/reviews/codex-cloud-report-cr049-raw.txt`
- Verdict: **NOT-CLEAN - 19 findings (7 HIGH, 12 MEDIUM)**
- Triage: **19/19 confirmed, 0 false-positive, 0 deferred** - tat ca da fix.

## Triage table

| # | Sev | Finding | Triage | Fix | Verify |
|---|-----|---------|--------|-----|--------|
| H1 | HIGH | Outbox staff-read expose body chua du lieu con o truong/campus khac | confirmed | `20261125_cr049_r5_fixes.sql`: drop `digest_outbox_staff_read` + `revoke select ... from authenticated`. Staff doc trang thai qua `digest_deliveries` (khong chua body). | policy dropped tren prod; code khong con authenticated read nao vao digest_outbox |
| H2 | HIGH | Budget denial tao Devin job tra phi | confirmed | `budget_block` tach khoi provider `quota`: respondWithAi + 7 direct/studio routes return `error` (khong vao nhanh fallback); usage ghi `budget_block`. | grep: khong callsite nao truyen `quota` khi `!quotaOk` |
| H3 | HIGH | Client tu goi quota RPC dot shared counter | confirmed | `scn_ai_quota_take(text,uuid)` + `scn_ai_record_usage(text,text,text,uuid)`: revoke public/anon/authenticated, grant service_role; helpers goi qua admin client + truyen actor. | prod: `auth_exec=false, svc_exec=true` ca 4 RPC |
| H4 | HIGH | Grade CAS check/replace khong cung 1 lock | confirmed | `pg_advisory_xact_lock(hashtextextended(subject|term|year,0))` serialize writers trong `scn_save_grades`. | prod smoke: `CHECK:STALE_OK` |
| H5 | HIGH | Save grades co the xoa/relabel nam hoc khac | confirmed | RPC resolve `v_year` tu class khi param null; CAS+delete scope `(academic_year_id is null or = v_year)` - nam khac khong bi cham. | prod smoke: `CHECK:OTHER_YEAR_PRESERVED` |
| H6 | HIGH | Email da gui co the gui lai sau crash | confirmed | (a) requeue RPC reconcile: `sending/queued` da co delivery `sent` -> mark sent; (b) send loop pre-check `digest_deliveries` sent truoc khi goi provider; (c) deliveries insert TRUOC outbox update - crash de lai vet reconcile bat duoc. | code review; residual window = provider-accept->insert (khong the dong khong co provider idempotency - chap nhan at-least-once) |
| H7 | HIGH | Direct Devin fallback bypass PII redaction | confirmed | Moi `fallbackToDevin` call nhan prompt da `redactPiiText`/`minimizePrompt` (`safePrompt`) + `piiMap` cho async deanonymize. | grep toan bo callsites; test guard route-level |
| M8 | MED | Quota RPC loi -> request uncounted di qua | confirmed | `takeAiQuota` fail CLOSED (error/exception -> false). | code + comment |
| M9 | MED | record_usage cho anonymous audit insert | confirmed | RPC `p_actor` bat buoc, `null -> return` som. | prod signature verified |
| M10 | MED | Admin bi scope helpers chan | confirmed | `scn_profile_in_scope`/`scn_org_in_scope` them `my_role()='admin' or`; cac helper `scn_my_scope_*` da co nhanh admin san. | prod def verified |
| M11 | MED | `skipped` (thieu RESEND_API_KEY) khong retry duoc | confirmed | requeue mo rong: `skipped` + `failed` con han attempts -> `queued`. | prod def verified |
| M12 | MED | Tuan truoc that bai bi bo sot | confirmed | requeue khong con filter week (`p_week_start` dropped); claim von da all-weeks; deliveries ghi `j.week_start` cua tung row (truoc day ghi nham week hien tai). | prod signature verified |
| M13 | MED | `phase=all` nuot loi send-phase thanh 200 | confirmed | Outer response propagate `sendRes.status` khi !ok. | code |
| M14 | MED | Send deadline bo qua thoi gian enqueue | confirmed | 1 `deadlineAt` tuyet doi tu dau invocation; enqueue loop break khi con <30s; sendPhase nhan deadline nay. | code |
| M15 | MED | PII dinh dang co separator sot | confirmed | `RE_PHONE`/`RE_CCCD`/`RE_CMND` cho phep `[\s.\-]?` giua cum so + `+84` prefix. | tests: `090 123 4567`, `+84 90 123 4567`, `0123 4567 8901`, `123.456.789` |
| M16 | MED | Ma HS so (9/12 chu so) bi redact trung [so_dinh_danh] | confirmed | Alias `HSxxx`/`GVxx` thay code/ten trong prompt: comments, daily-report, class-analysis, attendance-insight; deanonymize sau output. | test `minimizePrompt` khong ra `[so_dinh_danh]` |
| M17 | MED | Alias substring (GV10 an GV100) | confirmed | `deanonymizeNames` boundary regex `(?<![A-Za-z0-9])alias(?![A-Za-z0-9])` + longest-first. | tests: GV10-only khong dong vao GV100; ca hai map dung |
| M18 | MED | Async Devin mat alias map | confirmed | `ai_jobs.pii_map` jsonb; `fallbackToDevin` persist; `devin-callback` `deanonymizeNames` truoc khi luu result. | prod col verified; callback code |
| M19 | MED | TT22 "final" chi can 1 DDGtx | confirmed | `semesterAssessment(rows, {requiredTx})` - san 2; `requiredTxCount(weeklyPeriods)` theo TT22 D9.2 (<=2t:2, <=4t:3, >4t:4); `subjects.weekly_periods` smallint; hoc-ba truyen requiredTx. | migration applied; hoc-ba render `*` tam tinh theo rule moi |

## Sua kem theo (trong qua trinh fix)

- `hashtextextended(text)` khong ton tai tren PG prod -> `hashtextextended(text, 0)` (seed bat buoc PG14+).
- r2-regression drift (khong lien quan findings): dept-brief da chuyen RPC aggregate (r2 #32) -> R7-02/R8-01 cap nhat assert; parent portal merge chained query (8ba30dc) -> R13-02 cap nhat; grades-editor `saveErr.message` tach khoi setError (R9-03).
- `weekly_periods` migration tach file `20261126` (checker bat 1 file/date).

## Gates

- `npm run typecheck` PASS; `npm run lint` 0 errors; `npm run build` PASS
- `node --test tests/cr049-pii.test.mjs` 17/17; `tests/r2-regression.test.mjs` 140/140
- `node scripts/check-consistency.mjs` PASS
- Prod verification: RPC signatures, EXECUTE grants, OTHER_YEAR_PRESERVED, STALE_OK

## Residual (documented, khong phai finding con mo)

- Email duplicate: cua so con lai giua provider-accept va deliveries-insert
  (~ms) khong the dong neu provider khong co idempotency key - mitigate bang
  deliveries-first + reconcile + pre-send check.
- `ai_jobs.pii_map` luu mapping ten<->alias trong DB noi bo (can thiet cho
  async deanonymize; khong gui ra provider).

## Codex r6 (review tiep theo, commit b877b8e) - ket qua giua chung

Task bi gioi han usage giua chung, nhung 2 provisional findings da duoc
doc lap verify + fix ngay (commit `74a5e86`):

| Finding | Verify | Fix |
|---------|--------|-----|
| `scn_save_grades` con 3 overloads - editor gui 5 named params bind vao ban 5-param KHONG co advisory lock / year-scope (H4/H5 bi bypass tren chinh duong app dung) | prod `pg_proc`: 3 sigs ton tai; editor chi gui 5 params | `drop function` ca 2 overload cu; chi con 6-param; `CHECK:5ARG_BIND_OK` |
| Nguong DDGtx lech van ban TT22 | TT22/2021 D9.2 tinh theo TIET/NAM: <=35t->2, >35-70t->3, >70t->4 (= tiet/tuan <=1->2, =2->3, >=3->4 voi nam 35 tuan) | `requiredTxCount` sua thanh <=1->2, <=2->3, >2->4; comment col `weekly_periods` cap nhat |

## Next

- Round review tiep theo tren `74a5e86` sau khi Codex reset quota.

## Codex r6 (commit bedef17) - VERDICT: NOT-CLEAN, 10 findings (5H/5M)

Raw report: `docs/reviews/codex-cloud-report-cr049-r6-raw.txt`.
Codex xac nhan 14/19 fix r5 dung + ca 2 interim fixes (overloads, TT22 tiers).
Tat ca 10 findings deu source-confirmed -> fix het, khong finding nao
deferred hay not-confirmed.

| # | Sev | Finding | Fix | Verify |
|---|-----|---------|-----|--------|
| 1 | H | A-03 TTS tra phi van chay khi `quotaOk=false` | Gate TTS theo `quotaOk` trong studio generate route - budget block -> doc rule-based khong audio | source |
| 2 | H | Xoa het diem lam mat revision CAS (`v_max=NULL`) | Bang `grade_book_state` (scope_key -> last_saved_at) upsert trong cung advisory lock, ke ca luu rong; CAS check `greatest(max(updated_at), state)`; `clock_timestamp()` cho cung-tx ordering | `RESULT stale_blocked=t restored_rows=0` (rollback) |
| 3 | H | Unique key `grades` thieu `academic_year_id` -> luu diem nam moi vi pham | Drop constraint cu, unique INDEX co `coalesce(academic_year_id, zero-uuid)` - rows legacy NULL giu uniqueness | `same_year_dup_blocked=t cross_year_ok=t` |
| 4 | H | Editor doc lan diem cac nam hoc | `classes` select them `academic_year_id`; query grades loc `(NULL or = class year)` - cung scope voi RPC | source + typecheck |
| 5 | H | counseling-summary/incident-report gui ten HS trong free-text ra AI | Fetch ten HS active cua truong, truyen `pii.names` (alias HSxxx) vao `respondWithAi` - pseudonymize truoc provider + Devin | source + tests |
| 6 | M | alreadySent lookup bo qua error -> co the gui trung | `sentLookErr` -> 500, giu row 'sending' cho run sau | source |
| 7 | M | requeue RPC loi nhung route tra 200 `done:true` | `requeueErr` -> 500 de scheduler retry | source |
| 8 | M | Deadline khong bound sub-batch va email transport | `sendEmail` nhan `timeoutMs` (AbortSignal.timeout); break sub-batch khi `left < 3s`, truyen `leftMs-1s` cho transport | source |
| 9 | M | Enqueue starvation qua 20k PH (cursor reset moi run) | RPC `scn_digest_pending_parents(week, after, limit)` loc san outbox + deliveries 'sent', keyset `p_after` -> resume duoc qua nguong | RPC applied + grant service_role |
| 10 | M | daily-report coi loi nguon la du lieu rong | Check `stuErr`/`attRes`/`conductRes`/`incRes` -> 500 truoc AI call | source |

### Gates r6

- `npx tsc --noEmit` PASS; `npm run lint` 0 errors (136 warnings pre-existing)
- `npm run build` PASS; `node scripts/check-consistency.mjs` PASS
- Tests: 157 pass / 0 fail (PII suite 17/17)
- Migration `20261127_cr049_r6_fixes.sql` applied + verified prod

## Codex r7 (commit 8526448) - VERDICT: NOT-CLEAN, 11 findings (4H/7M)

Raw report: `docs/reviews/codex-cloud-report-cr049-r7-raw.txt`.
Codex xac nhan 6/10 fix r6 hoan chinh; 4 fix con thieu (2, 5, 8, 9) +
phat hien regression do chinh fix r6 gay ra. Tat ca 11 findings
source-confirmed -> fix het.

| # | Sev | Finding | Fix | Verify |
|---|-----|---------|-----|--------|
| 1 | H | CAS bat doi xung: grades dung `now()`, state dung `clock_timestamp()` -> reload la stale vinh vien (regression tu r6) | Client doc `grade_book_state.last_saved_at` + merge vao `expectedMax`; RPC giu `clock_timestamp()`; them class vao scope | `reload_save_ok=t stale_blocked=t` |
| 2 | M | 2 lop cung mon/nam share 1 CAS revision | `scope_key` them `class_id`; validate `mixed_class_scope` | prod |
| 3 | H | `grade_book_state` staff ghi truc tiep -> bypass CAS | Policy -> select-only; `scn_save_grades` -> security definer + authz `scn_can_write_grade` cho p_student_ids LAN p_rows | `denied=t` |
| 4 | H | PII lookup loi/truncated/case khong an toan | `fetchAllRows` + fail-closed 500; `pseudonymizeNames` case-insensitive + Unicode boundary + whitespace linh hoat | tests 17/17 |
| 5 | H | warning-advice + advisor gui ten trong free-text | Roster truong -> `minimizePrompt` cho ca provider lan Devin; `deanonymizeNames` khi tra ket qua | source |
| 6 | M | AI grade analysis cong diem 2 nam | Filter `(NULL or = class year)` trong class-analysis + comments | source |
| 7 | M | pending-RPC starvation: PH khong con / qua attempts | RPC loai `parent_students` thieu + `attempts >= p_max` (4-param) | prod |
| 8 | M | `?retry=` khong revive outbox failed | RPC `scn_digest_retry_failed(week, parent_ids)` flip failed/skipped -> queued, bao ve 'sent' | prod |
| 9 | M | Email config lookup ngoai timeout | `Promise.race` config vs budget; transport dung `leftMs` | source |
| 10 | M | advisor nuot loi nguon -> tra so lieu ao | 8 nguon check error -> 500 truoc AI call | source |
| 11 | M | alreadySent lookup khong week-filter/paginate | `fetchAllRows` + `.in(week_start)` theo batch + truncated fail | source |

### Gates r7

- `npx tsc --noEmit` PASS; `npm run lint` 0 errors; `npm run build` PASS
- Tests 157 pass / 0 fail; `check-consistency` PASS
- Migration `20261128_cr049_r7_fixes.sql` applied; CAS smoke tren prod
  qua JWT claims: `denied=t reload_save_ok=t stale_blocked=t`
- Playwright prod: login + grades + /dept denial OK

---

## Round 8 - Codex Cloud on c76e4d0 (2026-11-29)

Raw report: `docs/reviews/codex-cloud-report-cr049-r8-raw.txt`
Verdict: **NOT-CLEAN - 12 findings (5 HIGH / 7 MEDIUM)**

| # | Sev | Finding | Triage / Fix | Evidence |
|---|-----|---------|--------------|----------|
| 1 | H | `p_student_ids: NULL` bypass authz (unnest(NULL)=0 rows, 3-valued NULL membership) | **Fixed** - reject NULL/empty/null-element arrays; authz + payload membership yeu cau `IS TRUE` | prod `null_ids_denied=t` |
| 2 | H | Grades + state doc rieng -> snapshot R1 + revision R2 -> CAS bi vo hieu | **Fixed** - bracket read: doc state truoc+sau fetch, retry toi da 3 lan khi state doi | test guard |
| 3 | H | advisor bo loi lookup classes/students dau vao -> roster rong (ten that qua) + so lieu ao | **Fixed** - fail-closed 500 + `fetchAllRows` paginate | source |
| 4 | H | daily-digest / period-log-summary / suggest-tasks gui free-text chua ten HS | **Fixed** - helper `schoolPiiNames` (roster fail-closed); `pii.names` cho respondWithAi; `minimizePrompt` + deanon cho suggest-tasks | test guard |
| 5 | H | Ten NFD (canonical-equivalent) lo pseudonymize | **Fixed** - `normalize("NFC")` ca text lan roster names | 2 unit tests |
| 6 | M | advisor/warning Devin jobs thieu `piiMap` -> callback tra alias HS001 cho user | **Fixed** - truyen `piiMap` vao `fallbackToDevin` (ca suggest-tasks) | test guard |
| 7 | M | `leftMs` per-recipient -> tong thoi gian vuot budget | **Fixed** - `deadline` tuyet doi, moi recipient lay phan con lai, break khi het | test guard |
| 8 | M | config timeout `throw` -> Promise.all reject -> rows ket 'sending' | **Fixed** - tra structured `{sent:0, failed:n, error}` | test guard |
| 9 | M | Email `''`/khoang trang chiem scan slot 20k | **Fixed** - RPC loai `nullif(btrim(email),'')` | prod + test guard |
| 10 | M | `?retry=` goi RPC voi weekStart hien tai | **Fixed** - select `week_start`, group theo tung tuan, requeue dung cap (parent, week) | test guard |
| 11 | M | Radar tron diem cac nam hoc | **Fixed** - select `academic_year_id`, filter `(NULL or = class year)` truoc `lowGradeStudentIds` | test guard |
| 12 | M | weekStart tinh theo host TZ + format VN -> sai tuan quanh nua dem | **Fixed** - anchor ngay VN vao UTC-midnight, `getUTCDay()` | test guard |

### Gates r8

- typecheck: PASS | lint: 0 errors (136 warnings) | tests: 168/168
- build: PASS | check-consistency: PASS
- prod verify: `null_ids_denied=t` (NULL-array exploit bi chan)
- migration: `20261129_cr049_r8_fixes.sql` (r7 file revert - append-only)

---

## Round 9 - Codex Cloud on 4438792 (2026-11-30)

Raw report: `docs/reviews/codex-cloud-report-cr049-r9-raw.txt`
Verdict: **NOT-CLEAN - 15 findings (10 HIGH / 5 MEDIUM) + 1 retained risk**

| # | Sev | Finding | Triage / Fix | Evidence |
|---|-----|---------|--------------|----------|
| 1 | H | Refresh props dua revision R2 trong khi cells van R1 -> CAS bi bypass | **Fixed** - `baseRevisionRef` chot revision cung snapshot cells luc mount; props refresh khong doi revision | source + test guard |
| 2 | M | Bracket loader nuot loi state-read (null==null gia "on dinh") va mo editor sau 3 lan unstable | **Fixed** - s0/s1 error -> loadError; het retry -> `revision_unstable` -> khoa editor | source + test guard |
| 3 | M | CAS tuy chon - goi RPC khong `p_expected_max` bo qua stale detection; direct UPDATE/DELETE khong bump state | **Fixed** - RPC raise `expected_revision_required` khi NULL; trigger `scn_grades_state_touch` bump `grade_book_state` moi INSERT/UPDATE/DELETE | prod `prosrc` + trigger verified |
| 4 | H | Khong kiem tenant subject/year - BGH/GVCN branch authz theo lop, definer nhan `p_academic_year_id` bat ky | **Fixed** - RPC kiem `subjects.school_id = class.school_id` + `year_scope_mismatch` | prod verified |
| 5 | H | Retry insert trung unique index (parent_id, week_start) -> 23505, batch audit bi abort | **Fixed** - unique index -> real UNIQUE constraint; insert -> `upsert(onConflict:"parent_id,week_start")` | prod constraint verified |
| 6 | M | Provider accept roi crash truoc khi ghi log -> stale recovery resend | **Deferred (documented)** - Resend khong ho tro idempotency key; deliveries-ghi-truoc-outbox thu hep cua so crash con ~ms; reconcile qua provider message_id la phase tiep theo | retained risk |
| 7 | M | `?retry=` van chay enqueue scan tuan hien tai -> tao delivery tuan moi nham | **Fixed** - retry mode chi drain outbox requeue, bo qua enqueue scan | test guard |
| 8 | M | 12 duong doc grades tron nam hoc | **Fixed** - helper `src/lib/grades-year.ts` (`gradeYearOr`/`gradeInYear`); 12 paths scoped: dashboard, analysis, support, exam-analytics, records report/students, parents portal, portal parent/student, register export, class-report-export, digest | sweep test guard |
| 9 | H | draft-message / meeting-notes / lesson-plan / studio generate van gui ten HS thuc | **Fixed** - roster `schoolPiiNames` + minimize cho provider + `piiMap` Devin + deanon output | source + test guard |
| 10 | H | Roster helper chi lay lop/HS active -> ten HS chuyen/nghi khong bi alias; class query khong paginate | **Fixed** - lay tat ca lop/HS (ke ca inactive), `fetchAllRows` ca hai tang, chunk `.in()` 200 | source |
| 11 | H | JSON.stringify facts truoc khi pseudonymize -> `Nguyễn\nVăn` escaped khong match regex | **Fixed** - `minimizeDeep` pseudonymize gia tri string TRUOC serialize; ap dung cho cac route JSON-facts | source + test guard |
| 12 | H | Studio extract: anh/PDF bytes di thang toi provider, bypass moi redaction | **Fixed (gate)** - binary upload yeu cau `confirm_no_pii` + `audit_logs(studio.extract_raw_doc)`; text path pseudonymize roster + piiMap + deanon; DPIA muc 3b | test guard |
| 13 | H | Redactor thieu pattern ma dinh danh HS 10 so | **Fixed** - regex bo sung 10-digit | unit test |
| 14 | M | `Math.max(1000, timeoutMs)` phong to budget caller; config timer khong clear | **Fixed** - ton trong budget chinh xac, `clearTimeout` khi config race settle | source |
| 15 | M | Dedup suggest-tasks chay tren alias (HS001) truoc deanon -> trung khong phat hien | **Fixed** - deanonymize titles truoc khi dedup | source |
| R | H | extract-records `allowRawPrompt` - rui ro DPIA da ghi nhan (muc 3a), cho ruling phap ly | **Retained** - khong thay doi; gate phap ly/consent/DPA la dieu kien pilot | DPIA-v1 muc 3a |

### Gates r9

- `npx tsc --noEmit` PASS | lint 0 errors (136 warnings) | tests 170/170 (30 PII + 140 regression)
- `npm run build` PASS | `check-consistency` PASS
- prod verified: `scn_save_grades` co `expected_revision_required` + tenant check;
  trigger `scn_grades_state_touch` tren grades; UNIQUE constraint
  `digest_deliveries_parent_week` (contype='u'); CAS smoke `fresh_save=t stale_blocked=t`
- migration: `20261130_cr049_r9_fixes.sql` (r9 deltas tach khoi r8 file - append-only)

---

## Round 10 - Codex Cloud on 9d58945 (2026-12-01)

Raw report: `docs/reviews/codex-cloud-report-cr049-r10-raw.txt`
Verdict: **NOT-CLEAN - 16 findings (11 HIGH / 5 MEDIUM)**

| # | Sev | Finding | Triage / Fix | Evidence |
|---|-----|---------|--------------|----------|
| 1 | H | GV chuyen truong van ghi diem lop cu - leaf helpers khong bind truong HIEN TAI | **Fixed** - `scn_student_in_my_homeroom` + `scn_i_teach_student_subject` (ca teaching + substitute branch) them `c.school_id = my_school_id()` | prod funcdef verified |
| 2 | H | Direct INSERT/UPDATE policies bypass subject/year tenant check cua RPC | **Fixed** - drop `grades_staff_ins/upd/del` + revoke table grants; `scn_save_grades` la write path duy nhat | prod policies + ACL verified |
| 3 | H | Direct write race qua CAS (khong advisory lock) | **Fixed** - cung giai phap #2: khong con writer thu hai | prod verified |
| 4 | H | Trigger `scn_grades_touch_state` chi invalidate NEW scope khi UPDATE doi khoa | **Fixed** - bump ca OLD scope khi student/subject/term/year doi; deterministic order (scope nho truoc) tranh deadlock | prod funcdef verified |
| 5 | H | Editor khong gui expected year - lop doi nam sau mount van nhan save | **Fixed** - `classYearId` chot luc mount; RPC kiem `p_academic_year_id is distinct from v_year` (ca NULL<->non-NULL) | prod funcdef + test guard |
| 6 | H | Roster bi active-only filter + campus RLS lam thieu nhung van "thanh cong" | **Fixed** - `schoolPiiNames` chuyen sang admin client, moi lop/HS ke ca inactive, fail-closed moi nguon | test guard |
| 7 | H | Roster thieu ten GV + PH - free text nhac ten ho khong bi alias | **Fixed** - roster gom profiles (GV) + parents (PH) cung truong | test guard |
| 8 | H | Serialize-truoc-minimize con sot: daily-report facts + tvc input + generic tools | **Fixed** - `minimizeDeep` tren facts/input TRUOC JSON.stringify | source + test guard |
| 9 | H | comments tin `name` caller gui (rong/sai -> NLPC text lo ten that) | **Fixed** - pseudonymize NLPC bang roster server-side; alias K### cho ma HS | source |
| 10 | H | gen-questions gui free-text topic khong minimize | **Fixed** - roster `schoolPiiNames` + `pii.names`, fail-closed | source |
| 11 | H | Studio deanon truoc TTS -> TTS provider nhan ten HS that | **Fixed** - `extractDialogueTurns(aiDocRaw)` (doc con alias); deanon chi cho response user | test guard |
| 12 | M | Save thanh cong lam editor cu stale vinh vien (baseRevision khong cap nhat) | **Fixed** - sau save doc lai `grade_book_state` va cap nhat `baseRevisionRef` | source |
| 13 | M | hoc-ba: lop NULL-year -> OR tautology = diem moi nam hoc | **Fixed** - NULL-year chi rows legacy `academic_year_id.is.null` | test guard |
| 14 | M | Deanon tren chuoi JSON tho pha cau truc khi ten chua ky tu dac biet | **Fixed** - `deanonymizeDeep` parse-then-restore; ap dung ai-route, comments, studio, devin-callback | test guard |
| 15 | M | `?retry=` drain ca outbox rows khong lien quan | **Fixed** - `scn_digest_outbox_claim(int, uuid[])` loc `p_parent_ids`; retry truyen retry set | prod funcdef + test guard |
| 16 | M | Raw-doc gate dua vao audit fire-and-forget - co the gui bytes khi chua ghi bang chung | **Fixed** - `writeAudit` awaited tra error; audit fail -> 500, khong goi provider | test guard |

### Gates r10

- `npx tsc --noEmit` PASS | lint 0 errors (136 warnings) | tests 179/179 (39 PII + 140 regression)
- `npm run build` PASS | `check-consistency` PASS
- prod verified: `strict_year_check=t homeroom_bound=t teach_bound=t det_order=t`;
  `direct_revoked=t` (authenticated khong con INSERT/UPDATE/DELETE tren grades);
  `scn_digest_outbox_claim(int,uuid[])` dung signature; policies chi con read
- migration: `20261201_cr049_r10_fixes.sql`

---

## Round 11 - reviewer-gpt (cross-model fallback) on 02231f0 (2026-12-01)

Channel note: Codex Cloud het usage limit giua r11 (reset 10:52 PM);
OpenRouter + OpenAI + Anthropic + Gemini API keys deu het credits ->
fallback tier-3 pinned reviewer-gpt tren checkout that.
Raw report: `docs/reviews/openrouter-review-r11.md`
Verdict: **NOT-CLEAN - 7 findings (5 HIGH / 1 MEDIUM / 1 LOW)**

| # | Sev | Finding | Triage / Fix | Evidence |
|---|-----|---------|--------------|----------|
| 1 | H | Cac leaf helper CON LAI van thieu bind truong hien tai (`scn_is_my_ttentry`, `scn_is_sub_ttentry_date`, `scn_student_in_my_teaching`, homeroom branch cua `scn_sync_period_attendance`) - GV chuyen truong van sync attendance/ghi conduct lop cu | **Fixed** - 4 helpers them `c.school_id = my_school_id()` | prod funcdef verified |
| 2 | H | Post-save reconciliation race: editor doc grade_book_state SAU commit, GV khac save xen giua -> ref=R2 voi cells=R1 -> CAS bypass | **Fixed** - `scn_save_grades` returns timestamptz (revision ghi trong cung transaction duoi advisory lock); editor dung return value, khong doc lai state | prod `prorettype=timestamptz` verified |
| 3 | H | extract-records `allowRawPrompt` gui PII tho khong consent, khong audit durable | **Fixed** - gate `confirm_raw_pii` + `await writeAudit(ai.extract_records_raw_pii)` fail-closed; UI checkbox explicit consent | test guard |
| 4 | H | comments serialize NLPC truoc redact - sdt co \n song sot qua JSON escape | **Fixed** - `JSON.stringify(minimizeDeep(payload, allNames))`; reviewer reproduce duoc ca truoc lan sau fix | test guard |
| 5 | H | `classYearId` prop co the doi sau refresh trong khi cells van cu -> cells nam cu ghi vao nam moi | **Fixed** - `classYearIdRef` chot luc mount + key gom year de remount snapshot khi year doi | test guard |
| 6 | M | `phase=send&retry=` return som truoc khi resolve retryParents -> claim khong loc | **Fixed** - dispatch send sau retry resolution, truyen retry set | test guard |
| 7 | L | deanon boundary chi ASCII - `éHS001é` bi replace sai | **Fixed** - boundary Unicode `\p{L}\p{N}` dong nhat pseudonymizeNames | test guard |

### Gates r11

- `npx tsc --noEmit` PASS | lint 0 errors | tests 185/185 (45 PII + 140 regression)
- `check-consistency` PASS | `npm run build` PASS
- prod verified: 4 helpers bound (funcdef), `scn_save_grades` returns timestamptz,
  grants chi authenticated+service_role (anon/public revoked)
- migration: `20261202_cr049_r11_fixes.sql`

---

## Round 12 - reviewer-claude (cross-model fallback) on a7401ae (2026-12-02)

Channel note: Codex Cloud quota reset ~22:52; loop tiep tuc qua pinned
reviewer-claude (model family thu 3, khac implementer lan reviewer-gpt).
Verdict: **NOT-CLEAN - 3 findings (3 HIGH)**

| # | Sev | Finding | Triage / Fix | Evidence |
|---|-----|---------|--------------|----------|
| 1 | H | `scn_is_my_homeroom_class` (cr013) thieu bind truong hien tai - ~10 write policies (`students`, `es_*`, `dr_*`, `ew_*`, `seat_*`, `sg_*`, `signoff_*`, `inc_upd`) van cho GV chuyen truong ghi vao lop cu. `signoff_insert` cung loi inline. Sweep them: `digest_deliveries` gvcn read, `cr_upd/cr_del` recorded_by, `inc_upd/inc_del` bgh+recorded_by, `lp_del`, `appt_s_upd/del` gvcn, `nlpc_cmt_upd/del` evaluated_by deu thieu bind | **Fixed** - `20261203_cr049_r12_fixes.sql`: helper bound `c.school_id = my_school_id()`; tat ca policies ke tren duoc recreate voi anchor truong (class/student/parent/school_id); admin giu global | prod `pg_policies` + funcdef verified bound |
| 2 | H | Editor giu students live tu props: HS chuyen vao giua phien khong co cell nhung bi gui trong `p_student_ids` -> RPC xoa sach diem cua HS do | **Fixed** - `students` + `mountStudentIdsRef` chot luc mount (useState lazy init, dong bo voi cells/revision/year) | test guard |
| 3 | H | Full-school roster (admin client, r10 H6) vuot campus scope PHT: (a) deanon full roster cho phep inject alias "HS001..." vao free-text de LLM echo lo ten ngoai pham vi; (b) `ai_jobs.pii_map` luu nguyen roster - BGH/dept doc duoc qua `ai_jobs_staff_read` | **Fixed** - `collectUsedNames`: deanon + pii_map chi gom ten thuc su co trong input caller (prompt tho + payload tho + nguoi caller nhin thay). respondWithAi + 7 custom-flow routes + 3 routes embed alias-facts (`source:`) deu scope lai; 2 parse-callback deanon full-roster thua da go bo | unit tests + guards |

### Gates r12

- `npx tsc --noEmit` PASS | lint 0 errors (136 warnings) | tests 192 pass/1 skip
- `check-consistency` PASS | `npm run build` PASS
- prod verified: `scn_is_my_homeroom_class` + 9 policies da bound
- migration: `20261203_cr049_r12_fixes.sql`

### Residual (documented)

- `ai_jobs.pii_map` cua cac job CU (truoc r12) van chua full roster map -
  khong rewrite retroactive duoc; job moi chi luu usedNames.
- `extract-records` raw-PII path: co gate consent + durable audit (r11).
- Resend accept->crash truoc delivery log: khong co idempotency - documented.

---

## Round 13 (Codex Cloud @ 639959b) - NOT-CLEAN: 7 findings (4H/3M)

| # | Sev | Finding | Triage / Fix | Evidence |
|---|-----|---------|--------------|----------|
| 1 | H | `signoff_insert` nhanh BGH con global (r12 chi bind nhanh gvcn) - BGH truong A insert signoff cho class truong B | **Fixed** - `20261204_cr049_r13_fixes.sql`: admin global rieng, BGH + `scn_class_in_school(class_id)` | prod bound |
| 2 | H | `inc_ins` thieu tenant check doi tuong su co - **drift**: prod da bound nhung KHONG co file migration nao chua ban bound; replay files tren DB moi mo lai lo | **Fixed** - chot ban bound vao file r13 + bo sung `student_id thuoc class_id` khi ca hai co | prod bound truoc, file chot sau |
| 3 | H | `nlpc_upd`/`nlpc_del` tren `competency_evaluations`: `evaluated_by = auth.uid()` + BGH khong bind truong - DELETE khong WHERE xoa danh gia truong khac | **Fixed** - self/BGH + `scn_student_in_school(student_id)`, admin global | prod bound |
| 4 | M | `task_upd`/`task_del` nhanh `created_by = auth.uid()` khong bind truong | **Fixed** - creator + `scn_class_in_school(class_id)` | prod bound |
| 5 | H | `classes_write_ins` BGH insert cho truong khac - **drift** nhu #2: prod da bound (`admin OR school_id = my_school_id()`) nhung khong co file | **Fixed** - chot ban bound vao file r13 | prod bound truoc, file chot sau |
| 6 | M | Studio generate `usedNames` chi tu `input` - DC-06 `ctx.extra.khbdText` / DC-01 template (tu DB) chua ten -> minimizePrompt alias nhung used khong co -> alias leak output | **Fixed** - `collectUsedNames({ input, ctx }, roster.names)` | guard test |
| 7 | M | `report-analysis` gui `stats[].name` raw + JSON.stringify truoc redact - ten + PII newline (`"An - 090\n123\n4567"`) toi provider | **Fixed** - roster fail-closed + `minimizeDeep(stats)` truoc stringify + `pii: {names, source: stats}` | guard test |

### Ghi nhan khong phai finding (Codex "remaining checks")

- RPC `scn_save_grades` khong check `status = 'active'` va khong nhan class ID luc mount - gioi han validation, documented.
- `ai_jobs`/`ai_usage` dung ownership ca nhan khong bind truong - dung thiet ke (per-user data).
- Devin callback restore full map tren job - job CU full-roster la residual da document.
- Sweep SECURITY DEFINER/self-attribution: sach ngoai cac finding tren (da verify them prod-side: `appt_s_upd/del` bound qua `scn_parent_in_school`).

### Gates r13

- `npx tsc --noEmit` PASS | eslint changed-paths 0 errors | tests 194 pass/1 skip
- `check-consistency` PASS (rename r13 -> `20261204` cho unique version) | `npm run build` PASS
- prod verified: 7/7 policies bound (`signoff_insert`, `inc_ins`, `classes_write_ins`, `nlpc_upd/del`, `task_upd/del`)
- migration: `20261204_cr049_r13_fixes.sql`

---

## Round 14 (Codex Cloud @ d6aafe7) - NOT-CLEAN: 7 findings (1H/5M/1L)

| # | Sev | Finding | Triage / Fix | Evidence |
|---|-----|---------|--------------|----------|
| 1 | H | `dept_meetings` `dm_del`/`dm_upd` USING + `dm_ins` nhanh BGH global - BGH truong A xoa/sua/tao bien ban hop to cua truong B (DELETE khong WHERE bo qua SELECT) | **Fixed** - `20261205_cr049_r14_fixes.sql`: admin global rieng, BGH + `scn_dept_in_school(department_id)` ca 3 policy | prod bound |
| 2 | M | `scn_is_dept_head` chi check `p.department_id = did` - profile chuyen truong con FK dept cu van true | **Fixed** - helper + `scn_dept_in_school(did)` | funcdef verified |
| 3 | M | JSON **key** vuot minimize: `minimizeDeep` chi xu ly value; payload co key chua ten/PII (ke ca newline) van serialize tho | **Fixed** - `minimizeDeep` minimize ca key (`out[mk]`); `collectUsedNames` walk ca key vao haystack de deanon restore duoc | guard tests |
| 4 | M | `emulation-summary` gui `period` (chuoi caller) + perClass ten lop/tieu chi raw, khong roster/pii | **Fixed** - roster fail-closed + `minimizeDeep(period/perClass)` + `pii:{names,source}` | guard tests |
| 5 | M | 4 routes stringify truoc minimize (`emulation-summary`, `dept-brief`, `class-analysis`, `assignment-suggest`) - PII ten/SDT co newline bi JSON-escape vuot redact | **Fixed** - tat ca `minimizeDeep(facts)` truoc stringify; dept-brief: dept user school NULL van duoc pattern-redact, co school thi roster fail-closed | guard tests |
| 6 | M | `assignment-suggest` + `suggest-tasks` bo qua query error -> AI chay tren du lieu thieu/rong | **Fixed** - check tung error; class khong ton tai -> 404; nguon loi -> 500 | guard tests |
| 7 | L | `grade_book_state_read` chi `is_staff()` - staff truong A doc revision so diem truong B (metadata leak) | **Fixed** - admin OR (is_staff AND `scn_class_in_school(split_part(scope_key,'|',4))`) | prod bound |

### Gates r14

- `npx tsc --noEmit` PASS | eslint changed-paths clean | tests 197 pass/1 skip
- `check-consistency` PASS | `npm run build` PASS
- prod verified: `scn_is_dept_head` bound + `dm_*` + `grade_book_state_read` bound
- migration: `20261205_cr049_r14_fixes.sql`

---

## Round 15 (Codex Cloud @ d3dee31) - NOT-CLEAN: 5 findings (3M/2L, 0 HIGH)

| # | Sev | Finding | Triage / Fix | Evidence |
|---|-----|---------|--------------|----------|
| 1 | M | `dept-brief`: ten truong la free-text tuy y (`createSchool` chi check non-empty) - "THCS - Nguyen Van An" gui nguyen toi provider khi dept user khong co roster | **Fixed** - alias moi truong thanh `TRxx` (self-contained) + merge roster khi caller co school | guard tests |
| 2 | M | `class-analysis`/`attendance-insight`/`assignment-suggest`: map minimize chi gom HS lop / GV query - ten lop/mon la chuoi DB tuy y co the chua ten nguoi ngoai map | **Fixed** - `mergePiiNames`: minimize theo `schoolPiiNames` day du, alias nghiep vu giu nguyen, roster doi prefix `R*` tranh trung alias | guard tests |
| 3 | M | `period-log-summary` bo loi query subjects (moi mon thanh "-"); `warning-advice` bo loi lookup lop | **Fixed** - check `subjErr`/`clsErr` -> 500; class_id null hop le, query loi fail-closed | guard tests |
| 4 | L | `minimizeDeep` doi ca key schema (`lesson`) - roster co nhan vien ten "Lesson" (case-insensitive) thi builder mat `input.lesson` | **Fixed** - `preserveKeys` (tool.fields + coDraftFields + control keys) giu key schema o depth 0; key tuy y van minimize | guard tests |
| 5 | L | `daily-digest` bao "chua nop" khi query lop/bao cao loi | **Fixed** - check `clsErr`/`repErr` -> 500 | guard tests |

### Gates r15

- `npx tsc --noEmit` PASS | eslint changed-paths clean | tests 201 pass/1 skip
- `check-consistency` PASS | `npm run build` PASS
- Khong co migration moi trong r15 (thuan code fixes)

---

## Round 16 (Codex Cloud @ 17a73c1) - NOT-CLEAN: 9 findings (0H/5M/4L)

Raw report: `docs/reviews/codex-r16-report.txt`

| # | Sev | Finding | Triage / Fix | Evidence |
|---|-----|---------|--------------|----------|
| 1 | M | Studio extract: mo ta YCCD free-text (DB, `saveStandard` khong gioi han noi dung) ghep vao prompt - nhanh inline khong load roster; nhanh docx minimize nhung `stdList` khong nam trong `usedNames` nen alias tu nguon DB khong restore | **Fixed** - roster fail-closed cho CA HAI nhanh; `minimizePrompt(promptFull)` bao phu stdList; `usedNames = collectUsedNames({text, stdList})` | guard tests |
| 2 | M | Studio: lookup subject/standards/template/material loi -> null/[]/default roi AI van sinh tren yeu cau thieu | **Fixed** - moi lookup duoc yeu cau check `error` -> 500 truoc provider/fallback (subject, standards x2, khbd_template, material refill) | guard tests |
| 3 | M | `deanonymizeNames` nhieu luot: ten vua restore chua alias nguoi khac ("THCS TR02" -> TR01 -> "THCS THCS Nguyen Du") | **Fixed** - single-pass: 1 regex tong hop `parts.join("\|")` + callback map, khong rescan replacement | unit test r16 |
| 4 | L | Prefix `R` khong bao ve alias: nhan vien ten "RHS001" hop le -> alias moi sinh bi minimize lai thanh alias khac | **Fixed** - sentinel-bracket namespace `⟦X###⟧` (HS/GV/PH/K/TR/R-prefixed); `pseudonymizeNames` lookbehind/lookahead loai `⟦⟧` nen alias da sinh khong bi quet lai; ten that "RHS001" van duoc alias binh thuong | unit test r16 |
| 5 | L | Token alias trung code that trong text bi restore nham ("ma HS001" -> ten HS) | **Fixed** - deanon chi match dang CO NGOAC `⟦X###⟧` cho alias moi; alias legacy khong ngoac (pii_map job cu) van restore voi boundary Unicode; model bo ngoac -> alias sot (benign, documented) | unit test r16 |
| 6 | M | `radar-sync`: `existing ?? []` sau loi dedupe lookup -> moi candidate coi nhu moi -> insert trung | **Fixed** - check `dedupeErr`: log + `errors.push` + `continue` truoc mutation | code review |
| 7 | M | `pack=full`: insert de du phong / exam_questions bo loi -> tra doc "thanh cong" khi ban DB khong ton tai | **Fixed** - check ca 2 mutation; exam_questions loi -> rollback de + 500; exam loi -> 500 | code review |
| 8 | L | `period-log-summary` (timetable/logs), `studio/context` (6 nhanh), `materials/[id]/export` (author) bien loi query thanh response nghiep vu thanh cong | **Fixed** - `srcFail(label, err)` -> 500 cho context route; period-log check `entErr`/`logErr`; export check `authorErr` | code review |
| 9 | L | `warning-advice`: ca nhanh rule-based lan AI bo `.update()` result -> tra suggestion khi chua luu | **Fixed** - `.update().select("id")` + verify row -> 500 khi khong luu duoc | code review |

### Alias scheme redesign (findings 3/4/5 gop lai)

- Alias moi: `⟦HS###⟧`/`⟦GV##⟧`/`⟦PH###⟧`/`⟦K###⟧`/`⟦TR##⟧`/`⟦RX###⟧` (mergePiiNames nhung R vao trong ngoac: `⟦RHS001⟧`).
- `pseudonymizeNames`: single-pass, lookbehind `(?<![\p{L}\p{N}⟦])` + lookahead `(?![\p{L}\p{N}⟧])` - alias vua sinh khong bi minimize lai (finding 4), ten that van alias binh thuong.
- `deanonymizeNames`: single-pass alternation; bracketed chi match `⟦X###⟧` nguyen ven (finding 5 - bare code that khong bi restore); legacy bare alias (pii_map job cu) van match voi boundary (backward compat); restored name khong bi rescan (finding 3).
- Alias construction sites updated: `ai-pii-roster`, `comments` (K###), `class-analysis`, `assignment-suggest`, `attendance-insight`, `dept-brief` (TR##).
- Residual documented: model bo ngoac `⟦⟧` khi echo -> alias `HS001` sot trong output (khong leak ten, chi formatting wart).

### Gates r16

- `npx tsc --noEmit` PASS | eslint 0 errors | tests 202 pass/1 skip
- `check-consistency` PASS | `npm run build` PASS
- Khong co migration moi trong r16 (thuan code fixes)
