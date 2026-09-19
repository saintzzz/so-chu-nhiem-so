# VI. Phụ huynh (`/parents/*`)

**Design language**: `Material 3` — theme `.theme-material` scoped trên vùng nội dung (xem `../README.md` → "Design language theo domain").

**Vai trò**: GVCN (soạn/gửi), BGH (CMHS), PH (cổng — xem `portals.md`).
**Routes**: `/parents/compose` `/inbox` `/appointments` `/portal` `/cmhs`

## Patterns

- **Soạn thông báo** (`compose`): form 2 vùng — meta (lớp/đối tượng/tiêu đề) trái, preview nội dung phải.
- **Hộp thư** (`inbox`): danh sách phản hồi PH, unread = dot primary + bold; click đánh dấu đã đọc.
- **Lịch hẹn** (`appointments`): bảng theo `scheduled_at` desc; status `proposed`=warning · `confirmed`=primary · `done`=success · `cancelled`=muted.
- **Cổng PH** (`portal` — góc nhìn GVCN): xem PH đã xem gì, cấu hình hiển thị.
- **CMHS** (`cmhs`): quản lý ban đại diện cha mẹ HS — vai trò badge, liên hệ.

## Nguyên tắc
Nội dung gửi PH luôn có preview trước khi gửi — copy vi-VN lịch sự, gọi phụ huynh là "Quý phụ huynh".
