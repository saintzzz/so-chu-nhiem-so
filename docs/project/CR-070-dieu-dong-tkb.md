# CR-070: Điều động giáo viên gắn `timetable_entry` (phân công lại TKB)

## Bối cảnh / vì sao

Nghiệp vụ điều động (GV mới đến thay, GV bị điều động đi giữa năm, phân công
lại tiết dạy) hiện chưa có đường dữ liệu: `timetable_entries.teacher_id` là
phân công gốc duy nhất, `substitute_requests` chỉ cover dạy thay **theo ngày
lẻ**. Điều động là quyết định **có hiệu lực theo khoảng thời gian** gắn vào
từng ô TKB cụ thể - phải auditable và đảo ngược được, không ghi đè mất phân
công gốc.

## Scope

- `dd_assignments`: overlay có hiệu lực ngày trên `timetable_entries`
  - `effective_from` -> `effective_to` (null = không thời hạn)
  - state machine: `pending -> active -> ended` (+ `cancelled`)
  - không cho 2 phân công trùng khoảng ngày trên cùng entry (check trong RPC,
    lock hàng entry để serialize)
- RPC: `dd_create` / `dd_approve` / `dd_end` / `dd_cancel` (bgh|admin|pht) +
  `dd_effective_teacher(entry, date)` cho consumer sau này (sổ đầu bài, điểm danh)
- RLS: staff quản lý đọc hết; GV đọc phân công của mình; GVCN đọc entry lớp mình
- Module gate `dieu_dong` (school_features opt-out) trong RLS + RPC
- Notify GV được điều động khi approve
- UI `/schedule/mobilization`: chọn lớp -> lưới TKB -> tạo điều động ->
  duyệt/kết thúc; hiển thị overlay "GV gốc -> GV điều động"

## Không scope

- Chưa thay resolution trong sổ đầu bài/điểm danh (consumer đọc
  `dd_effective_teacher` ở CR kế tiếp nếu cần).
- Điều động sang trường khác (liên trường) - khác domain với biến động HS.

## Impact

Bảng + trigger + RLS + 5 RPC mới; không đụng bảng/logic cũ (additive).
`dieu_dong` thêm vào MODULES + nav.
