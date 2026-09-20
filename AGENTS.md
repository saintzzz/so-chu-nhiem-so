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

## Mandatory SDLC (no bypass)

- **All feature work runs the multi-agent-framework pipeline** (PM → BA → Designer → Tech Lead → Developer → Tester → Deployer). Direct implementation is forbidden; the only exceptions are trivial fixes changing no requirement (typo, lint, one-line bug) - those still need typecheck/lint/build.
- **Requirement changes are CRs.** Write `docs/project/CR-NNN-*.md` (scope + impact assessment + separate estimate), get user approval via Q&A, then re-enter the pipeline at the earliest affected phase. Cascade artifacts (PRD, ROLE-MATRIX, ARCHITECTURE, QA-REPORT).
- If work happened outside the pipeline, stop and write the CR retroactively before continuing.
- Active CRs: `docs/project/CR-001-ops-modules.md` (ops modules from school-management reference).

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
- **Free-text fields auto-grow.** Any field holding notes/remarks/comments/nội dung must use `AutoGrowTextarea` (`src/components/ui/auto-grow-textarea.tsx`) — never a single-line `<input>` (truncates text) and never a fixed-height `<textarea>` (clips). The field grows vertically with content. In dense tables (`<td>` cells, data grids) always pass `bare` — the cell is the visual container, so a bordered box inside it reads as a broken cell outline. `bare` keeps the field transparent with a focus underline instead.
- **Cross-module data consistency.** When two screens record the same fact (e.g. period-log absences vs daily attendance), writes must propagate: marking an absence in `period_absences` upserts `attendance_records` with `source="period_log"`. Never let two screens show contradictory states for the same student/day. When adding a new write path, check whether a related table records the same business fact and sync it.
- **Collapsed/summary views carry real information.** A summary row must answer "what happened" without expanding — e.g. period-log collapsed rows show roster size, absent-student chips with status, and note preview. A collapsed row showing only a title + status badge is a UX defect.
- **User-facing events write `notifications`.** Any action another user must know about (new message, new incident, approval decision) must also insert a `notifications` row for the recipient profile with correct `type` and `link`. A feed table with no writer is dead data.
- **Same-purpose surfaces share one pattern.** Screens doing the same job (3 attendance screens, all people pickers, all note fields, all status selectors) must use the same control, labels, and ordering. Before adding a new surface, copy the pattern from the existing sibling — do not invent a variant.
- **`subjects` are per-school.** Every full-list `from("subjects")` query (pickers, renders) must `.eq("school_id", <current school>)` — TH and THCS schools share subject names (Toán, Tiếng Anh...), so an unscoped query duplicates the list and mixes levels. `.in("id", ...)` lookups are exempt. Enforced by the checker's `code:unscoped-subjects`.
- **Parent contact channel = email only.** Zalo/SMS are not implemented — do not add UI toggles for them. Announcements go through `sendAnnouncement` (server action) which emails linked parents via `src/lib/email.ts` (Resend). Requires `RESEND_API_KEY` (+ optional `EMAIL_FROM`); without the key the action still saves in-app and reports `emailSkipped`. Parent emails live in `parents.email`.
- **TT22/2021 grade views show HK1/HK2/cả-năm separately.** Any per-subject grade summary must expose ĐTBm HK1, ĐTBm HK2 and ĐTBm cả năm (`semesterAverage`/`yearAverage` in `src/lib/tt22.ts`); comment-assessed subjects render Đạt/Chưa đạt instead. A single blended number hides the regulation's structure.
- **Run `node scripts/check-consistency.mjs` before claiming done.** It enforces: no orphan FKs, period-log↔daily-attendance sync, class coverage, notification wiring, per-school subject uniqueness + scoped queries, parent_students integrity, no raw `<textarea>`, `bare` in table cells, VN name sorting, no raw `toLocale*`, nav naming, no dead buttons. Adding a shared-fact write path or a new people list → extend the script, do not bypass it.

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
