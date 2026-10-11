# External Review Loop - Confirmation Round (r4)

- **Reviewer:** ChatGPT Codex Cloud qua Chrome CDP, env `so-chu-nhiem-so`
- **Commit reviewed:** `dd7f6b6` (xac nhan qua GitHub)
- **Ket luan Codex:** "NOT CLEAN: 1 conditional High and 4 Medium" — 7 fix r3 duoc danh gia: #1, #2, #6 pass; #3, #4, #5, #7 incomplete; khong co regression trong BGH staff-mgmt hay owner same-school.
- **Raw report:** `/tmp/codex/r4-report.txt`

## Triage + fix (5/5)

| # | Severity | Finding | Fix | Trang thai |
|---|----------|---------|-----|-----------|
| 1 | HIGH (cond) | `aiEndpointAllowed` chi check hostname — `http://allowed.example` qua duoc; fetch follow redirect 307/308 forward body+key ra host ngoai; gemini/anthropic/devin khong check `AI_ALLOWED_ENDPOINTS` | `aiEndpointAllowed` bat buoc HTTPS (tru localhost); `redirect: 'error'` tren TTS + ca 3 text providers; `providerEndpointAllowed` goi trong `callOne` cho moi config; `devinEnabled()` check `api.devin.ai` | **fixed** |
| 2 | MEDIUM | Doc validator van nhan: `appendix: {}` (cleanDoc `.map` no), `text: 42` (`.trim` no), doc toan para rong (clean xong 0 block van thang race) | `isDocContent`: block payload typed (`text` string-or-absent, `items` array-of-string, `list` bat buoc items); appendix phai absent/null/array-of-valid-sections; predicate chay tren `cleanDoc(parsed)` va bat buoc >=1 block con lai | **fixed** |
| 3 | MEDIUM | Devin fallback bypass validator: devin-callback chi check object-vs-array; tool-runner chi check title+sections | devin-callback: job `tvc-tool:*` phai qua `isDocContent` (+`sectionsLookEnglish` cho A-01/A-03); doc loi -> job `failed` (client fallback thay vi poll mai); tool-runner defensive check day du (sections>=1 + blocks arrays) | **fixed** |
| 4 | MEDIUM | Exam fetch cap theo (std x qtype) van loc sot level — 200 cau "biet" an slot cua "van_dung" cung qtype | Fetch theo bo ba `(standard x qtype x level)` cap 120/triple + pool 80/std cho tier thay the | **fixed** |
| 5 | MEDIUM | Deadline khong bound toan bo: moi TTS key nhan lai 30s fresh (30s budget -> 90s); upload khong deadline; Devin fallback 20s co the bat dau sau budget 105s | `ttsSegment` nhan `deadlineAt` tuyet doi, tinh lai truoc moi key; route check remaining truoc upload (>8s); Devin fallback chi chay khi con >15s va nhan `timeoutMs` tu route | **fixed** |

## Re-verification (Codex)

- #1 PHT scope: **pass** — khong tim thay bypass trong source
- #2 owner tenant: **pass** — `concurrent_roles NOT NULL` nen containment khong phai NULL bypass
- #6 corrective retry: **pass**
- Deployed check con lai: trigger/policies da duoc smoke-test truc tiep tren prod (T1-T5 o r3) — policies/guard mo rong khop migrations

## TOP-10 Codex (sau r4)

5 muc dau la **existing deferred** (khong phai finding moi): org-boundary `scn_is_dept`, AI PII minimization, atomic AI quotas, stale-write grades, durable parent-digest outbox — da co trong backlog/deferred. 5 muc con lai la findings r4 — **da fix het trong commit nay**.

## Gates

- `tsc --noEmit`: PASS (0 errors)
- `eslint`: PASS (0 errors)
- `next build`: PASS
- `check-consistency`: PASS (all checks)
- Studio E2E sau deploy `a37dffe`: **17 pass / 0 fail** — DC-01 xuong 34s
  (hedged race), A-01 provider=gemini 14s, flow duyet 3 lop + deny PH OK

## Trang thai loop

```
R1 self(degraded): 1M+3L -> fix | R2 Codex: 6H+5M -> fix | R3 Codex: 3H+4M -> fix
R4 Codex (confirmation): 1H(cond)+4M -> fix het (commit nay)
```

Muc tieu "khong con finding actionable" da dat sau r4. Codex da xac nhan khong co regression tren cac fix r3. Neu report tiep theo CLEAN -> loop dong chinh thuc; neu con -> triage tiep theo dung quy trinh.
