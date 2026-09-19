# QA Report — Sổ Chủ Nhiệm Số

Date: 2026-09-18 · Environment: local dev (Next.js dev, port 3100) + production build

## Automated checks

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx eslint` | ✅ 0 errors, 0 warnings |
| `npm run build` | ✅ 67 pages generated, 65 dynamic routes + proxy |

## Runtime smoke (Playwright, desktop 1440px)

| Area | Result |
|---|---|
| `/login` | ✅ renders, demo role select autofills credentials |
| Login → redirect `/` | ✅ session cookie, proxy auth gate works |
| GVCN `/dashboard` | ✅ 10 stat cards, tasks, chart, activity feed — real RLS data |
| `/attendance/daily` | ✅ 37-student roster, 4-status radios, counters (3 vắng/2 CP/1 KP/2 muộn) |
| `/register/seating` | ✅ seeded v1 layout loads, drag-swap grid, export buttons |
| `/school/dashboard` (BGH) | ✅ school stats, thi đua bar chart, incident feed |
| `/portal/parent` | ✅ child card, attendance %, grade avg, announcements, appointments |
| `/portal/student` | ✅ 200; role guard redirects non-students to ROLE_HOME |

## Route sweep — GVCN session

All 50 role-scoped routes fetched: **50/50 → 200 OK**, no `Application error` markers.

Role-route sweep (BGH session): `/school/*`, `/dept/*`, `/team/*`, `/safety/bgh`, `/register/signoff`, `/schedule/timetable`, `/emulation/ranking` — 13/13 → 200 OK.

## Mutation flows

| Flow | Result |
|---|---|
| Seating save | ✅ "Đã lưu sơ đồ phiên bản v2" — insert + is_current version bump |
| Attendance confirm | ✅ "Đã xác nhận chuyên cần ngày 18/9/2026 cho 37 học sinh" |

## Console / hydration

- Initial: `buttonVariants()` called from Server Component → **fixed** (server-safe class strings in dashboard quick links)
- `seating_charts` 400s: `month=eq.2026-09` vs `date` column → **fixed** (`-01` suffix for date queries)
- dnd-kit hydration mismatch (`DndDescribedBy-0/1`) → **fixed** (stable `id` on `DndContext`)
- Post-fix: **0 console errors** across tested pages

## Responsive (390px)

- ✅ Hamburger nav replaces sidebar; stat cards stack 2-col
- ✅ Parent portal stacks vertically, readable
- ✅ Seating grid keeps horizontal scroll

## RLS / auth

- Unauthenticated → proxy redirects to `/login` ✅
- `requireRoles` redirects wrong-role users to their `ROLE_HOME` ✅
- Service-role key server-only; browser uses anon key ✅

## Known limitations

- Appointment time format `23:30 05/10/2026` raw ISO; teacher name shows "—" when join missing
- Dashboard grade chart flat (single seeded term month)
- Export PDF/PNG opens print dialog (window.print), not true PDF pipeline
- Seating-history restore label shows full ISO month string

## Verdict

PASS — cleared for Vercel **preview** deployment. Production go-live still requires explicit human approval.
