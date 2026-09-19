# II. Chuyên cần (`/attendance/*`)

**Vai trò**: GVCN (lớp mình), BGH (giám sát).
**Routes**: `/attendance/daily` `/leaves` `/notify` `/tracking` `/history`

## Mục đích
Điểm danh ngày, quản lý nghỉ/đi muộn, cảnh báo phụ huynh, theo dõi học sinh có nguy cơ.

## Vocabulary màu

| Trạng thái | Badge tone |
|---|---|
| `present` Có mặt | success |
| `late` Đi muộn | warning |
| `excused` Nghỉ phép | primary |
| `unexcused` Nghỉ không phép | error |

## Patterns

- **Điểm danh ngày** (`daily`): nút chọn trạng thái per-row (4 trạng thái), toolbar trên bảng gồm template/import + `Xác nhận chuyên cần hôm nay` + badge "Có thay đổi chưa lưu".
- **Theo dõi tình trạng** (`tracking`): bảng học sinh có % chuyên cần thấp — tone đỏ khi <80%, vàng <90%.
- **Thông báo PH** (`notify`): compose form → danh sách đã gửi; hiển thị kênh gửi trong cột meta.
- Mọi bảng chuyên cần hiển thị % = `(present + late) / total` làm tròn nguyên.
