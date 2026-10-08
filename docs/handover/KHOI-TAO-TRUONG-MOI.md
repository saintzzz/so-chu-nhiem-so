# Khởi tạo trường mới - Sổ Chủ Nhiệm Số

Phiên bản: 1.0 · CR-039 · Áp dụng cho trường bắt đầu với hệ thống trống.

Tài liệu này hướng dẫn đưa một trường mới từ **không có gì** thành hệ thống
vận hành được: tài khoản, tổ chức, lớp, học sinh, phụ huynh, thời khóa biểu.
Có 2 đường đi — chọn một hoặc kết hợp:

| | Đường A - Qua giao diện | Đường B - Import Excel hàng loạt |
|---|---|---|
| Phù hợp | Trường nhỏ (<15 lớp), làm quen hệ thống | Trường lớn, migrate từ file sẵn có |
| Ai làm | BGH tự thao tác trên web | Quản trị hệ thống chạy script một lần |
| File kèm | Template tải ngay trong app | `docs/templates/khoi-tao-truong.xlsx` |

Nguyên tắc vàng: **khởi tạo theo đúng thứ tự phụ thuộc** — trường → năm học →
cơ sở → tổ chuyên môn → cán bộ → lớp → học sinh → phụ huynh → thời khóa biểu.
Không thể gán GVCN khi chưa có tài khoản giáo viên, không thể nhập HS khi
chưa có lớp.

---

## Bước 0 - Tạo trường (một lần duy nhất, do cấp trên thực hiện)

Chỉ **Sở GD&ĐT (`so_gd`)** hoặc **quản trị hệ thống (`admin`)** tạo được trường.

1. Đăng nhập tài khoản `so_gd`/`admin` → menu **Quản lý trường** (`/dept/schools`).
2. Bấm **Tạo trường mới**, điền:
   - Tên trường, mã trường (chữ HOA/số/gạch, vd `THCS-NGUYEN-DU`)
   - Cấp học: `th` (tiểu học) / `thcs` / `thpt`
   - Email + mật khẩu + họ tên của **tài khoản BGH đầu tiên** (thường là Hiệu trưởng)
   - Tùy chọn "dữ liệu mẫu" — **bỏ chọn** với trường thật (chỉ dùng cho demo)
3. Hệ thống tự tạo kèm:
   - Năm học hiện tại (vd 2026-2027, đang `is_current`)
   - 2 tổ chuyên môn mặc định ("Tổ Tự nhiên", "Tổ Xã hội") — đổi tên/thêm sau
   - Bộ môn học chuẩn theo cấp (TH: 13 môn, THCS: 14 môn, THPT: 13 môn)
   - Tài khoản BGH đăng nhập được ngay

> Khuyến nghị: giao việc này cho đội triển khai. Trường chỉ nhận email +
> mật khẩu BGH rồi tiếp tục Bước 1.

---

## ĐƯỜNG A - Khởi tạo qua giao diện (BGH tự làm)

Đăng nhập bằng tài khoản BGH vừa nhận. Nên đổi mật khẩu ngay
(nút **Đổi mật khẩu** trên thanh trên cùng).

### A1. Khai báo cơ sở - `/school/campuses`

- Trường 1 cơ sở: tạo 1 bản ghi "Cơ sở chính" (loại `main`).
- Trường nhiều cơ sở/phân hiệu: thêm từng cơ sở (`phan_hieu` hoặc `diem_truong`).
- Cơ sở quyết định **phạm vi dữ liệu của PHT** — PHT chỉ quản lớp thuộc
  cơ sở được phân, nên khai đúng ngay từ đầu.

### A2. Tổ chức tổ chuyên môn - `/school/users` (khối "Tổ chuyên môn - môn học")

- Đổi tên/thêm tổ cho khớp thực tế (vd "Tổ Toán - Tự nhiên",
  "Tổ Văn - Xã hội", "Tổ Khối 1-2").
- Tick **môn phụ trách** của từng tổ trong danh sách bộ môn.
- Gán **trưởng tổ** sau khi tạo tài khoản giáo viên (Bước A3).

### A3. Tạo tài khoản cán bộ - `/school/users` → **Tạo tài khoản**

Với từng cán bộ điền: họ tên, email (khoa đăng nhập), mật khẩu ≥8 ký tự,
vai trò, và các trường nhân sự:

| Trường | Giá trị | Ghi chú |
|---|---|---|
| Vai trò | `gvcn` `gvbm` `to_truong` `pht` `ke_toan` `bgh` | Vai trò chính |
| Vai trò kiêm nhiệm | tick thêm trong {gvcn, gvbm, to_truong, bgh, pht} | GVCN vẫn dạy → thêm `gvbm`; làm tổ trưởng → thêm `to_truong` |
| Mã nhân viên | mã nội bộ | Hồ sơ nhân sự |
| Loại hợp đồng | `bien_che` `hop_dong` `thinh_giang` | |
| Trình độ | tự do | |
| Cơ sở | theo A1 | Bắt buộc đúng với PHT |
| Tổ chuyên môn | theo A2 | GV bộ môn phải thuộc tổ |

Lưu ý phân quyền:

- `pht` = Phó hiệu trưởng **theo cơ sở** — tạo từng tài khoản PHT cho từng
  cơ sở, gán đúng `campus_id`.
- `admin` **không** phải vai trò trường — chỉ đội triển khai dùng.
- Phụ huynh/học sinh **không** tạo ở đây (Bước A7).

### A4. Tạo lớp học - `/records/intake`

- Tạo từng lớp: tên (vd `6A1`), khối, cơ sở. Lớp gắn năm học hiện tại.
- Gán **GVCN cho lớp** tại `/school/assignments` (phân công năm học).

### A5. Phân môn giáo viên - `/school/assignments`

- Gán môn giảng dạy cho từng GV (`teacher_subjects`) — quyết định GV được
  nhập điểm môn nào, xếp TKB được môn nào.
- GVCN cũng cần phân môn kiêm dạy ở đây.

### A6. Nhập học sinh - `/records/upload`

- Chọn lớp → **Tải template** (`template_danh_sach_hoc_sinh.xlsx`) → điền
  `ma_hs, ma_dinh_danh, ho_ten, ngay_sinh, gioi_tinh` → upload xem trước →
  sửa lỗi từng dòng ngay trên màn hình → **Nhập**.
- `ma_hs` phải duy nhất toàn hệ thống — nên đặt theo quy ước trường
  (vd `<mã trường><khối><số thứ tự>`).

### A7. Liên kết & cấp tài khoản phụ huynh - `/register/roster`

- Vào từng lớp → tab phụ huynh: thêm PH (họ tên, quan hệ, SĐT, email) →
  **liên kết** với học sinh → **cấp tài khoản** (email + mật khẩu).
- Một PH liên kết được nhiều con. PH chưa cấp tài khoản vẫn nhận được
  email thông báo (nếu trường cấu hình Resend).

### A8. Xếp thời khóa biểu - `/schedule/timetable` (chỉ BGH thấy nút Nhập)

- **Tải template toàn trường** (`mau-tkb-toan-truong.xlsx`):
  cột `Lớp | Thứ | Tiết | Môn | Giáo viên | Phòng`.
- Điền xong → **Nhập Excel** → hệ thống khớp tên lớp/môn/GV, báo lỗi từng dòng.
- Hoặc xếp tay từng tiết tại `/schedule/manage`.
- Tiết trống giáo viên vẫn nhập được (để trống cột Giáo viên).

### A9. Hoàn thiện vận hành (khuyến nghị tuần đầu)

- Lịch sự kiện năm học: `/register/year-events` (GVCN hoặc BGH upload).
- Phân quyền chức năng bổ sung: `/school/users` → cấp `feature_grants`
  (vd mở/tắt Studio AI theo vai trò hoặc từng người).
- Cài kênh email phụ huynh: cần `RESEND_API_KEY` trong env triển khai;
  không có thì thông báo chỉ hiện trong app.

---

## ĐƯỜNG B - Import Excel hàng loạt (đội triển khai)

Dùng khi trường đã có danh sách cán bộ/HS ở Excel — nhập một lần, không gõ tay.

### B1. Lấy file mẫu

`docs/templates/khoi-tao-truong.xlsx` — sinh lại bản mới nhất bằng:

```bash
node scripts/gen-init-template.mjs
```

File gồm 8 sheet — đọc sheet `huong_dan` trong file trước khi điền:

| Sheet | Nội dung | Bắt buộc |
|---|---|---|
| `huong_dan` | Hướng dẫn chi tiết trong file | - |
| `co_so` | Các cơ sở (ten, loai: main/phan_hieu/diem_truong, dia_chi) | Có |
| `to_chuyen_mon` | Tổ + môn phụ trách + email trưởng tổ | Có |
| `can_bo` | Toàn bộ cán bộ + vai trò + kiêm nhiệm + tổ + môn dạy | Có |
| `lop` | Lớp + khối + cơ sở + email GVCN | Có |
| `hoc_sinh` | HS theo lớp | Có |
| `phu_huynh` | PH + mã HS con + email/mật khẩu (tùy chọn cấp TK) | Tùy chọn |
| `tkb` | TKB toàn trường | Tùy chọn (nhập trong app cũng được) |

Quy tắc khớp: **email** là khóa của cán bộ/GVCN/GV/PH có tài khoản;
**tên môn** phải trùng bộ môn hệ thống tạo sẵn theo cấp học;
**tên cơ sở/tổ/lớp** khớp đúng tên đã khai ở sheet tương ứng.

Cột `email` của `can_bo` **có thể để trống** — script tự sinh theo quy ước
`<tên><viết tắt họ đệm>@<domain>` (vd `Lê Duy Linh` → `linhld@...`, trùng
thì `linhld1`...). Domain mặc định = domain đang dùng nhiều nhất trong
tài khoản của trường; ép tay bằng `--domain <domain>`. Các cột tham chiếu
(`gvcn_email`, `truong_to_email`, `giao_vien_email`) điền đúng email đã
khai hoặc email tự sinh đó.

### B2. Chạy kiểm tra (không ghi gì)

```bash
node scripts/bootstrap-school.mjs --file khoi-tao-truong.xlsx --school THCS-ND
```

`--school` nhận **mã trường** hoặc **uuid** (trường phải được tạo sẵn ở Bước 0).
Script validate toàn bộ file: email trùng, vai trò sai, môn không tồn tại,
lớp không khớp, mã HS trùng — báo lỗi theo **sheet + số dòng**. Sửa đến khi
in ra `DRY-RUN OK`.

### B3. Ghi vào hệ thống

```bash
node scripts/bootstrap-school.mjs --file khoi-tao-truong.xlsx --school THCS-ND --apply
# ep domain email tu sinh (truong chua co tai khoan nao):
#   ... --apply --domain truongabc.edu.vn
```

Script tự làm theo thứ tự: cơ sở → tổ (+gán môn) → cán bộ (tạo tài khoản
auth + hồ sơ + vai trò kiêm nhiệm) → trưởng tổ → lớp (+GVCN) → học sinh →
phụ huynh (+liên kết +tài khoản nếu có mật khẩu) → TKB.

Chạy lại file đã chỉnh sửa **an toàn**: bản ghi có sẵn được cập nhật/bỏ qua,
không nhân đôi (đã kiểm chứng: lần 2 chỉ `*_skip`/`*_upd`, 0 duplicate).

### B4. Xóa trường kiểm thử (chỉ dùng lúc thử)

```bash
node scripts/bootstrap-school.mjs --cleanup --school KIEMTHU
```

Xóa toàn bộ dữ liệu + tài khoản auth của trường — **không chạy trên trường
đang vận hành**.

---

## Checklist hoàn tất khởi tạo

Đăng nhập lại các vai trò để kiểm chứng — mỗi vai trò phải thấy **đúng**
menu của mình (kiểm chứng tự động: `node scripts/check-nav-access.mjs`):

- [ ] BGH: thấy đủ lớp, nhân sự, TKB; mở `/school/dashboard` có dữ liệu
- [ ] PHT: chỉ thấy lớp cơ sở mình
- [ ] GVCN: thấy lớp chủ nhiệm + lớp đang dạy; điểm danh được
- [ ] GVBM: thấy TKB/lớp mình dạy; nhập điểm môn mình dạy; vào route
      chủ nhiệm bị đẩy về trang chủ
- [ ] Tổ trưởng: thấy menu "Tổ chuyên môn" + GV trong tổ
- [ ] HS: trong lớp đúng, sắp theo tên gọi; PH liên kết đăng nhập được

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| PHT không thấy lớp nào | Chưa gán `campus_id` cho PHT hoặc lớp | Kiểm tra cả hai tại `/school/users` + `/school/campuses` |
| GV không nhập được điểm | Chưa phân môn (`teacher_subjects`) | `/school/assignments` |
| Tổ trưởng không thấy giáo án tổ | GV chưa thuộc tổ hoặc trưởng tổ chưa gán `department_id` | `/school/users` |
| Import HS báo "ma_hs trùng" | `students.code` unique toàn hệ thống | Đổi quy ước mã có tiền tố trường |
| PH không nhận email | Thiếu `RESEND_API_KEY` | Cấu hình env triển khai (thông báo trong app vẫn hoạt động) |
| Chạy bootstrap báo lỗi dòng X | Đọc kỹ `<sheet> dong <N>: <ly do>` — script liệt kê hết lỗi một lượt | Sửa file, chạy dry-run lại |
