# Tài liệu người dùng - Sổ Chủ Nhiệm Số

Hệ thống: https://sochunhiem.vieschool.com

| Tài liệu | Định dạng | Nội dung |
|---|---|---|
| [MO-TA-CHUC-NANG.md](MO-TA-CHUC-NANG.md) | Markdown | Mô tả chi tiết 14 module chức năng, ma trận vai trò, luồng nghiệp vụ, AI, báo cáo, bảo mật |
| [HUONG-DAN-SU-DUNG.md](HUONG-DAN-SU-DUNG.md) | Markdown | Hướng dẫn thao tác theo 8 vai trò (kèm vai trò kiêm nhiệm), 31 ảnh màn hình hệ thống |
| [KHOI-TAO-TRUONG-MOI.md](KHOI-TAO-TRUONG-MOI.md) | Markdown | Đưa trường mới lên hệ thống từ con số 0 - theo giao diện hoặc import Excel hàng loạt |
| [khoi-tao-truong.xlsx](../templates/khoi-tao-truong.xlsx) | Excel | Workbook mẫu khởi tạo: cơ sở, tổ, cán bộ, lớp, HS, phụ huynh, TKB |
| [KICH-BAN-DEMO.md](KICH-BAN-DEMO.md) | Markdown | Kịch bản demo theo luồng vai trò - tài khoản, tuyến đường, kết quả kỳ vọng |
| [KICH-BAN-DEMO.pptx](KICH-BAN-DEMO.pptx) | PowerPoint | Kịch bản demo dạng slide 14 trang, dùng trình chiếu khi demo |
| [SO-CHU-NHIEM-SO-TAI-LIEU.docx](SO-CHU-NHIEM-SO-TAI-LIEU.docx) | Word | Gộp mô tả + hướng dẫn - dùng để in/phát hành nội bộ |
| [SO-CHU-NHIEM-SO-GIOI-THIEU.pptx](SO-CHU-NHIEM-SO-GIOI-THIEU.pptx) | PowerPoint | Slide 13 trang giới thiệu + đào tạo người dùng, kèm ảnh màn hình |

Thư mục `images/` chứa 31 ảnh chụp màn hình thật từ production dùng chung cho các tài liệu.

Tái sinh file Office sau khi sửa Markdown:

```bash
python3 scripts/gen-user-docs.py        # DOCX + PPTX giới thiệu
node scripts/gen-demo-pptx.mjs          # PPTX kịch bản demo
node scripts/gen-init-template.mjs      # XLSX workbook khởi tạo trường
```

Import dữ liệu hàng loạt cho trường mới (dry-run trước, `--apply` để ghi):

```bash
node scripts/bootstrap-school.mjs --file docs/templates/khoi-tao-truong.xlsx --school <MA_TRUONG> --apply
```
