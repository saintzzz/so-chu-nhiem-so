# CR-044: Studio UX - editor focus mất chữ, tên bài dạy bám nội dung, DC-06 chọn KHBD trong form

**Ngày:** 2026-10-09 | **Nguồn:** phản hồi người dùng trên production (`sochunhiem.vieschool.com/studio/DC-01`)

## Phạm vi

3 lỗi/cải tiến trong module Công cụ soạn học liệu:

1. **Bug UI - editor mất chữ khi focus.** `DocEditor` render trên `.a4-sheet` (nền trắng `#fff`, chữ `#0f172a` cố định để mô phỏng giấy in). Nhưng class `inp` dùng `focus:bg-background` - token `--background: #0b1224` (navy đậm) của dark theme. Focus vào ô nhập = chữ đen trên nền đen, không nhìn thấy gì. Fix: màu focus/hover dùng literal light (`focus:bg-white`, `border-slate-300/400`, `sky-500`), TexPreview đổi `bg-muted/40 text-muted-foreground` → `bg-slate-100 text-slate-600`.

2. **Field "Tên bài dạy" không điều khiển nội dung.** Prompt DC-01 chỉ nhắc tên bài 1 lần ở câu mở, toàn bộ quy tắc còn lại bắt "bám YCCĐ" → model ưu tiên YCCĐ, tên bài chỉ thành tiêu đề. Fix:
   - Prompt: thêm quy tắc "TÊN BÀI DẠY LÀ CHỦ ĐỀ TRUNG TÂM" - toàn bộ nội dung xoay quanh đúng bài; YCCĐ là mục tiêu cần đạt của bài, không suy rộng.
   - `help` text giải thích vai trò field.
   - Auto-fill `lesson` từ `lesson_ref` của YCCĐ khi GV tick chọn (chỉ khi field trống). Lưu ý: `lesson_ref` hiện chỉ có dữ liệu ở chuẩn THCS; cấp TH đang trống.

3. **DC-06 không có cách chọn giáo án trong form.** Cơ chế gắn KHBD đã có (CR-042: `?from=<id>` từ trang thư viện + `material_id` → `khbdText` vào prompt), nhưng trong form DC-06 không có picker. Fix:
   - Context API thêm `kind=lesson_plans` trả danh sách KHBD của GV (`type=lesson_plan`, `author_id=userId`, 50 gần nhất).
   - DC-06 thêm field `material_id` "Bám sát giáo án đã lưu" - chọn xong auto-fill môn/khối/YCCĐ của giáo án.
   - Field ẩn khi đã vào qua `?from=` (tránh trùng).

## Impact assessment

| Vùng | File | Rủi ro |
|---|---|---|
| Editor UI | `doc-editor.tsx` | Thấp - chỉ đổi class màu trong a4-sheet (vốn là giấy trắng cố định) |
| Prompt DC-01 | `prompts.ts` | Thấp - làm rõ vai trò tên bài, không đổi cấu trúc output |
| Registry | `registry.ts` | Thấp - thêm field optional + help text |
| Tool runner | `tool-runner.tsx` | Trung bình - thêm fetch + auto-fill; material_id đi qua `...values` sẵn có |
| Context API | `context/route.ts` | Thấp - kind mới, RLS theo author_id |

## Verify (dev, Playwright)

- Editor: focus input trong a4-sheet → computed `background #fff` / `color #0f172a` (trước: `#0b1224` trùng chữ).
- DC-01: nhập "Phép cộng có nhớ trong phạm vi 1000" → doc title + nội dung bám đúng bài.
- DC-06: select hiện danh sách KHBD; chọn "KẾ HOẠCH BÀI DẠY: ÔN TẬP VỀ SỐ TỰ NHIÊN..." → auto-fill `toan` / lớp 5 / 9 YCCĐ.
- Gates: `tsc --noEmit` clean, eslint clean, `check-consistency` all PASS.
