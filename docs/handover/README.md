# Bộ hồ sơ bàn giao - Sổ Chủ Nhiệm Số & TVC360 Studio

Hệ thống: https://sochunhiem.vieschool.com · Phiên bản: v2.1 (demo 15/10/2026)
Mật khẩu demo chung: `demo1234`

Thư mục này là **bản đóng gói** của `docs/user-guide/` + template + ảnh chụp - đủ để bàn giao cho đội chuyên gia/vận hành mà không cần phần còn lại của repo.

## Danh mục

| File | Định dạng | Nội dung |
|---|---|---|
| [USER-GUIDE-vieschool.pptx](USER-GUIDE-vieschool.pptx) | PowerPoint | Bản duy nhất gộp hướng dẫn + giới thiệu chức năng: vai trò kiêm nhiệm, 3 trường demo, Studio TVC360 (A-03 audio), ma trận quyền, khởi tạo trường, kèm ảnh màn hình |
| [SO-CHU-NHIEM-SO-TAI-LIEU.docx](SO-CHU-NHIEM-SO-TAI-LIEU.docx) | Word | Gộp mô tả chức năng + hướng dẫn chi tiết - dùng in/phát hành nội bộ |
| [KICH-BAN-DEMO.pptx](KICH-BAN-DEMO.pptx) | PowerPoint | Kịch bản demo 15 slides theo luồng vai trò - dùng khi trình diễn |
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
| hainv@nd.scn | Hiệu trưởng + kiêm GVBM | Toàn quyền trường THCS Nguyễn Du |
| duclm@nd.scn | PHT cơ sở 2 + kiêm GVBM | Chỉ thấy lớp Cơ sở 2 |
| hanhlth@nd.scn | Tổ trưởng Toán-TN + kiêm GVBM | Duyệt giáo án/câu hỏi lớp tổ |
| anhptl@nd.scn | GVCN 8A2 + kiêm GVBM + tổ trưởng | Demo multi-role 3 vai trò |
| minhtv@nd.scn | GVBM đơn vai trò | Chứng minh quyền giữ nguyên |
| trangpt@nd.scn | Kế toán | Nhân sự, thu chi |
| annv@nd.scn / baong@nd.scn | Phụ huynh / Học sinh | Cổng PH-HS |
| sovqt@demo.scn / daonvl@demo.scn | Sở GD / UBND | Cấp trên, UBND chỉ đọc |
| admin@demo.scn | Quản trị hệ thống | Toàn hệ thống |

## Vận hành (cho đội triển khai)

```bash
# Khởi tạo trường mới hàng loạt từ workbook
node scripts/bootstrap-school.mjs --file templates/khoi-tao-truong.xlsx --school <MA_TRUONG> --apply

# Re-seed dữ liệu demo 3 trường
node scripts/seed-real-demo.mjs

# Tái sinh tài liệu (chạy từ repo, nguồn chuẩn là docs/user-guide/)
node scripts/gen-user-guide-pptx.mjs   # USER-GUIDE-vieschool.pptx
node scripts/gen-demo-pptx.mjs         # KICH-BAN-DEMO.pptx
python3 scripts/gen-user-docs.py       # DOCX gộp mô tả + hướng dẫn
node scripts/gen-init-template.mjs     # khoi-tao-truong.xlsx
```

Lưu ý: nguồn chuẩn (source of truth) của các file Markdown/Office là `docs/user-guide/` - bản ở đây là bản đóng gói, cập nhật lại bằng lệnh copy hoặc khi phát hành phiên bản mới.
