# External Review r27 — Codex Cloud

- Commit review: `3a5d2b6` (r26 remediation + r26 raw report artifact)
- Verdict: **NOT-CLEAN — 8 findings (2H/6M)**: 5 defect class MOI + 3 lo hong
  con sot trong cac class da biet.
- Raw report: `docs/reviews/codex-r27-report.txt`.
- Codex tu validate: reliability gate PASS 4/4, regression 144/144, PII
  76/76 - tuc la cac class r24-r26 da dong dung; round nay di sau hon vao
  invariant lien-bang va transaction boundary.

## Triage + remediation class-level

| # | Sev | Finding | Fix | Vi tri |
|---|-----|---------|-----|--------|
| 1 | M | UPDATE `activities.class_id` sau announce pha invariant bang con (attendance vi pham pair-check, email snapshot sai lop) | `scn_activity_transition_guard` chan doi `class_id` khi da co `activity_attendance`/`activity_announcements` | migration `20261211_cr049_r27_fixes.sql` |
| 2 | M | `fetchAllRowsIn` chunk khong co snapshot - row doi nhom giua 2 chunk bi bo sot/trung | **Deferred with design** (RPC single-snapshot hoac revision-bracket cho listing correctness-critical; low-stakes listing chap nhan) | `docs/project/CR-049-deferred-sweep.md` |
| 3 | M | Response reply cu ve cham xoa draft moi (ca chuyen conversation lan go them) | Snapshot draft luc gui; chi reset khi `prev === sentDraft` (inbox) / `replyTo+draft` khop (portal) | `inbox-client.tsx`, `parent-actions.tsx` |
| 4 | M | Claim email bi bo lai (lookup/worker fail) nhung UI bao "dang gui" 5 phut | `releaseClaim` = `email_complete(done=false)` tren moi duong thoat that bai sau khi giu token | `activities/actions.ts` |
| 5 | M | Client INSERT notification type he thong + link ngoai -> phishing | `notif_ins` WITH CHECK: `link` chi noi bo (`^/`, chan `^//`) + PH/HS chi `type in (appointment,message)`; client `router.push` chi route noi bo | migration + `notifications-client.tsx` |
| 6 | H | Guard chi BEFORE UPDATE: `act_ins` cho INSERT `status='approved'`; `dr_upd` sua content submitted; DELETE+INSERT vong guard | Trigger chay `BEFORE INSERT OR UPDATE` (INSERT approved can bgh/pht/admin); `daily_reports` thu het write policy -> chi `scn_save_daily_report` | migration |
| 7 | H | Tenant hole ngoai sweep r26: `pl_owner_upd/del` nhanh BGH khong bind truong; `scn_save_daily_report` `c.gvcn_id=actor` khong kiem truong hien tai; `acl_write` khong kiem tenant cua `user_id`, `scn_item_denied` khong loc school | `pl_owner_*` BGH can `scn_ttentry_in_school`; RPC authz them `c.school_id=actor school` + role gvcn; `acl_write` can `scn_profile_in_school(user_id)` + `scn_item_denied` loc `a.school_id` | migration |
| 8 | M | `scn_incident_followup` `p_expected` default null -> caller bo CAS | Lock `FOR UPDATE` + transition bat `p_expected = status hien tai`; note-only (status giu nguyen) khong can CAS | migration |

## Verify live (prod DB sau apply migration)

- gvcn INSERT activity `status='approved'` -> **DENIED** (`approve requires bgh/pht`); INSERT draft OK.
- direct `daily_reports` insert/update -> **DENIED** (khong con write policy); `scn_save_daily_report` RPC -> `saved`.
- notification `link='https://evil.example'` -> **DENIED**; internal link `/dashboard` OK.

## Residual con lai (ghi nhan ro)

- **F2** chunk-snapshot: deferred, can RPC/revision design - ghi trong
  `CR-049-deferred-sweep.md`.
- **F5** phan con lai: staff van gia duoc notification "type he thong"
  cho staff cung truong (link da bi gioi han noi bo, khong phishing duoc).
  Fix day du can provenance column + RPC-only cho system types.
- Deferred r26 giu nguyen: provider-send thanh cong nhung complete fail ->
  retry co the gui trung (can delivery outbox).

## Scanner/infra

- Them exemption `// discarded-ok:` cho callee tu xu ly loi ben trong
  (vd `releaseClaim` log loi rpc thay vi tra result) - tuong duong
  `bounded-ok`/`cas-ok`, co fixture trong `good.ts`.
- Regression guards moi: 7 test trong `r2-regression.test.mjs`
  (INSERT guard, RPC-only daily_reports, tenant bind, incident CAS,
  claim release, draft race, internal link).
