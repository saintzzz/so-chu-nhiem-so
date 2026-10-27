# External Review Loop - CR-065 lms-lite

Commits: `564c175` (base) -> `accad9f` (r1 fixes). Reviewer: cross-model
subagent (GPT), whole-diff + conventions check. Verdict cuoi: **APPROVE**.

## Round 1 (REJECT - 2H + 3M + 1L)

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | H | `lms_assign` khong verify exam thuoc truong; bypass `bgh/admin` cho phep gan de truong khac; /lms page liet moi exam cho bgh/admin | FIXED `accad9f`: RPC yeu cau `owner.school_id = my_school_id()` cho moi role; page filter `.in("owner_id", staffIds)` |
| 2 | H | Dap an trong `lms_sessions.questions` chi chan boi column-grant; `lms_sessions_write FOR ALL` rong; khuyen nghi tach bang private | FIXED: `lms_session_questions` - revoke all + RLS enable + KHONG policy (default deny); drop cot `questions`; grant lai select toan bang |
| 3 | M | Race 2 request start -> unique_violation tho | FIXED: `INSERT ... ON CONFLICT (session_id, student_id) DO NOTHING` + fallback re-select |
| 4 | M | `not_submitted` dem kep HS in_progress (hien o ca 2 list + sai mau so) | FIXED: tach `not_started` = HS chua co submission row nao |
| 5 | M | Portal nuot loi RPC -> empty gia | FIXED: loi non-module -> "Khong tai duoc bai tap - vui long thu lai." |
| 6 | L | Dau `·` vi pham convention `-` | NOT CONFIRMED: `·` la separator chuan toan app (attendance, portal, finance - da qua nhieu CR); rule chi cam em/en dash |

## Round 2 (APPROVE)

Reviewer xac nhan 5 fix dung; 2 ghi nhan con lai (khong blocking):
- Backfill `lms_session_questions` khong idempotent neu replay giua chung
  -> da them `on conflict do nothing` vao file migration (DB da apply).
- Re-assert grant cuoi cho `lms_submissions`/`lms_session_questions`
  -> da them vao cuoi migration cho ro trang thai grant.

## Verify live (DB + Playwright + production)

- `lms_assign` -> snapshot 12 cau vao bang private; `lms_session_questions`
  select -> `permission denied`; `lms_sessions select *` OK (khong con
  cot bi mat).
- start_attempt tra de KHONG co 'correct'; deadline =
  least(closes_at, start+duration).
- submit all-correct -> auto_score 7/10 + essay_pending; nop lai ->
  `already_submitted`.
- Deny: module off -> `module_disabled` o assign + assignments; session
  dong -> `not_open`; session la -> `session_not_found`; direct
  insert/update submissions -> `permission denied`.
- UI: GV giao bai qua /lms, HS portal thay bai, lam + nop, portal hien
  "Da nop - 1.25/4.375d - cho cham"; GV /lms/sessions/[id] thay
  1/34 + danh sach chua lam. Module off -> /lms redirect dashboard,
  nav an.
- Production `so-chu-nhiem-so-theta.vercel.app`: /lms live, nav dung,
  console 0 errors; portal HS hien section + empty state dung.
