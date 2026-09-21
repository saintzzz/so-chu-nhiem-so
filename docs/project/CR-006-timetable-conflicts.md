# CR-006 - Chuẩn hoá TKB: xoá xung đột phân công giáo viên

Ngày: 21/09/2026 · Nguồn: phát hiện khi verify CR-005 + user duyệt · Trạng thái: đã duyệt

## 1. Vấn đề

TKB seed hiện tại sinh **cùng một layout cho mọi lớp trong trường**: 9 lớp THCS Nguyễn Du có gần như giống hệt thời khoá biểu (cùng môn, cùng tiết, cùng GV). Hệ quả: 1 GV bị phân dạy 8-9 lớp **cùng slot** (tối đa 11 lớp - Thể dục Thứ 3 tiết 5). Không thể tồn tại trong thực tế.

Số liệu: 357 entries, 12 lớp (9 THCS + 3 TH), 25 GV, 17 môn. `teacher_subjects` có 39 mapping đủ rải cho nhiều môn nhưng một số môn chỉ 1-2 GV được gán.

## 2. Giải pháp (đã duyệt theo yêu cầu "có làm CR")

Không đổi schema. Script `scripts/fix-timetable-conflicts.mjs` chạy 2 pha:

**Pha 1 - So le layout từng lớp**: với mỗi lớp, giữ nguyên tập môn + số tiết/tuần (chương trình không đổi) nhưng **xếp lại slot** (weekday/period) sao cho nhu cầu cùng-môn-cùng-slot giữa các lớp tối thiểu (greedy: chọn slot có ít entry cùng môn nhất đã đặt trên toàn trường, rải đều theo ngày). 3 entry đã có `period_logs` được đóng băng slot để không mất đồng bộ sổ đầu bài.

**Pha 2 - Phân công lại GV theo slot**: tại mỗi (weekday, period), gán `teacher_id` cho từng entry từ pool GV đủ điều kiện (`teacher_subjects` hoặc đã dạy môn đó), rảnh ở slot đó, ưu tiên ít tải nhất. Pool thiếu → mở rộng `teacher_subjects` (bổ sung GV cùng trường ít tải nhất - tương đương trường điều chỉnh phân công chuyên môn). Lớp TH ưu tiên GVCN của lớp (mô hình tiểu học: CN dạy đa môn).

Ràng buộc giữ nguyên: ≤1 entry/lớp/slot, chương trình tuần của từng lớp không đổi, phòng giữ nguyên.

## 3. Impact

| Hạng mục | Ảnh hưởng |
|---|---|
| `timetable_entries` | UPDATE weekday/period/teacher_id ~354 dòng |
| `teacher_subjects` | INSERT thêm mapping khi pool thiếu |
| `period_logs` | 3 entry đóng băng slot - không desync |
| period_absences/attendance | Không đụng (theo date + student) |
| Code | Không sửa app; chỉ thêm script maintenance |

## 4. Verify (đã apply 21/09)

| Chỉ số | Kết quả |
|---|---|
| Teacher conflicts (`teacher,weekday,period` count>1) | **0** |
| Class double-slots (`class,weekday,period` count>1) | **0** |
| Residual unassigned (teacher_id null) | **0** |
| `timetable_entries` | 357 → 357 (không đổi) |
| `period_logs` | 2/2 nguyên vẹn (log mất do apply lần 1 đã khôi phục) |
| `teacher_subjects` | 43 → 44 (+1 mapping mở rộng pool) |

Apply report: `moved=337, retaught=47, updates=340, teacher_subjects +1, deleted/reinserted 340/340`.

### Sự cố apply lần 1 + khắc phục

- Apply đầu thất bại: `duplicate key ... timetable_entries_class_id_weekday_period_key` khi delete+reinsert vì slot đích còn bị chiếm. Fix: phân tách **slot-unchanged → UPDATE in place**, **slot-changed → DELETE+INSERT giữ id**, đóng băng entry đã được `period_logs` tham chiếu.
- Side-effect lần 1: 1 `period_log` (7A1, 18/09, GVBM Trần Văn Minh) mất do cascade khi entry bị delete dù chỉ đổi teacher. Đã khôi phục: log + `period_absences` của Đặng Quốc Anh (`unexcused`, đã có `attendance_records` sync sẵn). Script đã vá: entry không đổi slot (kể cả frozen đổi teacher) không bao giờ vào danh sách delete.

### Verify trên production (Playwright)

- GVCN `?view=me`: **0 ô amber conflict** - mỗi slot đúng 1 tiết, rải đều trong tuần.
- Lịch lớp 6A3 (chủ nhiệm): không trùng slot, phân bố ngày hợp lý.
