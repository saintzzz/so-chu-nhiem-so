<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Website Reverse-Engineer Template

## What This Is
A reusable template for reverse-engineering any website into a clean, modern Next.js codebase using AI coding agents. The Next.js + shadcn/ui + Tailwind v4 base is pre-scaffolded — just run `/clone-website <url1> [<url2> ...]`.

## Tech Stack
- **Framework:** Next.js 16 (App Router, React 19, TypeScript strict)
- **UI:** shadcn/ui (Radix primitives, Tailwind CSS v4, `cn()` utility)
- **Icons:** Lucide React (default — will be replaced/supplemented by extracted SVGs)
- **Styling:** Tailwind CSS v4 with oklch design tokens
- **Deployment:** Vercel

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run typecheck` — TypeScript check
- `npm run check` — Run lint + typecheck + build

## Code Style
- TypeScript strict mode, no `any`
- Named exports, PascalCase components, camelCase utils
- Tailwind utility classes, no inline styles
- 2-space indentation
- Responsive: mobile-first

## Design Principles
- **Pixel-perfect emulation** — match the target's spacing, colors, typography exactly
- **No personal aesthetic changes during emulation phase** — match 1:1 first, customize later
- **Real content** — use actual text and assets from the target site, not placeholders
- **Beauty-first** — every pixel matters

## Project Structure
```
src/
  app/              # Next.js routes
  components/       # React components
    ui/             # shadcn/ui primitives
    icons.tsx       # Extracted SVG icons as React components
  lib/
    utils.ts        # cn() utility (shadcn)
  types/            # TypeScript interfaces
  hooks/            # Custom React hooks
public/
  images/           # Downloaded images from target site
  videos/           # Downloaded videos from target site
  seo/              # Favicons, OG images, webmanifest
docs/
  research/         # Inspection output (design tokens, components, layout)
  design-references/ # Screenshots and visual references
scripts/            # Asset download scripts
.agents/
  skills/
    clone-website/  # Canonical cross-agent cloning workflow
.claude/
  commands/
    clone-website.md # Thin Claude Code invocation bridge
```

## Agent Workflow
- Edit `.agents/skills/clone-website/` for cloning-workflow changes. It is the canonical skill used by Codex, Cursor, and OpenCode.
- Keep `.claude/commands/clone-website.md` as a thin Claude Code bridge to the canonical skill; do not duplicate the workflow there.

## Mandatory UI/UX Rules (apply by default, no prompt needed)

- **Naming:** menu/nav labels use full Vietnamese names - no Roman numerals (`I.`, `II.`...), no abbreviations (GD → giáo dục, HS → học sinh, GVCN → giáo viên chủ nhiệm, GVBM → giáo viên bộ môn, BGH → Ban Giám Hiệu, CMHS → cha mẹ học sinh, KPI → chỉ tiêu hiệu suất, Sở GD&ĐT → Sở Giáo dục và Đào tạo). Page `section=` headers and titles must match the nav label. Icon maps keyed by label must be updated in the same change.
- **Control selection:** ≤4 options AND semantically meaningful → inline chips/radio (1 click, all options visible). >4 options OR a dense per-row/per-cell grid control → dropdown. Never chips inside dense tables.
- **No dead controls:** every button/icon must do something or be removed/hidden per role (e.g., notification bell links to the role's inbox only when one exists).
- **Keyboard + ARIA in overlays:** command palettes/dialogs need ArrowUp/Down + Enter navigation, highlighted active item, `role=combobox/listbox` + `aria-activedescendant`.
- **Horizontal scroll containment:** any `overflow-x-auto` container must also be `relative` - absolutely-positioned children (e.g. `sr-only` inputs) otherwise escape the clip and make the whole document scroll sideways on mobile.
- **Form validation:** submit disabled while required fields are empty; invalid values show inline messages naming the field and constraint (e.g. "Điểm không hợp lệ ... (0-10)").
- **Empty states:** every list/table must render a clear empty state (count + message), never a blank grid.
- **Instant paint:** every route group needs `loading.tsx` skeleton matching the typical page layout so navigation paints before server data arrives.
- **Role boundaries:** visiting another role's route must redirect to that role's home - never leak data.

## Mandatory Testing Rules (no bypass without explicit user confirmation)

- **Business-flow E2E, not page-load checks.** For every feature change, drive the real workflow per role: login → navigate → create/edit/import → save → verify DB persistence → verify downstream role sees it. Include denial paths and state transitions (draft → submitted → approved/locked).
- **Performance measurement per screen and per action.** Record server response, time-to-first-content, and action latency for every meaningful control. Thresholds: server <1s, action <3s. Never block page render on AI calls - stream/defer them.
- **Data coverage precondition.** Before E2E, audit the business tables the flow touches; seed coherent linked records where sparse. Testing empty screens is a failed precondition.
- **Console clean.** Zero hydration errors, zero failed network calls on every page tested. Timestamps use `formatDate`/`formatDateTime`/`formatDateOnly` from `src/lib/utils.ts` (fixed `Asia/Ho_Chi_Minh`) - never raw `toLocaleString`.
- **Design language invariant.** The whole app uses ONE design language - Fluent 2 - set once in `src/lib/domain-theme.ts`. Do not reintroduce per-domain themes or mix theme scopes.
- **Vietnamese name sorting.** All student/teacher/profile lists must sort by given name (last token), not by the DB `order("full_name")` which sorts by family name first. Use `sortByVietnameseName` / `compareVietnameseName` from `src/lib/utils.ts` at render or right after fetch.

## Project Conventions (Sổ Chủ Nhiệm Số)

- **RBAC is mandatory:** every route must call `requireRoles([...])` per `docs/research/ROLE-MATRIX.md` (default-deny). Server actions/API routes use `checkActionRole` / `getProfile` role checks - never rely on layout guards or `user != null` alone.
- **Vietnamese copy:** hyphen `-` only, never em-dash/en-dash.
- **Auth lookups:** `getProfile` is React `cache()`-deduped per request - call it freely in layout + page + actions.
- **DB types:** verify column types in seed/migrations first (`month` is int, dates are real `date`).
- **AI:** providers via env (`GEMINI_API_KEY`/`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`, `AI_PROVIDER`/`AI_MODEL`) in `src/lib/ai.ts` - never hard-code; Gemini needs `thinkingBudget: 0` for JSON output.
- **AI fallback:** on `quota` errors, `src/lib/devin.ts` creates an async Devin session; result returns via `/api/ai/devin-callback` (per-job `callback_token` in `ai_jobs`, proxy-whitelisted path). Env: `DEVIN_API_KEY` (+ optional `DEVIN_CALLBACK_URL`, else derived from request host). `AI_FORCE_ERROR=quota` simulates quota locally.
- **Deploy:** push to `master` auto-deploys to Vercel (`saintzzz/so-chu-nhiem-so`). Do NOT re-add `output: "standalone"` - it breaks remote builds.
- **Secrets:** `.env.local` and `~/.config/devin/secrets/*` stay uncommitted; never print key values.
- **QA:** verify with Playwright - login per demo role (`*@demo.scn` / `demo1234`), check allowed AND denied routes, verify mutations in DB.
