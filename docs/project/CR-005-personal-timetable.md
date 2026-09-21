# CR-005 - Xem thời khóa biểu theo cá nhân / lớp chủ nhiệm

Ngày: 21/09/2026 · Nguồn: yêu cầu user · Trạng thái: DONE (21/9/2026)

Commits: `2e96bb3`, `9eaf0b9` (hiện tất cả tiết trùng slot), `3ae54c0` (tôn trọng ?view=class tường minh). Verify E2E production: GVCN chỉ thấy 6A3(CN), GVBM default lịch cá nhân, ô `Lớp · Môn · Phòng`, empty states - xem `docs/qa/TESTCASES.md` đợt CR-005.

Phát hiện ngoài scope: TKB seed có xung đột GV (1 GV dạy 8-9 lớp cùng slot) - cần CR riêng chuẩn hoá dữ liệu/phân công TKB.

## 1. Nhu cầu

> "Giáo viên chủ nhiệm thì cần xem lịch theo cá nhân hoặc theo lớp được chủ nhiệm"

Hiện tại `/schedule/timetable` chỉ có **một chế độ xem theo lớp**: hiển thị chips tất cả lớp trong trường, mặc định lớp GVCN phụ trách (nếu có). Giáo viên **không có cách nào xem lịch dạy của chính mình** - họ phải mở từng lớp để biết mình dạy tiết nào.

Trong thực tế, một GV vừa là GVCN lớp A vừa dạy bộ môn ở nhiều lớp khác - hai chế độ xem đều cần thiết:
- **Theo lớp chủ nhiệm**: xem TKB đầy đủ của lớp mình quản lý (môn nào, GV nào, phòng nào).
- **Theo cá nhân**: xem toàn bộ tiết mình dạy trong tuần, mỗi ô hiển thị lớp + môn + phòng.

## 2. Phạm vi đề xuất

### Thay đổi

- `/schedule/timetable` thêm **bộ chuyển chế độ xem** (view mode):
  - **Lịch cá nhân** (`?view=me`): grid tuần gộp tất cả `timetable_entries` có `teacher_id = profile.id`. Mỗi ô hiển thị `Lớp - Môn` + phòng. Ô trống = tiết rảnh.
  - **Theo lớp** (`?view=class`): giữ nguyên hành vi hiện tại (chips chọn lớp + grid TKB lớp).
- Mặc định:
  - GVCN có lớp chủ nhiệm → mặc định `view=class` + lớp chủ nhiệm (giữ nguyên hành vi cũ).
  - GV không chủ nhiệm lớp nào → mặc định `view=me`.
- Bộ lọc lớp: vẫn hiển thị theo phạm vi hiện tại, nhưng lớp chủ nhiệm được ghim đầu + đánh dấu "Chủ nhiệm".

### Không đổi

- BGH vẫn thấy tất cả lớp + toolbar import/export.
- PHT vẫn scope theo campus.
- Không đụng `timetable_entries` schema (đã có `teacher_id`).

## 3. Impact assessment

| Hạng mục | Ảnh hưởng |
|---|---|
| `schedule/timetable/page.tsx` | Thêm view switcher + query cá nhân + render grid gộp |
| Nav/copy | Không đổi (vẫn "Thời khóa biểu") |
| DB | Không migration - dùng sẵn `teacher_id` |
| RLS | Không đổi - `timetable_entries` đã readable cho staff |
| Role khác | `gvbm`, `to_truong` hưởng lợi cùng UI (cá nhân hóa theo `profile.id`) - không cần code riêng |

## 4. Estimate

~0.5 ngày: view switcher + query + grid render + verify 3 role.

## 5. Q&A đã duyệt (21/9/2026)

1. **Phạm vi lớp**: GVCN chỉ xem TKB lớp mình chủ nhiệm (chips chỉ gồm lớp chủ nhiệm). BGH/PHT/GVBM không chủ nhiệm giữ nguyên phạm vi hiện tại.
2. **Role cá nhân**: chế độ "Lịch cá nhân" áp dụng cho mọi giáo viên (gvcn, gvbm, to_truong). BGH/PHT không có tiết dạy nên không hiện.
3. **Nội dung ô**: `Lớp · Môn · Phòng` - VD "6A3 · Toán · P.201".
