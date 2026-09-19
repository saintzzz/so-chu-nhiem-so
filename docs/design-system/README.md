# Sổ Chủ Nhiệm Số — Design System

Design system tổ chức **theo domain nghiệp vụ** (khớp cấu trúc sidebar `src/lib/nav.ts`).
File này chứa foundations dùng chung; mỗi domain có file riêng trong thư mục này.

## Domains

| File | Domain (nav section) | Vai trò chính | Design language |
|---|---|---|---|
| `domains/records.md` | I. Hồ sơ lớp học | GVCN, BGH | Fluent |
| `domains/attendance.md` | II. Chuyên cần | GVCN | Fluent |
| `domains/academics.md` | III. Học tập | GVCN, GVBM, BGH | Fluent |
| `domains/conduct.md` | IV. Rèn luyện | GVCN, BGH | Material 3 |
| `domains/counseling.md` | V. Tư vấn học sinh | GVCN | Material 3 |
| `domains/parents.md` | VI. Phụ huynh | GVCN, PH | Material 3 |
| `domains/activities.md` | VII. Hoạt động GD | GVCN, BGH | Material 3 |
| `domains/safety.md` | VIII. An toàn HS | GVCN, BGH | Material 3 |
| `domains/register.md` | IX. Sổ chủ nhiệm | GVCN, BGH | Fluent |
| `domains/schedule.md` | XIII. TKB & Sổ đầu bài | Mọi giáo viên, BGH | Fluent |
| `domains/emulation.md` | X. Thi đua | GVCN, BGH | Material 3 |
| `domains/competency.md` | XII. Năng lực GVCN | GVCN, Tổ trưởng | Material 3 |
| `domains/admin.md` | Quản trị (BGH / Sở GD) | BGH, Sở GD, admin | Fluent (dashboard/radar: Apple) |
| `domains/portals.md` | Cổng PH / HS + Dashboard | Phụ huynh, học sinh | Apple HIG |

## Design language theo domain

Mỗi domain dùng design system phù hợp bản chất workflow, implement qua theme
scope `.theme-fluent` / `.theme-material` / `.theme-apple` trong `globals.css`.
Mapping route → theme nằm ở `src/lib/domain-theme.ts`; `AppShell` gắn class
theme lên vùng nội dung `<main>` (chrome sidebar/topbar giữ base tokens trung
lập để điều hướng không "đổi da" mỗi khi chuyển domain).

| Language | Nguồn | Đặc trưng token | Domains |
|---|---|---|---|
| **Fluent 2** (Microsoft) | fluentui.microsoft.com | Segoe UI · `#0F6CBD` · radius 4px · nền `#FAF9F8` · depth-shadow nhỏ | Bảng/form dày: records, attendance, academics, register, schedule, admin |
| **Material 3** (Google) | m3.material.io | Roboto · `#6750A4` + tonal container `#EADDFF` · radius 16px · nền `#FDF8FD` | Workflow con người: conduct, counseling, parents, activities, safety, emulation, competency |
| **Apple HIG** | developer.apple.com/design | SF/system font · `#007AFF` · radius 14px · nền grouped-list `#F5F5F7` · shadow tối thiểu | Màn hình "đọc": dashboard, portal PH/HS, school dashboard/radar |

Quy tắc khi thêm trang mới: thêm prefix vào `DOMAIN_THEME_MAP` theo domain —
không tự ý trộn language trong cùng một domain.

## Foundations

### Màu sắc (CSS tokens — `globals.css`)

| Token | Hex | Dùng |
|---|---|---|
| `background` | `#FFFFF5` ivory | Nền trang |
| `card` | `#FFFFFF` | Card, bảng |
| `border` | `#E7E2D6` | Viền card/bảng |
| `foreground` | `#1A2233` | Text chính |
| `muted-foreground` | `#6B7280` | Text phụ, label |
| `primary` | `#1E3A5F` navy | CTA, header nhấn |
| `accent` / đỏ | `#B91C1C` | Nhấn phụ |
| `success` | `#059669` | Đạt/Tốt/xác nhận |
| `warning` | `#D97706` | Cảnh báo |
| `error`/`destructive` | `#DC2626` | Lỗi, vi phạm nặng |

Quy ước tone badge: `success` = trạng thái tốt/đã duyệt · `warning` = đang xử lý/cần chú ý · `error` = vi phạm/chưa đạt · `primary` = thông tin trung lập · `muted` = đã đóng/lưu trữ.

### Typography

- Body/display: **Figtree**. Mono (mã HS, mã định danh, số liệu cột ID): **IBM Plex Mono**.
- Heading trang: `PageHeader` (section kicker + title + description + actions).
- Bảng mật độ cao: `text-sm`, header `text-xs uppercase tracking-wide`.

### Spacing / radius

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Radius: `rounded-lg` (input), `rounded-xl` (card), `rounded-full` (badge/filter pill).
- Shadow: `shadow-[var(--shadow-sm-token)]` trên card.

### Components dùng chung

| Component | File | Dùng cho |
|---|---|---|
| `PageHeader` | `components/page-header.tsx` | Đầu mọi trang |
| `DataTable` | `components/data-table.tsx` | Bảng mật độ cao, footer nhẹ |
| `StatusBadge` + `FLOW_STATUS` | `components/status-badge.tsx` | Trạng thái nghiệp vụ |
| `StatCard` | `components/stat-card.tsx` | KPI tóm tắt trên đầu trang |
| `FilterSelect` | `components/academics/filter-select.tsx` | Filter lớp/môn/kỳ qua URL params |
| `Button` | `components/ui/button.tsx` | CTA — `[data-slot="button"]` |
| `ChartCard` / `LineChart` / `BarChart` | `components/charts.tsx` | Biểu đồ SVG tự build |

### Component signature theo design language

| Element | Fluent | Material 3 | Apple HIG |
|---|---|---|---|
| Button | Vuông 4px | **Pill 999px** | Bo 11px |
| Table row hover | `#F5F3F1` (DataGrid) | `#F3EDF7` (state layer) | `rgba(0,0,0,.025)` |
| Heading | — | — | `letter-spacing: -0.02em` |
| Radius base | 4px | 16px | 14px |
| Font | Segoe UI | Roboto | SF/system |
| Accent | `#0F6CBD` | `#6750A4` | `#007AFF` |

Implement: CSS scoped trong `@layer theme-overrides` (`globals.css`) — selector `.theme-<lang> [data-slot="button"]`, `.theme-<lang> tbody tr:hover`… Không sửa component.

### Iconography

- Thư viện: **lucide-react** (outline, stroke 2px) — đủ trung lập cho cả 3 design language.
- Size: `size-4` (16px) section nav + nút · `size-3.5` (14px) item con · `size-4` trong Button.
- Map icon: `src/lib/nav-icons.ts` — `SECTION_ICONS` (theo label section) + `ITEM_ICONS` (theo label item) + `FALLBACK_ICON`.
- Quy ước chọn icon: danh từ vật lý gần nghiệp vụ nhất (điểm danh → `CheckCheck`, sổ chủ nhiệm → `NotebookPen`, radar → `Radar`); **không** dùng emoji trong UI; AI features → `Sparkles`/`Lightbulb`.
- Trạng thái không dùng icon riêng — dùng `StatusBadge` text+tone.

### Charts

- Tự build SVG (`components/charts.tsx`), không dùng chart lib — nhẹ, kiểm soát token trực tiếp.
- Palette: `--chart-1..5` **đổi theo theme** (Fluent: xanh enterprise `#0F6CBD`/`#107C10`… · Material: tonal `#6750A4`/`#006A6A`… · Apple: system `#007AFF`/`#34C759`…).
- `BarChart`: cột `rx=6`, màu xoay vòng chart-1..5, `<title>` tooltip + hover `opacity-75`, label giá trị trên đỉnh cột.
- `LineChart`: line `var(--chart-1)` 2.5px bo đầu, **area gradient** mờ dần xuống 0, dot viền trắng + `<title>` tooltip, gridline `stroke-dasharray` nhẹ.
- Accessibility: mọi chart bọc `ChartCard` với `ariaDescription` + `tableContent` fallback (bảng dữ liệu).

### Motion

- Chỉ `transition` màu/shadow 100–150ms `ease-out` (row hover, card hover-lift, button active `translate-y-px`).
- Không animation nhạy cảm; `prefers-reduced-motion` tắt toàn bộ transition trong vùng theme.

### Naming conventions

| Lớp | Quy ước | Ví dụ |
|---|---|---|
| File component | `kebab-case.tsx` | `grades-editor.tsx` |
| Component | `PascalCase`, named export | `GradesEditor` |
| Util/lib | `camelCase`, `kebab-case.ts` | `semesterAverage`, `domain-theme.ts` |
| Route | `kebab-case` tiếng Anh theo domain | `/academics/grades`, `/register/signoff` |
| DB table/column | `snake_case` tiếng Anh | `competency_evaluations`, `national_id` |
| CSS token | `--color-*` / `--shadow-*-token` | `--color-primary-bg` |
| Class theme | `.theme-<language>` | `.theme-material` |
| Copy UI | tiếng Việt chuẩn ngành GD | "ĐĐGtx", "ĐTBm", "Xếp loại" |
| Vai trò (code) | snake_case key + label VI | `gvcn` → "GVCN (Giáo viên chủ nhiệm)" |
| Icon map key | đúng `label` trong `nav.ts` | `ITEM_ICONS["Nhập / đồng bộ điểm"]` |

### Pattern nhập liệu (data-entry editors)

Áp dụng cho sổ điểm, hạnh kiểm, điểm danh, TKB, lịch thi:

1. **Toolbar trên bảng**: `Tải template` → `Import Excel` → `Lưu` (primary, ngoài cùng phải). Status lưu/import/lỗi hiển thị inline cùng hàng.
2. Template Excel dùng `downloadXlsxTemplate` (`src/lib/excel.ts`) — header bold, cột đủ rộng, prefill dữ liệu hiện có.
3. Import qua `parseSpreadsheet` — nhận `.xlsx`/`.csv`, **map cột theo tên header** (không theo vị trí cố định) để tương thích mẫu biểu ngành lẫn template nội bộ.
4. Định danh học sinh: ưu tiên `national_id` (Mã định danh Bộ GD&ĐT, 10 số) → fallback `code` nội bộ → fallback `họ tên + ngày sinh`. Báo rõ dòng không khớp.
5. Footer bảng chỉ chứa metadata nhẹ (sĩ số, số dòng).
6. Lưu theo pattern delete+insert theo `(lớp/môn/kỳ)` — idempotent, an toàn khi sửa lại.

### States bắt buộc

Mọi interactive component: `default / hover / focus-visible / active / disabled / loading / empty / error`.
- Empty: text `text-muted-foreground` + gợi ý hành động.
- Error: `text-error` inline hoặc `bg-error-bg` banner.
- Loading: disable nút + label "Đang …".

### Accessibility

- Semantic table (`<th>` header, `aria-label` cho input lặp trong bảng).
- Keyboard: tab order theo hàng; select/input native.
- Contrast tối thiểu 4.5:1; touch target ≥ 44px trên mobile.
- `prefers-reduced-motion` tôn trọng.

### Responsive

- Staff (GVCN/BGH): desktop-first, bảng `overflow-x-auto` trên mobile.
- Cổng PH/HS: mobile-first (xem `domains/portals.md`).

### Internationalization

- Toàn bộ copy tiếng Việt `vi-VN`; ngày `toLocaleDateString("vi-VN")`.
- Thuật ngữ chuẩn ngành: ĐĐGtx/ĐĐGgk/ĐĐGck, ĐTBm, KQ rèn luyện, mức T/H/C (tiểu học).
