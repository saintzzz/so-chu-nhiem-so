# Handoff — Sổ Chủ Nhiệm Số

Date: 2026-09-18 · Full SDLC clone of `mockup-so-chu-nhiem.vercel.app` → real Supabase-backed app.

## Preview deployment

- **URL (git-linked, auto-deploy on push):** https://so-chu-nhiem-so-git-master-linhld7s-projects.vercel.app
- Vercel project: `so-chu-nhiem-so` (prj_aU7hn4ih4LDA4ON8xcd1SAtFB0QC), team `linhld7s-projects` (hobby)
- Git repo: **https://github.com/saintzzz/so-chu-nhiem-so** (branch `master`, git-linked — push to master auto-deploys preview)
- Deployment protection **disabled** for preview (public link). Re-enable via `PATCH /v9/projects` `ssoProtection.deploymentType` if needed.
- Alternative deploy flow: `vercel build` → `vercel deploy --prebuilt` (local build; see Known Issues).
- GitHub token: `~/.config/devin/secrets/github_token` (device-flow OAuth, `repo workflow` scope)

## Access

- Demo accounts (password `demo1234`): `gvcn@demo.scn`, `gvbm@`, `totruong@`, `bgh@`, `sogd@`, `phuhuynh@`, `hocsinh@`
- Supabase project: `so-chu-nhiem-so` — ref `cxjpgfhqchjoernfmcra` (ap-southeast-1)
- Secrets: `~/.config/devin/secrets/supabase_new_keys.json` (DB pass + API keys, chmod 600)

## What was built

- **65 dynamic routes** across 7 roles (GVCN 13 sections, BGH, GVBM, Tổ trưởng, Sở GD&ĐT, Phụ huynh, Học sinh)
- Next.js 16.3 (App Router, Turbopack, proxy.ts), React 19, TS strict, Tailwind v4, shadcn/ui, dnd-kit, Supabase SSR
- Postgres: 41 tables, RLS + role/school/class policies, trigger `handle_new_user`
- Seed: ~17k rows generated (Vietnamese names, 8 classes × ~37 HS, attendance/grades/conduct/incidents/timetable)
- Target design system reproduced: ivory bg, navy `#1E3A5F`, Figtree, extracted CSS tokens

## Verification

- tsc 0 errors · eslint 0 · `npm run build` green (67 pages)
- Playwright: 50/50 GVCN routes 200, 13/13 admin routes 200, preview 10/10 routes 200
- Mutations verified: seating save (version bump), attendance confirm (37 HS)
- Console clean post-fixes; mobile 390px responsive (hamburger, stacked, h-scroll)
- QA report: `docs/qa/QA-REPORT.md` + screenshots

## Fixes applied during QA

1. `buttonVariants()` called in Server Component → server-safe class strings
2. `seating_charts.month` (`date`) vs `"2026-09"` queries → `-01` suffix in seating page
3. dnd-kit hydration mismatch → stable `id` on `DndContext`
4. RLS `classes_write` extended to GVCN (class intake)
5. `engines`/`nvmrc` `>=24`→`22` (Vercel compat)

## Known issues / limitations

- ~~Vercel remote build fails~~ **RESOLVED** — root cause was `output: "standalone"` in `next.config.ts` (breaks Vercel file tracing → ENOENT). Removed; git-triggered remote builds now pass.
- MCP OAuth token scope: file upload + deployment creation OK; `?teamId=` endpoints and `/events` logs → 403. CLI works when `.vercel/project.json` orgId = **user id** (not team id).
- Appointment time shows raw ISO; teacher name "—" when join missing
- Export PDF/PNG = browser print dialog, not a real PDF pipeline
- Grade chart flat — single seeded month
- No production deploy performed (requires explicit approval)

## Ops

- Re-deploy preview: `TOKEN=… npx vercel deploy --prebuilt --yes --token=$TOKEN` after `vercel build`
- Re-seed: `node scripts/seed.mjs` (service role in `.env.local`)
- Devin Cloud secrets upload blocked (403 — org lacks DRS); local secrets only.
