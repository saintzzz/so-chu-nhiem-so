# Architecture — Sổ Chủ Nhiệm Số

**Phase 4 output — Tech Lead** | Stack validated vs repo AGENTS.md + Next.js 16 docs (`node_modules/next/dist/docs/`)

## 1. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.3 App Router, React 19, TS strict | Repo scaffold; real routes per design brief |
| Styling | Tailwind v4 `@theme` + target's CSS-var tokens | Parity + repo convention |
| UI | shadcn (Base UI) + custom components | Repo ships `@base-ui/react`, `button.tsx` |
| Backend | Supabase: Auth + Postgres + RLS | User-approved; MCP-bound project `cxjpgfhqchjoernfmcra` |
| Supabase client | `@supabase/ssr` + `@supabase/supabase-js` | Server Components + Server Actions |
| DnD | `@dnd-kit/core` + `@dnd-kit/sortable` | Seating chart |
| Charts | Custom SVG components | Parity (target uses inline SVG, no lib) |
| Export | Print CSS + `html2canvas` optional | Sơ đồ lớp PDF/PNG |
| Fonts | `next/font/google`: Figtree + IBM Plex Mono | Target tokens |

## 2. Next.js 16 specifics (from bundled docs — breaking vs training data)

- **`proxy.ts`** replaces `middleware.ts` — file `src/proxy.ts`, export `proxy` or default, for optimistic auth redirects only.
- **`cookies()` is async** — `await cookies()` everywhere; Supabase server client uses async cookie adapter.
- Server Functions ("use server") for mutations; `revalidatePath`/`refresh` after writes.
- `unauthorized()`/`forbidden()` available for auth walls.
- No `middleware.ts`, no sync `cookies()`, no `headers()` sync.

## 3. App structure

```
src/
  proxy.ts                      # optimistic auth redirect (not full authz)
  app/
    layout.tsx                  # fonts + tokens + vi lang
    page.tsx                    # redirect → /login or role home
    login/page.tsx
    (app)/                      # staff shell (sidebar+topbar)
      layout.tsx                # AppShell, requires staff session
      dashboard/page.tsx
      records/{intake,upload,student/[id],history,report}/page.tsx
      attendance/{daily,leaves,notify,tracking,history}/page.tsx
      academics/{grades,analysis,support,teacher-chat,parent-chat,plans}/page.tsx
      conduct/{records,evaluation,student-chat}/page.tsx
      counseling/{intake,assessment,referral}/page.tsx
      parents/{compose,inbox,appointments,portal}/page.tsx
      activities/{plan,announce,attendance}/page.tsx
      safety/{report,bgh,followup,archive}/page.tsx
      register/{roster,seating,seating-history,year-events,suggestions,plans,kpi,signoff,lock-records,export,audit}/page.tsx
      schedule/{timetable,period-log}/page.tsx
      emulation/{scoring,ranking}/page.tsx
      competency/{self-assessment,evidence}/page.tsx
      school/{dashboard,radar}/page.tsx          # BGH
      dept/{users,dashboard,data}/page.tsx       # Sở GD&ĐT
      team/{home,teachers,review,meetings}/page.tsx  # Tổ trưởng
    portal/
      parent/page.tsx
      student/page.tsx
  components/
    ui/            # shadcn primitives
    app-shell.tsx, sidebar-nav.tsx, topbar.tsx, command-palette.tsx
    stat-card.tsx, data-table.tsx, status-badge.tsx, page-header.tsx
    charts/{line-chart,bar-chart}.tsx
    seating-grid.tsx, radio-roster.tsx
  lib/
    supabase/{server,client,admin}.ts
    auth.ts, rbac.ts, nav.ts (per-role nav config)
    utils.ts
  types/           # generated DB types + domain models
  hooks/
supabase/
  migrations/      # applied via MCP apply_migration
  seed.sql
docs/project/      # this SDLC's artifacts
```

## 4. Auth & RBAC

- Supabase Auth email/password. Seeded demo accounts: `gvcn@demo.scn`, `gvbm@`, `totruong@`, `bgh@`, `sogd@`, `phuhuynh@`, `hocsinh@` (password demo).
- `profiles` table mirrors `auth.users` (trigger on signup): `id`, `role` enum, `full_name`, `school_id`, `department_id`.
- `proxy.ts`: redirect unauthenticated `/` + `(app)`/`portal` → `/login`; redirect logged-in `/login` → role home. Optimistic only.
- Real authz in Server Components via `requireRole()` helper + RLS as final layer.
- Role-home map: gvcn→/dashboard, gvbm→/academics/grades, totruong→/team/home, bgh→/school/dashboard, sogd→/dept/dashboard, phuhuynh→/portal/parent, hocsinh→/portal/student.
- Demo role-switcher (target feature): only for a seeded `demo` superuser seeing all — implemented as `?as=role` dev affordance or skipped; RLS stays authoritative.

## 5. Database schema (~30 tables, snake_case)

**Org:** `schools`, `departments`, `academic_years`
**People:** `profiles`, `students`, `parents`, `parent_students`
**Class:** `classes`, `student_groups` (Tổ), `class_roles` (BCS), `student_record_history`
**Teaching:** `subjects`, `teacher_subjects`, `timetable_entries`, `period_logs`, `period_absences`
**Attendance:** `attendance_records` (status enum: present/excused/unexcused/late, source enum: manual/period_log)
**Academics:** `grades` (term, assessment_type, score), `support_plans`
**Conduct:** `conduct_records` (vi_phạm/khen_thưởng/nhận_xét), `conduct_evaluations` (term rating)
**Counseling:** `counseling_cases`
**Comms:** `announcements`, `announcement_reads`, `messages`, `appointments`
**Activities:** `activities` (status flow draft→pending→approved→done), `activity_attendance`
**Safety:** `incidents` (severity, status, reported_to_bgh)
**Register:** `seating_charts` (month, version, layout jsonb), `kpis`, `register_signoffs`, `school_year_events`, `tasks` (gợi ý), `export_log`
**Emulation:** `emulation_criteria`, `emulation_scores`
**Competency:** `teacher_assessments`, `assessment_evidence`, `dept_meetings`
**System:** `notifications`, `audit_logs`

Enums via `create type ... as enum` or `check` constraints — prefer `check` + lookup tables where values may grow.

### RLS strategy
- `auth.jwt() ->> 'role'` mirrored into `profiles.role`; helper SQL functions `my_role()`, `my_school_id()`, `my_class_ids()` (classes where GVCN or teacher), `my_student_ids()` (parent's children / self).
- Policies: GVCN→own classes; GVBM→classes they teach (via `teacher_subjects`/`timetable`); BGH→whole school; Sở→all schools in dept scope (demo: all); PH→children only; HS→self only.
- All tenant tables `enable row level security` + default `deny` — write policies per role explicitly.
- Seed uses `service_role` (bypasses RLS).

## 6. Data flows

- **Điểm danh:** `attendance_records` upsert per roster row; `period_absences` (Sổ đầu bài) → merge view `attendance_daily` combining sources.
- **Dashboard counters:** SQL views (`dashboard_gvcn`) aggregating today's absences, late, %CC, at-risk counts — single source.
- **Seating chart:** `seating_charts.layout` jsonb `{cols, rows, seats:[{x,y,student_id}]}`, version per save; export client-side.
- **Notifications:** insert triggers (announcement → per-recipient rows).

## 7. ADRs

- **ADR-1 Real routes over SPA** — target is single-URL SPA; we use real App Router routes (deep-link, RSC). Accepted deviation, documented in design brief.
- **ADR-2 RLS over app-level checks** — enforce in DB so portals/API can't leak; app checks for UX only.
- **ADR-3 JSONB seating layout** — flexible grid versions, no schema churn.
- **ADR-4 Rule-based "AI" suggestions** — deterministic generator over `school_year_events`; labeled "gợi ý", no LLM.
- **ADR-5 Demo accounts + optional role preview** — preserve demo UX without weakening RLS.
- **ADR-6 Server Actions for writes** — no separate API layer; Route Handlers only for uploads (CSV parse) if needed.

## 8. Build order (feeds Phase 5)

1. Tokens + fonts + AppShell + login + auth/RBAC + nav config
2. Supabase migrations + seed (parallel-safe after schema)
3. Shared components (DataTable, StatCard, StatusBadge, Charts)
4. GVCN modules M1-M10 (P0)
5. TKB/Sổ đầu bài, Thi đua (M11-M12)
6. BGH/Sở/Tổ views (M14)
7. Portals (M15), Counseling/competency (M6/M13)
8. QA → deploy

## 9. Risks

- ~30-table schema + RLS = the real complexity; test each role's policies with `execute_sql` as role before UI wiring.
- Node 22 vs engines ≥24: verify `npm run build` early; upgrade Node if it fails.
- Base UI (not Radix) shadcn — component APIs differ; check `components/ui` patterns before writing new primitives.
