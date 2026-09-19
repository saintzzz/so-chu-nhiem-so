# Project Charter — Sổ Chủ Nhiệm Số

**Phase 1 output — PM** | Date: 2026-09-19 | Status: Approved by stakeholder Q&A

## 1. Vision

Build **"Sổ Chủ Nhiệm Số"** — a Vietnamese K-12 homeroom-teacher management platform with full feature parity to https://mockup-so-chu-nhiem.vercel.app/, but backed by a **real Supabase backend** (auth, Postgres, RLS) instead of client-side mock state.

## 2. Approved decisions (stakeholder Q&A)

| Decision | Choice |
|---|---|
| App name | **Sổ Chủ Nhiệm Số** (agent-proposed, accepted) |
| Scope | **Full parity** — all 7 roles, ~70 screens |
| Data layer | **Real backend — Supabase** (auth, Postgres, RLS per role) |
| Seed data | Agent-generated Vietnamese demo data |
| Supabase project | **New project** `so-chu-nhiem-so` (ref `cxjpgfhqchjoernfmcra`, ap-southeast-1) — created & verified |
| Deploy | **Vercel preview** when Tester passes; production needs separate go-live |

## 3. Scope

### In scope
- 7 role surfaces: GVCN, GVBM, Tổ trưởng chuyên môn, BGH, Quản trị Sở GD&ĐT, Phụ huynh, Học sinh
- ~70 screens per sitemap (`docs/research/.../sitemap.md`)
- Design system parity: ivory/navy palette, Figtree, CSS vars (extracted tokens)
- Responsive: desktop sidebar + mobile hamburger/stacked
- Supabase: schema, seed, RLS per role, auth (email/password)
- Vercel preview deploy + deployment registry

### Out of scope (v1)
- Real AI features (AI gợi ý công việc, báo cáo AI → rule-based simulation)
- Real-time notifications (Realtime channels — optional v2)
- Actual PDF generation server-side (client print/export acceptable)
- Multi-school tenancy beyond seeded demo data
- Payment/billing

## 4. Milestones

| # | Phase | Deliverable | Gate |
|---|---|---|---|
| M1 | PM | This charter | ✅ Approved |
| M2 | BA | PRD + user stories | BA Lead review |
| M3 | Designer | Design brief + tokens + screen specs | Design Lead review |
| M4 | Tech Lead | Architecture + DB schema + ADRs | Tech Lead review |
| M5 | Developer | Working app, all screens, backend wired | Dev Lead review + build green |
| M6 | Tester | QA report, visual QA, defects fixed | Test Lead review |
| M7 | Deployer | Vercel preview live + registry | DevOps Lead verify |
| M8 | PM | Final delivery report | Stakeholder acceptance |

## 5. Resources & dependencies

- Stack: Next.js 16, React 19, TS strict, Tailwind v4, shadcn/ui, Supabase (Auth+DB+RLS), @dnd-kit (seating), Recharts or custom SVG charts
- MCPs: supabase (new project), playwright (QA/recon), vercel (deploy), deepwiki (standards)
- Node ≥24 required by repo (env has 22 — resolve before build)
- Secrets: `~/.config/devin/secrets/supabase_new_keys.json` (anon+publishable keys)

## 6. Risks

| Risk | Mitigation |
|---|---|
| ~70 screens is huge | Parallel builders per role/module; shared component library first |
| Hidden target states | Interaction sweep per screen during build; flag undocumented states |
| Vietnamese seeded data volume | Generate once into Supabase seed; single source of truth |
| RLS complexity (7 roles) | Schema-first design in Phase 4; test policies per role |
| Node 22 vs required 24 | Install Node 24 or verify compat early in Phase 5 |
| Preview deploy env vars | Keys already in secrets file; inject at deploy time |

## 7. Success criteria

- All 7 role surfaces navigable, feature-complete vs sitemap
- Auth works: login per role, RLS scopes data correctly
- Visual parity: matches target design system & layout
- `npm run check` green (lint + typecheck + build)
- Preview URL live on Vercel, health-checked, registered
