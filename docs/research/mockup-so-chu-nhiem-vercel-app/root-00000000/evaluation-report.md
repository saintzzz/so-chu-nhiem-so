# Evaluation Report — mockup-so-chu-nhiem.vercel.app

**Target:** https://mockup-so-chu-nhiem.vercel.app/
**Title:** Sổ Chủ Nhiệm - Mockup
**Recon date:** 2026-09-19
**Method:** Playwright browser recon (1440px desktop, 390px mobile), DOM/accessibility snapshots, computed-style extraction, role switching, interactive navigation sweep.

---

## 1. What the site is

A **Vietnamese K-12 homeroom-teacher digital notebook platform** ("Sổ Chủ Nhiệm" = homeroom register). It digitizes the official GVCN (Giáo viên chủ nhiệm) workflow mandated by Vietnamese schools: class records, attendance, academics, discipline, counseling, parent comms, activities, safety incidents, thi đua (emulation scoring), KPI, and the teacher's own competency self-assessment.

It is a **front-end mockup/prototype**: single URL (`/`), no real backend — auth is a role selector labeled "(demo)", data is seeded mock data (class 8A2, 38 students, THCS Lý Nhân, school year 2026-2027), role switching happens client-side.

## 2. Role-based surfaces (7 roles)

| Role | Nav model | Key screens |
|---|---|---|
| **GVCN** (homeroom teacher) | Sidebar, 13 sections, ~57 sub-screens | Dashboard, I. Hồ sơ lớp học (5), II. Chuyên cần (5), III. Học tập (6), IV. Rèn luyện (3), V. Tư vấn HS (3), VI. Phụ huynh (4), VII. Hoạt động GD (3), VIII. An toàn HS (4), IX. Sổ chủ nhiệm (11), XIII. TKB & Sổ đầu bài (2), X. Thi đua (2), XII. Năng lực GVCN (2) |
| **GVBM** (subject teacher) | Sidebar subset | III. Học tập (Nhập/đồng bộ điểm, Trao đổi GVCN), XIII. TKB & Sổ đầu bài |
| **Tổ trưởng chuyên môn** (dept head) | Sidebar | Tổ chuyên môn: Trang chủ, DS giáo viên, Duyệt đánh giá năng lực, Sinh hoạt chuyên môn |
| **BGH** (school board) | Sidebar | Quản trị, Dashboard cấp trường, Radar cảnh báo sớm, VII/VIII/IX/XIII/X (school-level views) |
| **Quản trị Sở GD&ĐT** (dept. of education admin) | Sidebar | Quản trị người dùng, Dashboard cấp Sở, XI. Quản trị dữ liệu |
| **Phụ huynh** (parent) | Portal, no sidebar | "Cổng phụ huynh" — child's attendance today, monthly attendance %, latest GPA, notifications, teacher appointments |
| **Học sinh** (student) | Portal, no sidebar | Similar portal (not yet screenshotted) |

**Estimated total screen count:** ~70+ distinct views across roles.

## 3. Feature inventory (what's simulated)

- **Login** — username/password fields + demo role combobox (no real auth).
- **Dashboard (GVCN)** — greeting, quick actions (Điểm danh, Ghi nhận tuyên dương), 10 KPI stat cards (clickable), "Việc cần làm hôm nay" task list, monthly GPA line chart (SVG, data-table toggle), activity feed.
- **Attendance (II)** — daily roster, 38 students, radio status per student (Có mặt / Vắng có phép / Vắng không phép / Đi muộn), auto-merge from Sổ đầu bài (XIII), summary counters.
- **Class records (I)** — class list per school year, intake flow, student profile upload, update history, AI summary report.
- **Seating chart (IX — Sơ đồ lớp)** — drag-drop grid, configurable up to 12×12, default 8×5 for 38 students, "Tuyên dương" (commendation) mode, copy from previous month, export PDF/PNG, version history.
- **Roster & groups** — student table with Tổ (group) assignment, BCS roles (Lớp trưởng/phó/tổ trưởng), điểm tích cực, pagination.
- **BGH school dashboard** — school-level KPIs, per-class thi đua bar chart, early-warning radar, incident feed.
- **Parent portal** — read-only child status + notifications + appointments.
- **Cross-cutting** — quick search (Ctrl+K), notifications (unread badge), role switcher, collapsible sidebar, breadcrumbs, accordion nav.

## 4. Interaction classification

- **Click-driven:** all navigation (SPA, no URL routes — state-based view switching), accordion nav, stat cards, status radios, dropdowns.
- **Drag-drop:** seating chart (Sơ đồ lớp).
- **Keyboard:** Ctrl+K quick search.
- **Not observed:** real-time updates, websockets, server persistence (mockup).

## 5. Design tokens (extracted, computed)

```css
--color-bg: #FFFFF5        /* ivory */
--color-surface: #FFFFFF
--color-border: #E7E2D6
--color-text: #1A2233      /* navy-ink */
--color-text-muted: #6B7280
--color-primary: #1E3A5F   /* navy */
--color-primary-hover: #16283F
--color-accent: #B91C1C    /* red */
--color-success: #059669   / bg #ECFDF5
--color-warning: #D97706   / bg #FFFBEB
--color-error: #DC2626     / bg #FEF2F2
--color-primary-bg: #EAF0F7
--font-display/body: "Figtree", system-ui, sans-serif
--font-mono: "IBM Plex Mono", monospace
Type scale: 12/14/16/18/24/30/36
Spacing: 4/8/12/16/24/32/48/64
Radius: 4/8/12/16/full
Shadows: sm/md/lg (navy-tinted)
```

**Visual style:** clean institutional SaaS — ivory background, white cards, navy primary, red accent for warnings, semantic color-coded statuses. Vietnamese UI text throughout.

## 6. Responsive behavior

- **1440px:** full sidebar + header + multi-column dashboard grids.
- **390px:** hamburger menu, stacked layout, horizontal-scroll for wide tables/grids (seating chart scrolls), buttons full-width stacked.

## 7. Technical assessment

| Aspect | Finding |
|---|---|
| Frontend stack (target) | React SPA, single route `/`, SVG charts (custom, not a lib), CSS vars |
| Backend | **None** — all state client-side, seeded data |
| Complexity | **Very high screen count** (~70 views), moderate per-screen complexity |
| Hardest components | Drag-drop seating chart + PDF/PNG export; per-student radio roster; multi-role view gating |
| Feasibility in our stack | Next.js 16 + shadcn + Tailwind v4 — all patterns standard; dnd via `@dnd-kit`; PDF export via print CSS or jsPDF |

## 8. Scope options (for PM Q&A)

- **Option A — Full mockup parity:** all 7 roles, ~70 screens, client-state only. Huge effort, high fidelity.
- **Option B — GVCN core MVP:** GVCN role only, ~15-20 key screens (dashboard, attendance, seating chart, records, grade analysis, parent comms, safety, sổ chủ nhiệm). Recommended.
- **Option C — MVP + real backend:** Option B + Supabase (auth, DB, RLS) for real persistence. Largest effort.

## 9. Risks

1. **Screen count** — full parity is days of work even with parallel builders.
2. **Hidden states** — mockups may have modals/flows not yet discovered; each screen needs interaction sweep during build.
3. **Vietnamese content** — large amount of real seeded data (38 students × many views) must be reproduced, not approximated.
4. **Node version** — repo requires Node ≥24, environment has 22.19.0 — build may need runtime upgrade.
5. **Console error** — 1 error on target (likely font/analytics); verify non-blocking.

## 10. Assets

- Fonts: Figtree, IBM Plex Mono (Google Fonts — freely available).
- No raster images observed; icons appear to be SVG/Lucide-style. Logo is a graduation-cap SVG.
- Charts: inline SVG, no external chart lib needed.

## 11. Screenshots captured

- `desktop-1440-full.png` — login
- `gvcn-dashboard.png` — GVCN dashboard
- `gvcn-diem-danh.png` — attendance roster
- `phu-huynh-portal.png` — parent portal
- `mobile-390.png` — mobile seating chart
