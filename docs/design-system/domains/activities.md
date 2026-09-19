# VII. Hoạt động giáo dục (`/activities/*`)

**Design language**: `Material 3` — theme `.theme-material` scoped trên vùng nội dung (xem `../README.md` → "Design language theo domain").

**Vai trò**: GVCN (lập kế hoạch), BGH (phê duyệt), HS/PH (đăng ký).
**Routes**: `/activities/plan` `/announce` `/attendance`

## Patterns

- **Kế hoạch** (`plan`): bảng hoạt động theo status flow `draft→pending→approved→done|cancelled`. BGH thấy nút Duyệt/Từ chối inline trên hàng `pending`.
- **Thông báo & đăng ký** (`announce`): card hoạt động + số lượng đăng ký/tổng slot.
- **Điểm danh & đánh giá** (`attendance`): giống điểm danh chuyên cần — trạng thái per HS + nhận xét sau hoạt động.

## Status màu
`draft`=muted · `pending`=warning · `approved`=primary · `done`=success · `cancelled`=muted gạch ngang.
