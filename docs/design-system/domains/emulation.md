# X. Thi đua (`/emulation/*`)

**Vai trò**: GVCN (chấm), BGH (xem xếp hạng).
**Routes**: `/emulation/scoring` `/ranking`

## Patterns

- **Thu thập & tính điểm** (`scoring`): bảng tiêu chí × lớp, nhập điểm số per tiêu chí theo kỳ (`period`).
- **Xếp hạng** (`ranking`): bảng xếp hạng lớp — hạng 1/2/3 nhấn (badge vàng/xám/đồng), cột tổng điểm bold.
- Kỳ thi đua: `week:YYYY-Wnn` / `month:YYYY-MM` — label hiển thị "Tuần n" / "Tháng m/yyyy".

## Nguyên tắc
Điểm thi đua luôn kèm tên tiêu chí; không chỉ số. Xếp hạng realtime sau khi lưu.
