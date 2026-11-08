# Giá trị gia tăng - tại sao trường cần Sổ Chủ Nhiệm Số

Tài liệu định vị cho bán hàng/triển khai (CR-116-W1). Trả lời 3 câu: tại
sao cần, trường cần gì để dùng, khác biệt gì so với SMAS/vnEdu/MISA.

## 1. Tại sao nhà trường cần

**Bài toán hằng ngày của GVCN/GVBM** - phần lớn thời gian "làm sổ" thay vì
dạy:

- GVCN tiêu biểu mất 3-5 giờ/tuần cho sổ sách chép thủ công: điểm danh giấy
  -> nhập lại sổ điểm -> tổng hợp báo cáo -> trả lời PH qua Zalo cá nhân ->
  viết sổ chủ nhiệm cuối tuần. Toàn bộ công đoạn lặp lại trên dữ liệu đã có.
- Dữ liệu nằm rải rác: Excel cá nhân, Zalo, sổ giấy -> khi Sở/Phòng yêu
  cầu báo cáo đột xuất thì trường phải làm lại từ đầu.
- TT 15/2026 (Điều lệ mới) + Luật 91/2025 (PDPL) đặt yêu cầu mới: dữ liệu
  học sinh là dữ liệu trẻ em - không thể tiếp tục nằm trên máy tính cá
  nhân, Zalo, hoặc hệ thống không phân quyền. Trường nào không số hóa có
  kiểm soát sẽ mắc lỗi compliance, không phải chỉ là chậm.
- CSDL ngành (csdl.moet.gov.vn, TT 26/2019 + TT 42/2021) yêu cầu mã định
  danh thống nhất - trường không quản lý mã định danh ngay từ hệ thống thì
  mỗi lần báo cáo lại phải ghép tay.

**Con số chất lượng**: khi điểm danh/ngày đầy đủ tự động thì báo cáo ngày
cho BGH là 1 nút, sổ chủ nhiệm cuối tuần tự sinh từ dữ liệu đã nhập, không
còn "việc cuối tuần".

## 2. Trường cần gì để triển khai

| Điều kiện | Cụ thể | Ghi chú |
|---|---|---|
| Thiết bị | Máy tính/điện thoại có trình duyệt. Không cần cài đặt, không cần server tại trường (SaaS) | Portal PH/HS tối ưu mobile |
| Dữ liệu đầu vào | File Excel danh sách GV/lớp/HS - hoặc file xuất sẵn từ SMAS/vnEdu (mapper tự nhận diện Mã VEMIS) | Khởi tạo 1 buổi cho trường ~500 HS |
| Nhân sự vận hành | 1 người phụ trách (thường văn phòng/PHT) cấu hình đầu năm: năm học, lớp, phân công GVCN, TKB | Không cần nhân viên IT |
| Tài khoản | Email nhân sự (hoặc username tạo sẵn) - hệ thống tự sinh email nội bộ nếu trường không có domain | Demo flow khởi tạo sẵn có |
| Internet | Mạng trường bình thường; các thao tác hằng ngày rất nhẹ | Không yêu cầu hạ tầng riêng |
| Pháp lý | Đồng thuận PHHS cho dữ liệu trẻ em (sổ ghi sẵn trong hệ thống), phân công trách nhiệm theo Điều lệ | Mục 6 - compliance có sẵn |

Không cần: mua máy chủ, thuê IT, đổi quy trình hành chính, dừng công cụ đang
dùng song song (chạy parallel với SMAS/vnEdu trong giai đoạn chuyển tiếp).

## 3. Khác biệt so với đối thủ

| Tiêu chí | SMAS (Viettel) | vnEdu (VNPT) | MISA QLTH | Sổ Chủ Nhiệm Số |
|---|---|---|---|---|
| Điểm khởi đầu | Quản trị trường (BGH/văn phòng) | Nền tảng ngành (kết nối VEMIS) | Quản trị + kế toán | **Công việc hằng ngày của GVCN/GVBM** - điểm danh 1 chạm, sổ đầu bài, sổ chủ nhiệm tự sinh |
| AI | Chưa có/giới hạn | Một số điểm | EMIS AI cơ bản | AI đa tầng: gen đề thi, gợi ý nhận xét, phân tích radar, toán tử câu hỏi - chạy được ngay cả không có API key (fallback nội bộ) |
| Module | Gói tổng | Gói theo cụm | Bán theo phân hệ | **19 module bán lẻ** - trường mua đúng phần cần (học bạ, văn thư, y tế, tuyển sinh, LMS...) như phụ kiện |
| Chuẩn ngành | Theo SMAS | Sớm nhất VEMIS | Theo MISA | **Mã định danh ngành (TT26/42) là trường dữ liệu chính** - xuất/nhập tương thích file V.EMIS, học bạ XML QĐ3016 |
| Đối tượng phục vụ | Trường công Viettel | Trường công VNPT | Trường công + tư | Trường công + tư + nhóm trường + Sở GD&ĐT xem tổng hợp địa bàn |
| Bổ sung khác | - | - | - | Cổng khai tuyển sinh, portal PH/HS đầy đủ, Studio soạn học liệu, privacy theo Luật 91/2025 |

**Lợi thế cốt lõi**: các hệ thống ngành (vnEdu/SMAS) mạnh ở "báo cáo lên Bộ"
nhưng yếu ở "công việc hằng ngày của giáo viên". Hệ này làm ngọn phần hằng
ngày trước - dữ liệu sạch tự động chảy lên báo cáo, không cần nhập hai lần.

## 4. Checklist triển khai 1 trường (onboarding)

1. Thu thập: danh sách GV (họ tên, môn, tổ chuyên môn), danh sách lớp,
   danh sách HS (chấp nhận file SMAS/vnEdu), TKB hiện tại, danh mục môn.
2. Khởi tạo: chạy workbook `khoi-tao-truong.xlsx` hoặc import từng phần.
3. Cấu hình: năm học, 2 campus/nếu có, phân công GVCN, mã định danh ngành
   cho GV/HS đã có từ CSDL ngành (nếu có).
4. Module: bật các module trường mua - mặc định lõi chạy: điểm danh, sổ
   điểm, sổ đầu bài, sổ chủ nhiệm, portal PH/HS.
5. Consent: gửi thư PHHS + ghi nhận vào sổ đồng thuận (mục 6).
6. Go-live tuần 1: chỉ cần GVCN điểm danh đúng hạn - báo cáo ngày tới BGH
   tự động có. Các phần sau mở dần.
