# Bộ hồ sơ bàn giao - Sổ Chủ Nhiệm Số & TVC360 Studio

Hệ thống: https://sochunhiem.vieschool.com · Phiên bản: v2.0 (10/2026)
Mật khẩu demo chung: `demo1234`

Thư mục này là **bản đóng gói** của `docs/user-guide/` + template + ảnh chụp - đủ để bàn giao cho đội chuyên gia/vận hành mà không cần phần còn lại của repo.

## Danh mục

| File | Định dạng | Nội dung |
|---|---|---|
| [USER-GUIDE-vieschool.pptx](USER-GUIDE-vieschool.pptx) | PowerPoint | Hướng dẫn + giới thiệu chức năng, 18 slides: vai trò kiêm nhiệm, 3 trường demo, tài khoản, ma trận quyền, khởi tạo trường |
| [SO-CHU-NHIEM-SO-GIOI-THIEU.pptx](SO-CHU-NHIEM-SO-GIOI-THIEU.pptx) | PowerPoint | Slide giới thiệu + đào tạo người dùng (15 trang, kèm ảnh màn hình thật) |
| [SO-CHU-NHIEM-SO-TAI-LIEU.docx](SO-CHU-NHIEM-SO-TAI-LIEU.docx) | Word | Gộp mô tả chức năng + hướng dẫn chi tiết - dùng in/phát hành nội bộ |
| [KICH-BAN-DEMO.pptx](KICH-BAN-DEMO.pptx) | PowerPoint | Kịch bản demo 14 slides theo luồng vai trò - dùng khi trình diễn |
| [HUONG-DAN-SU-DUNG.md](HUONG-DAN-SU-DUNG.md) | Markdown | Thao tác chi tiết theo từng vai trò (kèm kiêm nhiệm) |
| [MO-TA-CHUC-NANG.md](MO-TA-CHUC-NANG.md) | Markdown | Mô tả 15 module, ma trận vai trò, luồng nghiệp vụ, AI, bảo mật |
| [KHOI-TAO-TRUONG-MOI.md](KHOI-TAO-TRUONG-MOI.md) | Markdown | Đưa trường mới lên hệ thống từ con số 0 |
| [KICH-BAN-DEMO.md](KICH-BAN-DEMO.md) | Markdown | Kịch bản demo chi tiết - tài khoản, đường đi, kết quả kỳ vọng |
| [templates/khoi-tao-truong.xlsx](templates/khoi-tao-truong.xlsx) | Excel | Workbook mẫu khởi tạo trường (8 sheet: cơ sở, tổ, cán bộ, lớp, HS, PH, TKB) |
| [PROPOSAL-chi-phi-dev-4thang.pptx](PROPOSAL-chi-phi-dev-4thang.pptx) | PowerPoint | Đề xuất chi phí phát triển |
| `images/` | PNG | 31 ảnh chụp màn hình thật từ production |

## Tài khoản demo chính (mật khẩu `demo1234`)

| Tài khoản | Vai trò | Ghi chú |
|---|---|---|
| bgh@demo.scn | Hiệu trưởng + kiêm GVBM | Toàn quyền trường THCS Nguyễn Du |
| pht@demo.scn | PHT cơ sở 2 + kiêm GVBM | Chỉ thấy lớp Cơ sở 2 |
| totruong@demo.scn | Tổ trưởng Toán-TN + kiêm GVBM | Duyệt giáo án/câu hỏi lớp tổ |
| gvcn@demo.scn | GVCN 8A2 + kiêm GVBM + tổ trưởng | Demo multi-role 3 vai trò |
| gvbm@demo.scn | GVBM đơn vai trò | Chứng minh quyền giữ nguyên |
| ketoan / phuhuynh / hocsinh / sogd / ubnd / admin @demo.scn | Theo tên | Chi tiết trong KICH-BAN-DEMO.md |

## Vận hành (cho đội triển khai)

```bash
# Khởi tạo trường mới hàng loạt từ workbook
node scripts/bootstrap-school.mjs --file templates/khoi-tao-truong.xlsx --school <MA_TRUONG> --apply

# Re-seed dữ liệu demo 3 trường
node scripts/seed-real-demo.mjs

# Tái sinh tài liệu (chạy từ repo, nguồn chuẩn là docs/user-guide/)
node scripts/gen-user-guide-pptx.mjs   # USER-GUIDE-vieschool.pptx
node scripts/gen-demo-pptx.mjs         # KICH-BAN-DEMO.pptx
python3 scripts/gen-user-docs.py       # DOCX + PPTX giới thiệu
node scripts/gen-init-template.mjs     # khoi-tao-truong.xlsx
```

Lưu ý: nguồn chuẩn (source of truth) của các file Markdown/Office là `docs/user-guide/` - bản ở đây là bản đóng gói, cập nhật lại bằng lệnh copy hoặc khi phát hành phiên bản mới.
