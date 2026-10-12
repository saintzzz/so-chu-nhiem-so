# External Review r28 - remediation (commit bb3b150)

Codex Cloud review tren commit `bb3b150`. Verdict: NOT-CLEAN - 4 findings
(1 HIGH / 3 MEDIUM): 2 class moi + 2 false negative cua regression gate r27.

## Triage

| # | Sev | Class | Trang thai |
|---|-----|-------|------------|
| 1 | H | Bypass chan link noi bo bang backslash (`/\host` - WHATWG URL chuan hoa `\` -> `/`) | FIXED |
| 2 | M | Cot dan xuat (`students.positive_points`) van ghi truc tiep duoc -> sai tong diem | FIXED |
| 3 | M | Su co chi gan studentId khong resolve campus -> leak mo ta cho PHT ngoai co so | FIXED |
| 4 | M | Fix draft-race r27 thieu identity hoi thoai - cung noi dung nhung nguoi nhan khac van xoa nham | FIXED |

## Fix chi tiet

### F1 (H): backslash bypass
- `supabase/migrations/20261212_cr049_r28_fixes.sql`: `notif_ins` chuyen tu
  blacklist (`^/` + `!^//`) sang whitelist charset
  `^/[a-zA-Z0-9_/?=&%#.~:+-]*$` AND `!~ '^//'`. Luu y: `/` nam trong charset
  nen `//host` van match whitelist - bat buoc giu check `//` rieng.
- `notifications-client.tsx`: thay `startsWith("/")` bang
  `new URL(n.link, location.origin).origin === location.origin` - parser
  WHATWG chuan hoa `\` truoc khi so origin nen `"/\host"` bi chan ca tren
  client.
- Verify live: `//evil` fail, `/\evil` fail, `/safety/bgh` pass.

### F2 (M): derived-column writable
- Column-grant revoke KHONG hoat dong: `authenticated` co table-level
  UPDATE, Postgres OR hai quyen. Verify live `has_column_privilege` van true
  sau revoke -> doi sang trigger guard.
- `trg_guard_student_positive_points` (BEFORE INSERT/UPDATE): chan thay doi
  `positive_points` o `pg_trigger_depth() = 1` (ghi truc tiep), cho phep
  depth > 1 (trg_sync_positive_points tu conduct_records) va
  `current_role in (service_role, postgres, supabase_admin)` (backfill).
- INSERT chan `positive_points <> 0` (default 0).

### F3 (M): incident leak mo ta cho PHT ngoai co so
- `safety/actions.ts`: khi `classId` null nhung co `studentId`, resolve
  `students -> classes(campus_id)` truoc khi chon recipient. Lookup loi hoac
  hoc sinh khong co lop -> `campusUnknown = true` -> chi BGH nhan (fail
  closed, cung semantic r21 cho nhanh classId).

### F4 (M): draft race thieu conversation identity
- `inbox-client.tsx`: `selectedIdRef` (effect-updated) + `sentFor = selected.id`.
  Chi reset draft va hien feedback khi `prev === sentDraft` VA
  `selectedIdRef.current === sentFor`. Cung noi dung gui cho phu huynh khac
  khong con xoa nham draft moi.
- `parent-actions.tsx` da co check tuong duong qua `replyTo` (r27) - khong
  can doi.

## Test-level false negatives (gate holes da dong)

- r2-regression 3076 (cu): chi assert `prev === sentDraft` ton tai -> moi:
  assert `sentFor` + `selectedIdRef` + feedback gioi han cung hoi thoai.
- r2-regression 3084 (cu): assert `startsWith("/")` -> moi: assert `new URL`
  + `=== window.location.origin` + khong con pattern startsWith.
- Them test: whitelist charset + `!~ '^//'`, trigger guard (depth/role),
  incident resolve campus tu studentId.

## Gates

- reliability gate: 4/4 PASS
- r2-regression: 154/154 PASS
- check-consistency: PASS
- tsc --noEmit: clean
- eslint: 0 errors (warnings pre-existing)
- next build: PASS
- Migration applied + verify live (regex, trigger exists, policy)

## Residual

- F2 chunk-snapshot (r27) van deferred theo design.
- Trigger guard chi bao ve `positive_points`; neu them cot dan xuat khac thi
  mo rong cung function.
