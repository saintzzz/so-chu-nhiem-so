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
