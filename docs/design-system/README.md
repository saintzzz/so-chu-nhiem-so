# Sổ Chủ Nhiệm Số — Design System

Design system tổ chức **theo domain nghiệp vụ** (khớp cấu trúc sidebar `src/lib/nav.ts`).
File này chứa foundations dùng chung; mỗi domain có file riêng trong thư mục này.

## Domains

| File | Domain (nav section) | Vai trò chính |
|---|---|---|
| `domains/records.md` | I. Hồ sơ lớp học | GVCN, BGH |
| `domains/attendance.md` | II. Chuyên cần | GVCN |
| `domains/academics.md` | III. Học tập | GVCN, GVBM, BGH |
| `domains/conduct.md` | IV. Rèn luyện | GVCN, BGH |
| `domains/counseling.md` | V. Tư vấn học sinh | GVCN |
| `domains/parents.md` | VI. Phụ huynh | GVCN, PH |
| `domains/activities.md` | VII. Hoạt động GD | GVCN, BGH |
| `domains/safety.md` | VIII. An toàn HS | GVCN, BGH |
| `domains/register.md` | IX. Sổ chủ nhiệm | GVCN, BGH |
| `domains/schedule.md` | XIII. TKB & Sổ đầu bài | Mọi giáo viên, BGH |
| `domains/emulation.md` | X. Thi đua | GVCN, BGH |
| `domains/competency.md` | XII. Năng lực GVCN | GVCN, Tổ trưởng |
| `domains/admin.md` | Quản trị (BGH / Sở GD) | BGH, Sở GD, admin |
| `domains/portals.md` | Cổng PH / HS | Phụ huynh, học sinh |

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
| `Button` | `components/ui/button.tsx` | CTA |

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
