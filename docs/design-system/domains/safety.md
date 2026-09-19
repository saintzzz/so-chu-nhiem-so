# VIII. An toàn học sinh (`/safety/*`)

**Vai trò**: GVCN (ghi nhận/theo dõi), BGH (toàn trường).
**Routes**: `/safety/report` `/bgh` `/followup` `/archive`

## Patterns

- **Ghi nhận sự cố** (`report`): form nhanh — loại sự cố, mức độ, thời điểm, mô tả; checkbox "Báo BGH" đánh dấu `reported_to_bgh`.
- **Báo cáo BGH** (`bgh`): dashboard sự cố toàn trường — filter severity/status; severity `critical` nhấn đỏ + ưu tiên đầu bảng.
- **Theo dõi** (`followup`): case card theo status `new→following→resolved→archived`, timeline nhắc việc.
- **Lưu trữ** (`archive`): bảng tra cứu read-only, footer pagination.

## Nguyên tắc
Severity luôn kèm label chữ (không chỉ màu) vì accessibility. Sự cố critical báo BGH ngay — nút CTA đỏ `destructive`.
