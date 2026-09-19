# Design Brief — Sổ Chủ Nhiệm Số

**Phase 3 output — UX Designer** | Clone-parity project: design direction comes from target extraction; this documents what's copied, what's adapted, and why.

## 1. Context

- **Audience:** giáo viên/nhà trường VN — tech literacy trung bình-thấp, dùng cả desktop (GVCN nhập liệu) lẫn mobile (PH/HS xem nhanh). Dense data workflows.
- **Domain:** edu-gov — institutional, trust-first, high density acceptable, minimal decoration.
- **Locale:** vi-VN, diacritics đầy đủ, text expansion ~20-30% vs EN.
- **Platform:** responsive web; desktop-first cho staff, mobile-first cho portals.

## 2. Design direction: COPY from target (rationale)

Target đã có design system sạch, phù hợp domain — parity là yêu cầu. **Copy 100% tokens; adapt chỉ những điểm bắt buộc.**

### Copied as-is
| Element | Spec |
|---|---|
| Color | bg `#FFFFF5` ivory, surface `#FFF`, border `#E7E2D6`, text `#1A2233`, muted `#6B7280`, primary `#1E3A5F` navy, hover `#16283F`, accent `#B91C1C`, success `#059669`, warning `#D97706`, error `#DC2626` + bg variants |
| Type | Figtree display+body, IBM Plex Mono mono; scale 12/14/16/18/24/30/36 |
| Space | 4/8/12/16/24/32/48/64 |
| Radius | 4/8/12/16/full |
| Shadow | sm/md/lg navy-tinted |
| Layout | sidebar 260px-ish accordion, topbar, card-based content, stat-card grids |
| Components | buttons (primary navy/secondary ghost), inputs, combobox, radio groups, tables, badges (status colors), cards, modal, chart SVG + data-table toggle |
| Patterns | accordion nav, breadcrumb, Ctrl+K palette, notif badge, empty/loading states |

### Adapted (deviations from target)
| What | Target | Ours | Why |
|---|---|---|---|
| App name/logo text | "Sổ Chủ Nhiệm" | "Sổ Chủ Nhiệm Số" | Branding mới (user choice) |
| Auth | Demo role select, no real auth | Supabase Auth login thật + demo accounts per role | Backend thật |
| Data | Seeded target data (8A2, 38 HS, THCS Lý Nhân) | Data mới (THCS Nguyễn Du, ~8 lớp, ~300 HS) | User choice |
| AI features | Mocked AI suggestions | Rule-based simulation + label "gợi ý" | Out of scope AI thật |
| Routes | SPA single `/` | Real Next.js routes `/dashboard`, `/attendance`, … | SEO/bookmark/deep-link tốt hơn, Next.js idiom — UX giữ nguyên sidebar model |

### Not copied
- Không copy target's seeded names/data (privacy + user chose new data)
- Console error trên target (bug của họ, không reproduce)

## 3. Information architecture

Giữ nguyên 13-section sidebar của GVCN + role-specific navs (sitemap.md). Route map:

```
/login
/(app)/dashboard
/(app)/records/*          I. Hồ sơ lớp học
/(app)/attendance/*       II. Chuyên cần
/(app)/academics/*        III. Học tập
/(app)/conduct/*          IV. Rèn luyện
/(app)/counseling/*       V. Tư vấn
/(app)/parents/*          VI. Phụ huynh
/(app)/activities/*       VII. Hoạt động GD
/(app)/safety/*           VIII. An toàn
/(app)/register/*         IX. Sổ chủ nhiệm (+ seating)
/(app)/schedule/*         XIII. TKB & Sổ đầu bài
/(app)/emulation/*        X. Thi đua
/(app)/competency/*       XII. Năng lực GVCN
/(admin)/school/*         BGH views
/(admin)/dept/*           Sở GD&ĐT views
/portal/parent, /portal/student
```

## 4. Component inventory (to spec during build)

`AppShell` (sidebar+topbar), `SidebarNav` (accordion), `Topbar` (breadcrumb/search/notif/role), `StatCard`, `DataTable` (pagination, inline controls), `StatusBadge`, `RadioRoster` (attendance), `SeatingGrid` (dnd), `Chart` (line/bar SVG + table toggle), `Modal`, `Drawer` (mobile nav), `CommandPalette`, `NotifDropdown`, `EmptyState`, `PageHeader` (title+subtitle+actions), `FormField`, `Select`, `Tabs`, `ActivityFeed`, `TaskList`.

## 5. Interaction state matrix (required per component)

Mỗi interactive component phải có: default / hover / focus-visible / active / disabled / loading / empty / error. Form: validation error inline vi-VN. Destructive: confirm modal.

## 6. Accessibility

- Semantic: `nav`/`main`/`banner`, heading hierarchy, aria-labels cho icon buttons
- Keyboard: tab order đúng, Ctrl+K, Esc đóng modal/drawer, focus trap trong modal
- Contrast: navy `#1E3A5F` trên ivory — đo đạc khi build (target đạt AA trên các pair chính)
- `prefers-reduced-motion` cho drag/transition
- Touch targets ≥44px mobile

## 7. Microcopy

- vi-VN toàn bộ; giữ terminology của target (GVCN, GVBM, BGH, chuyên cần, thi đua, sổ đầu bài, sổ chủ nhiệm…)
- Tone: trang trọng, rõ ràng, hành động rõ ràng ("Điểm danh lớp", "Ghi nhận tuyên dương")

## 8. Design Lead review notes

- Parity approach hợp lý: không re-invent, copy tokens + adapt branding/auth/routes.
- Route real-URL là cải tiến đúng (deep-link) — không ảnh hưởng visual parity.
- Yêu cầu: mọi màn build phải check state matrix + a11y spec này; Designer re-review khi Dev xong từng module lớn.
- Risk: drag-drop seating chart cần keyboard fallback (move qua select) — note cho Dev.
