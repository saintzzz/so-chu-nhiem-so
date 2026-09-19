# V. Tư vấn học sinh (`/counseling/*`)

**Vai trò**: GVCN.
**Routes**: `/counseling/intake` `/assessment` `/referral`

## Đặc thù
Dữ liệu nhạy cảm cao — UI phải gọn, không lộ chi tiết ca tư vấn trên danh sách chung.

## Patterns

- **Tiếp nhận** (`intake`): form ghi nhận + bảng ca đang theo dõi. Severity badge: `low`=muted · `medium`=warning · `high`=error · `critical`=error đậm.
- **Đánh giá mức độ** (`assessment`): wizard/stepper đánh giá; status flow `new→assessing→counseling→referred|resolved`.
- **Chuyển tuyến** (`referral`): form chuyển + đơn vị nhận; nhấn mạnh tính bảo mật (note hiển thị cho GVCN phụ trách).
- Không dùng màu đỏ rực cho ca bình thường — tránh stigma; severity chỉ thể hiện qua badge nhỏ.
