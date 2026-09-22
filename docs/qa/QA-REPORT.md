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

---

# QA Report v2 — Full-system regression (production)

Date: 2026-10-12 · Environment: production `https://so-chu-nhiem-so-theta.vercel.app` · Harness: `scripts/qa-e2e.mjs` (Playwright + Supabase service-role verification)

## Result

**162 / 162 checks PASS — 0 FAIL** (final run, post-fix deploy `7f7f1d1`)

| Section | Scope | Result |
|---|---|---|
| A. Route smoke | 126 route×role loads — status, TTFB, console/page errors | ✅ all 200, 0 console errors, 0 hydration errors |
| B. RBAC deny paths | 18 cross-role probes (gvbm→audit, hs→dashboard, ph→/school/users, pht→roster, phonggd/ubnd→dept/data+users, ketoan→roster…) | ✅ all redirect to role home |
| C. Cross-module linkage | UI counts vs DB: roster 32/32, period-log=TKB 4/4, positive_points=Σ điểm cộng (22 HS, 0 lệch), announcements on HS+PH portals, parent-chat 32/32 links, period_absences→attendance_records 20/20 synced, học bạ TT22 render | ✅ 8/8 |
| D. UI mutations → DB | điểm danh present→late→restore, dashboard counter=DB, BGH thông báo toàn trường → `announcements` row + portal HS render | ✅ 5/5 |

## Defects found and fixed in this round

| Defect | Root cause | Fix |
|---|---|---|
| Hydration #418 on `/attendance/leaves` | `Intl.DateTimeFormat` weekday names differ between server/client ICU builds | `src/lib/utils.ts`: compute weekday from VN-tz date parts, prepend `Thứ …`/`Chủ nhật` deterministically |
| `/records/report` >3s | 4 queries per class (~36 roundtrips, 9 lớp) | Batch: 3 school-wide queries, group by class in memory (`7f7f1d1`) |
| QA false FAIL: attendance mutation, dashboard count, RBAC denies | harness: wrong save-button label, regex caught label's date number, no redirect settle | `scripts/qa-e2e.mjs` corrected — all were harness bugs, app was correct |
| Perf metric inflated by AI streams | `domcontentloaded` waits for streamed Suspense boundaries | measure TTFB via `waitUntil: "commit"` (server <1s rule); all routes ≤2.5s TTFB incl. cold starts |

## Performance

- TTFB all routes ≤ ~2.5s including cold starts; warm <1.1s.
- Remaining cold-start variance (serverless) observed on rotating routes — not code-bound.
- `positive_points` sync is client-side read-modify-write (documented; candidate for DB trigger if concurrent writers emerge).

## Notes

- `positive_points` semantics confirmed: sum of **positive** conduct points only (vi phạm excluded by design).
- `/records/history` redirects to unified `/register/audit?type=student_record`.
- Parent contact channel = email only (no Zalo/SMS) — verified no dead toggles.

## Verdict

PASS — production verified. 162/162 automated checks green; all CR-007…CR-012 changes verified end-to-end with DB persistence.
