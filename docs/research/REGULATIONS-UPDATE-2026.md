# Research: Cập nhật quy định BGD&ĐT + đối thủ (2026-09-30)

Deep research trước SDLC run cho 3 sản phẩm VieSchool (Sổ CN Số, TVC360, English Arena).

## 1. Văn bản quy phạm mới nhất

### TT 15/2026/TT-BGDĐT - Điều lệ trường mới (eff. 10/5/2026)

Thay thế TT 28/2020 (tiểu học) + TT 32/2020 (THCS/THPT) + QĐ 51/2002 + TT 50/2021 + TT 31/2023.

Điểm mới ảnh hưởng trực tiếp đến Sổ CN Số:

- **Điều 21.2 - tinh giản hồ sơ GV**: chỉ còn Kế hoạch bài dạy (giáo án) +
  Sổ chủ nhiệm (GVCN) + Sổ công tác Đội (TPT Đội). Bỏ "Sổ ghi chép sinh hoạt
  chuyên môn, dự giờ", "Sổ theo dõi đánh giá HS", "Kế hoạch giáo dục năm học"
  ở cấp GV. -> Sổ chủ nhiệm vẫn là hồ sơ bắt buộc của GVCN - sản phẩm đúng
  trọng tâm.
- **Điều 21.4 - hồ sơ điện tử**: hồ sơ quản lý "được quản lý, sử dụng dưới
  dạng hồ sơ điện tử là chủ yếu; hồ sơ điện tử có giá trị pháp lý tương đương
  hồ sơ giấy". -> Sổ CN Số là hình thức pháp lý chính thức, không còn là
  "bản phụ".
- **Điều 22.2 - đánh giá HS**: cấm so sánh HS này với HS khác, bảo mật điểm
  số, giảm nhận xét hình thức. -> Audit: app chỉ có xếp hạng THI ĐUA cấp lớp
  (`/emulation/ranking`), không xếp hạng cá nhân HS -> tuân thủ.
- **Điều 3.3 + 17.3**: AI, năng lực số, STEM/STEAM chính thức vào chương
  trình GDPT; tăng thời lượng tiếng Anh, đưa tiếng Anh thành ngôn ngữ thứ 2.
- Ban đại diện CMHS vẫn tồn tại (chương Quan hệ nhà trường-gia đình-xã hội)
  nhưng tinh giản - dự kiến bỏ quỹ BĐD CMHS.

### Dự thảo TT sửa đổi TT 27/2020 + TT 22/2021 (CV 4582/BGDĐT-GDPT, 20/7/2026)

- **Học bạ số** thay thế học bạ giấy; hiệu trưởng nghiệm thu dữ liệu số.
- **Kiểm tra định kỳ trên máy tính được phép** - giá trị pháp lý tương đương
  bài giấy (khi trường đủ hạ tầng).
- Đánh giá HS khuyết tật, trường chuyên; đánh giá lại, xét lên lớp.
- TT 10/2025 + TT 26/2025: phân quyền chính quyền 2 cấp (UBND xã nghiệm thu
  kết quả GD). SCN đã bỏ Phòng GD&ĐT theo CR-017 - đúng hướng.

### Khác

- **Luật Nhà giáo 2025** đã ban hành.
- **TT 17/2025** sửa CTGDPT 2018 (chỉ đụng Lịch sử/Địa lý/GDCD - không đụng
  tiếng Anh). CR-14 đã ghi nhận.
- **QĐ 764/QĐ-BGDĐT (8/3/2024)**: cấu trúc đề thi TN THPT 2025+ (xem doc
  TVC360 `docs/10-research-2026-09-30.md`).

## 2. Đối thủ

| Đối thủ | Phạm vi | Điểm mạnh | Khoảng trống SCN khai thác |
|---|---|---|---|
| vnEdu (VNPT) | HSS đủ bộ: sổ đăng bộ, học bạ, sổ đầu bài, sổ CN + ký số | Tích hợp CSDL ngành, ký số | Nặng hạ tầng, triển khai theo Sở; SCN nhanh, mobile-first, GVCN tự dùng được không cần triển khai tập trung |
| ViettelStudy | LMS + sổ liên lạc | Hệ sinh thái Viettel | Tập trung học tập hơn nghiệp vụ chủ nhiệm |
| Base/ONES (Sở GD) | Quản trị trường | Miễn phí theo địa bàn | Phụ thuộc địa phương triển khai |

## 3. Hàm ý hành động cho SCN

1. Cập nhật mọi tham chiếu "TT 32/2020" trong UI/docs -> TT 15/2026 (BĐD CMHS
   giờ thuộc chương quan hệ nhà trường-gia đình của Điều lệ 15/2026, không
   còn Điều 44 TT 32/2020).
2. Claim marketing: "hồ sơ điện tử có giá trị pháp lý tương đương hồ sơ giấy
   (Điều 21, TT 15/2026)" - được phép nói thẳng thay sổ giấy.
3. TT 15/2026 bỏ "Sổ theo dõi đánh giá HS" ở cấp GV -> SCN giữ tính năng như
   không claim là "hồ sơ bắt buộc".
4. Giữ nguyên: không xếp hạng cá nhân HS (Điều 22.2). Thi đua cấp lớp OK.
