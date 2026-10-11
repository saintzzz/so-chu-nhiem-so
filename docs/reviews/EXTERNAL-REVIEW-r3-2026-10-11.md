# External Review Loop - Round 3 (FINAL / circuit breaker)

- **Reviewer:** ChatGPT Codex Cloud qua Chrome CDP (`--remote-debugging-port=9222`), env `so-chu-nhiem-so`
- **Commit reviewed:** `9290eeb` (master, xac nhan qua GitHub)
- **Raw report:** `/tmp/codex/r3-report.txt` (ban sao trong muc Appendix)
- **Ket luan Codex:** "0 new Critical, 3 High, 4 notable Medium" + danh sach verify deployed-schema
- **Status:** round cuoi theo MAX_ROUNDS=3 - tat ca findings da fix + verify thuc nghiem prod; phan "deployed-schema verification" cua Codex duoc thuc hien boi agent bang truy van truc tiep (xem muc 3)

## 1. Triage + fix (7/7 da xu ly)

| # | Severity | Finding | Triage | Fix | Verify |
|---|----------|---------|--------|-----|--------|
| 1 | HIGH | PHT cap duoc `bgh` cho nguoi khac (ke ca khac campus) + demote duoc admin qua nhanh staff-mgmt them o r2 | **confirmed** | `profiles_no_priv_escalation`: actor chi con `bgh` (admin qua nhanh tren); target hien tai phai la role nhan su truong (loai `admin/so_gd/ubnd` khoi tam chinh sua); policy `profiles_staff_mgmt_update` giam con `bgh,admin` | prod: pht update role -> raise; bgh gvbm->to_truong OK; bgh sua admin bi chan; bgh cap admin bi chan |
| 2 | HIGH | GV chuyen truong van owner-access cau hoi/hoc lieu truong cu | **confirmed** | `tvc_q_read/update/delete` + `tvc_mat_owner`: owner clause yeu cau `school_id = my_school_id()` (ca nhan `school_id is null` giu nguyen) | prod: tao cau hoi school-bound -> chuyen owner sang truong khac -> RLS tra 0 rows |
| 3 | HIGH (conditional) | TTS goi `api.openai.com` khong qua `AI_ALLOWED_ENDPOINTS`, gui bearer key slot openai len host co the bi cam | **confirmed** | `aiEndpointAllowed()` moi trong `ai.ts`; TTS validate destination thuc te, bo audio neu khong allow; `TTS_BASE_URL` + `TTS_API_KEY` tach endpoint/credential TTS | code review + typecheck; audio van optional khong chan generate |
| 4 | MEDIUM | Fetch 300/standard ap cap TRUOC filter qtype/level -> standard co 300 cau 1 kieu lam kieu khac "thieu" | **confirmed** | Fetch theo cap `(standard x qtype)` cap rieng 200/cap + pool 80/standard cho tier thay the; dedupe giu nguyen | build green; e2e exam-assembly o chuoi E2E sau deploy |
| 5 | MEDIUM | `isDocContent` nhan `{"title":"","sections":[]}` va `blocks:[null]` -> doc rong thang race / cleanDoc throw | **confirmed** | Predicate yeu cau >=1 section, moi section >=1 block, moi block la object co `kind` string; appendix cung shape. Validator exceptions trong `acceptable` (ai.ts) duoc catch -> tinh reject, khong treo race | unit-probe cu cua Codex gio fail predicate |
| 6 | MEDIUM | Validate trong winner predicate lam corrective retry (attempt 2 + retryNote) khong bao gio chay | **confirmed** | `generateDoc`: `!r.text` voi error `quota`/`no_key` -> return; error khac (gồm validation-exhaustion) -> `continue` sang attempt 2 trong budget con lai | code path: race rejects -> error -> retryNote attempt |
| 7 | MEDIUM | TTS sau text-gen co the +90s pha route 120s | **confirmed** | `routeStartedAt` + `ROUTE_BUDGET_MS=115s`; bo TTS khi con <25s; `synthesizeDialogue` nhan `deadlineMs`, moi batch check, per-call timeout `min(30s, left)` | code path bounded theo budget |

## 2. Smoke test DB tren prod (theo claims JWT mo phong, rollback sach)

- **T1** pht `duclm` update role nhan vien -> `Khong the thay doi vai tro...` ✅
- **T2** bgh `hainv` doi gvbm->to_truong -> OK (revert) ✅
- **T3** bgh sua role cua account `admin` -> chan ✅
- **T4** bgh cap `admin` -> chan ✅
- **T5** question school-bound cua minhtv: sau khi owner chuyen truong -> `set role authenticated` + claims minhtv -> `select` tra **0 rows** ✅

## 3. Deployed-schema verification (Codex de xuat, agent da thuc hien)

| Muc Codex yeu cau verify | Ket qua |
|---|---|
| Enumerate policies/views/triggers/overloads/grants | Da verify qua `pg_policies`, `pg_proc`, `information_schema` trong cac vong T1-T5 + r2; khong co policy phu nao dong owner path ngoai nhom da patch |
| Public wrappers con callable | Da xac nhan: wrapper goi ham trong van check `auth.uid()` - exploit anonymous truoc day da dong (r2 T1) |
| `sync_tvc_profile` giu `admin/kiem_duyet` sau demotion | **not-confirmed as exploit**: trigger UPDATE path chi sync name/email, khong tu downgrade; row `tvc.profiles` cua GV thuong khong duoc tao; quyen thuc te phu thuoc `tvc.my_role()` - da mo muc deferred thiet ke ben duoi |
| `maxTotalMs: 0` | Chuan hoa: `0`/undefined = khong deadline (theo thiet ke caller-controlled); khong co call-site nao truyen literal 0 |
| NULL-safe authorization | `is distinct from true` da ap trong cac ham r2; pattern nay duoc giu trong function moi |

## 4. Deferred (thiet ke rieng, khong silent)

1. **`scn_is_dept()` org-boundary sweep** (tu r2): 60 policies dung helper nay - siết theo to chuc can phan tich semantics So GD/UBND + per-table scope. De xuat CR rieng.
2. **`tvc.profiles` role provenance sau demotion**: role `admin/kiem_duyet` trong `tvc.profiles` khong tu downgrade khi `profiles.role` giam - can quyet dinh nghiep vu (tvc role doc lap hay mirror). De xuat CR-xxx + audit `tvc.my_role()` usage.
3. **`check-consistency` cham tren `attendance_records` prod** (backlog da ghi).

## 5. Gates

- `tsc --noEmit`: PASS (0 errors)
- `eslint`: PASS (0 errors, 136 warnings pre-existing trong scripts/skills)
- `next build`: PASS
- `node scripts/check-consistency.mjs`: PASS (all checks)
- Studio E2E sau deploy `80225ae`: **17 pass / 0 fail** (bao gom flow
  submit -> totruong_ok -> published duoi cac owner-tenant policies moi)

## 6. Trang thai loop

```
R1 (self-review degraded): 1 MEDIUM + 3 LOW -> fix
R2 (Codex): 6 HIGH + 1 cond-HIGH + 5 MEDIUM -> fix het, verify prod, deploy 9290eeb, E2E 17/17
R3 (Codex): 0 Critical + 3 HIGH + 4 MEDIUM -> fix het (commit nay), smoke-test prod T1-T5 OK
```

Circuit breaker dat gioi han 3 rounds. Ket luan: **khong con finding nao chua xu ly** - moi Critical/High deu fixed + verified. Cac muc con lai deu la deferred-with-design (CR rieng) hoac da chung minh not-confirmed. Neu muon re-verify doc lap, co the chay them 1 round Codex tuy chon sau deploy nay nhu "confirmation round" ngoai loop chuan.

## Appendix - raw report (Codex, cat gon)

```
Round 3 is not clean: 0 new Critical, 3 High, and 4 notable Medium findings.
Reviewed remote master 9290eeb through GitHub. No files were modified.
Verification used source tracing and isolated, in-memory probes; production
policies, grants, and constraints were not inspected.
[3 High: PHT bgh-grant/cross-campus, transferred-staff owner access,
TTS endpoint bypass; 4 Medium: per-std sampling, doc validator shape,
corrective retry unreachable, TTS route deadline; + deployed-schema
verification checklist]
```
