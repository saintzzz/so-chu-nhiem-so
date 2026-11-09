# Tài liệu người dùng - Sổ Chủ Nhiệm Số

Hệ thống: https://sochunhiem.vieschool.com

| Tài liệu | Định dạng | Nội dung |
|---|---|---|
| [HUONG-DAN-SU-DUNG.md](HUONG-DAN-SU-DUNG.md) | Markdown | Hướng dẫn thao tác theo 8 vai trò (kèm vai trò kiêm nhiệm), ảnh màn hình thật |
| [USER-GUIDE-vieschool.pptx](USER-GUIDE-vieschool.pptx) | PowerPoint | Bản duy nhất gộp hướng dẫn + giới thiệu chức năng - dùng trình chiếu/chia sẻ |
| [khoi-tao-truong.xlsx](../templates/khoi-tao-truong.xlsx) | Excel | Workbook mẫu khởi tạo: cơ sở, tổ, cán bộ, lớp, HS, phụ huynh, TKB |

Thư mục `images/` chứa ảnh chụp màn hình thật từ production dùng chung.

Tái sinh/chụp lại sau khi sửa:

```bash
node scripts/capture-guide-screens.mjs   # chụp lại ảnh màn hình -> images/
node scripts/gen-user-guide-pptx.mjs     # tái sinh USER-GUIDE-vieschool.pptx
node scripts/gen-init-template.mjs       # tái sinh workbook khởi tạo trường
```
