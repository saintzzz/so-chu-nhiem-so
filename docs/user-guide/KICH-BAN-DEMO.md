# Kịch bản demo - Sổ Chủ Nhiệm Số

Phiên bản: 1.0 · Ngày: 2026 (CR-036) · Môi trường: https://sochunhiem.vieschool.com

Tài liệu này là kịch bản demo theo vai trò, dùng bộ dữ liệu thực tế được seed lại theo CR-036. Mật khẩu demo chung: `demo1234`.

---

## 1. Bối cảnh dữ liệu

| Trường | Quy mô | Cơ cấu |
|---|---|---|
| THCS Nguyễn Du | 12 lớp 6A1-9A3, ~435 HS, 34 cán bộ | 2 cơ sở; 4 tổ: Toán-Tự nhiên, Văn-Xã hội, Ngoại ngữ, Thể chất-Khác |
| Tiểu học Chu Văn An | 15 lớp 1A1-5A3, ~500 HS, 30 cán bộ | 4 tổ: Khối 1-2, Khối 3, Khối 4-5, Chuyên biệt |
| Tiểu học Kim Đồng | 10 lớp 1A1-5A2, ~340 HS, 22 cán bộ | 3 tổ: Khối 1-2, Khối 3-5, Chuyên biệt |

Mỗi trường có đủ nhân sự thực tế: Hiệu trưởng + Phó hiệu trưởng, kế toán, tổ trưởng chuyên môn, GVCN cho từng lớp, GVBM phân về tổ và được phân môn (`teacher_subjects`), TKB đầy đủ, điểm, chuyên cần, hạnh kiểm, hoạt động, sự cố, cảnh báo sớm, kế hoạch hỗ trợ, ngân hàng câu hỏi TVC360 (360 câu/trường gán về đúng GV).

Đặc điểm để demo phân quyền:

- **THCS Nguyễn Du có 2 cơ sở** - khối lớp A3 thuộc Cơ sở 2 do PHT Lê Minh Đức phụ trách → demo giới hạn phạm vi PHT.
- Mỗi lớp đã có GVCN, sơ đồ chỗ ngồi, ban cán sự, nhóm/tổ, danh sách PH liên kết.
- Ngân hàng câu hỏi: mỗi trường 360 câu thuộc sở hữu GV của trường đó.

## 2. Tài khoản demo chính

| Vai trò | Tài khoản | Nhân sự - bối cảnh |
|---|---|---|
| Hiệu trưởng ND | bgh@demo.scn | Nguyễn Văn Hải - THCS Nguyễn Du, kiêm dạy (`bgh`+`gvbm`) |
| PHT cơ sở 2 ND | pht@demo.scn | Lê Minh Đức - chỉ thấy các lớp A3, kiêm dạy (`pht`+`gvbm`) |
| Tổ trưởng ND | totruong@demo.scn | Lê Thị Hồng Hạnh - Tổ Toán-Tự nhiên, kiêm dạy (`to_truong`+`gvbm`) |
| GVCN ND | gvcn@demo.scn | Phạm Thị Lan Anh - GVCN 8A2, dạy Toán, Tổ trưởng Toán-TN (`gvcn`+`gvbm`+`to_truong`) |
| GVBM ND | gvbm@demo.scn | Trần Văn Minh - GV Vật lý, Tổ Toán-TN (đơn vai trò) |
| Kế toán ND | ketoan@demo.scn | Phạm Thu Trang |
| Phụ huynh | phuhuynh@demo.scn | Nguyễn Văn An - bố em Nguyễn Gia Bảo lớp 8A2 |
| Học sinh | hocsinh@demo.scn | Nguyễn Gia Bảo - lớp 8A2 |
| Sở GD&ĐT | sogd@demo.scn | Vũ Quản Trị Sở - xem được cả 3 trường |
| UBND | ubnd@demo.scn | Ngô Văn Lãnh Đạo - dashboard địa bàn, chỉ đọc |
| Quản trị | admin@demo.scn | Toàn hệ thống |

Trường khác: `bgh.cva@demo.scn`, `gvcn.cva@demo.scn` (GVCN 3A2), `totruong.cva@demo.scn`, `ketoan.cva@demo.scn`; `bgh.kd@demo.scn`, `gvcn.kd@demo.scn` (GVCN 3A2), `ketoan.kd@demo.scn`.

Các GV còn lại của từng trường login bằng email dạng `ten.vt@nd.scn` / `@cva.scn` / `@kd.scn` (vd: `minh.tv@nd.scn`), cùng mật khẩu `demo1234` - xem danh sách trong `scripts/seed-real-demo.mjs`.

## 3. Kịch bản theo luồng

### Luồng A - GVCN một ngày làm việc (gvcn@demo.scn, ~10 phút)

Mở đầu bằng điểm nhấn **vai trò kiêm nhiệm** (CR-038): cô Lan Anh đăng
nhập thấy topbar "Giáo viên chủ nhiệm - Giáo viên bộ môn - Tổ trưởng
chuyên môn" và menu gộp đủ 3 vai trò (mục "Tổ chuyên môn" xuất hiện do
cô là tổ trưởng Tổ Toán - Tự nhiên).

1. **Dashboard** (`/dashboard/gvcn`): thấy lớp 8A2 - sĩ số, tỷ lệ chuyên cần, cảnh báo sớm, việc cần xử lý; các lớp cô đang dạy Toán hiện kèm.
2. **Điểm danh** (`/attendance`): lớp 8A2 đã có dữ liệu chuyên cần các ngày trước; điểm danh hôm nay, đánh vắng 1 em → kiểm chứng đồng bộ sang sổ đầu bài và thông báo PH.
3. **Sổ điểm** (`/academics/grades`): lớp 8A2 đã có điểm miệng/15'/GK các môn; nhập thêm điểm môn Toán (Lan Anh dạy Toán 8A2).
4. **Sổ đầu bài** (`/register`): xem TKB, ghi nhật ký tiết dạy; sơ đồ chỗ ngồi đã có sẵn.
5. **Kế hoạch bài dạy** (`/academics/lesson-plans`): soạn KHBD mới theo biểu mẫu CV 5512 (editor cấu trúc) → nộp → chuyển sang luồng B cho tổ trưởng duyệt.
6. **Liên lạc PH** (`/communication`): gửi thông báo cho PH lớp → sang luồng D kiểm chứng phía PH nhận được.
7. **Hồ sơ lớp** (`/register/class`): ban cán sự, tổ, nhóm HS, liên kết PH đã có sẵn.

### Luồng B - Phê duyệt 2 cấp (totruong → bgh, ~5 phút)

1. `totruong@demo.scn` → **Tổ chuyên môn** (`/dept`): thấy GV trong Tổ Toán-TN, giáo án chờ duyệt của cô Lan Anh → xem bản cấu trúc CV 5512 → **Duyệt** (hoặc trả về kèm nhận xét).
2. `bgh@demo.scn` → **Phê duyệt** (`/school/approvals`): giáo án `team_approved` hiện trong hàng chờ → **Duyệt** → trạng thái `approved`, GV nhận thông báo.
3. Điểm nhấn: tổ trưởng chỉ thấy giáo án của GV trong tổ mình; BGH thấy toàn trường. Cô Lan Anh (đang là GVCN) cũng mở được `/team/lesson-plans` vì kiêm tổ trưởng - menu "Tổ chuyên môn" chỉ xuất hiện khi có vai trò đó.

### Luồng C - Điều hành trường (bgh@demo.scn + pht@demo.scn, ~8 phút)

1. **Dashboard BGH**: KPI toàn trường - chuyên cần, sự cố, radar cảnh báo, tình hình phê duyệt.
2. **TKB toàn trường** (`/school/timetable`): 360 tiết/tuần của 12 lớp, không tiết trống.
3. **Phân công** (`/school/assignments`): danh sách GVCN từng lớp + GVBM phân môn.
4. **Nhân sự** (`/school/users`): 34 cán bộ có mã NV, hợp đồng, trình độ, tổ chuyên môn.
5. **So sánh PHT**: đăng nhập `pht@demo.scn` → cùng màn hình nhưng chỉ thấy các lớp A3 (Cơ sở 2) - demo giới hạn phạm vi cơ sở.
6. **Báo cáo** (`/school/reports`): báo cáo tổng hợp gửi Sở.

### Luồng D - Phụ huynh & học sinh (~5 phút)

1. `phuhuynh@demo.scn` → **Cổng PH** (`/portal/parent`): thấy con Nguyễn Gia Bảo 8A2 - điểm, chuyên cần, hạnh kiểm, thông báo từ GVCN ở luồng A.
2. Nhắn tin cho GVCN → đặt lịch hẹn → GVCN nhận thông báo.
3. `hocsinh@demo.scn` → **Cổng HS**: TKB của 8A2, điểm, hạnh kiểm, thông báo.

### Luồng E - Cấp trên & đa trường (sogd + ubnd + admin, ~5 phút)

1. `sogd@demo.scn` → **Sở GD&ĐT** (`/dept`): tổng hợp 3 trường, `/dept/schools` tạo trường mới, `/dept/usage` giám sát sử dụng.
2. `ubnd@demo.scn` → dashboard địa bàn, chỉ đọc.
3. `admin@demo.scn` → quản trị hệ thống.

### Luồng F - Trường tiểu học (gvcn.cva@demo.scn, ~5 phút)

1. Đăng nhập GVCN 3A2 Chu Văn An: dữ liệu đánh giá theo **mức độ** (không phải điểm số) đúng TT 22/2021 cho tiểu học.
2. Tổ trưởng `totruong.cva@demo.scn` duyệt giáo án tổ Khối 1-2.
3. `bgh.cva@demo.scn` xem dashboard 15 lớp.

### Luồng G - Vai trò kiêm nhiệm (CR-038, ~4 phút)

Thực tế trường VN: GVCN luôn kiêm dạy bộ môn, tổ trưởng vẫn đứng lớp,
PHT/Hiệu trưởng vẫn dạy. Hệ thống hỗ trợ bằng "vai trò kiêm nhiệm".

| Tài khoản | Vai trò | Demo nhanh |
|---|---|---|
| `gvcn@demo.scn` | gvcn + gvbm + to_truong | Topbar 3 nhãn; menu gộp đủ Chuyên cần + Tổ chuyên môn; vào được `/team/lesson-plans` duyệt giáo án tổ mình |
| `totruong@demo.scn` | to_truong + gvbm | Menu Tổ chuyên môn + Giảng dạy bộ môn; nhập điểm lớp mình dạy |
| `pht@demo.scn` | pht + gvbm | Điều hành cơ sở 2 + menu giảng dạy của GV |
| `bgh@demo.scn` | bgh + gvbm | Toàn quyền BGH + công cụ soạn học liệu của GV |
| `gvbm@demo.scn` | gvbm thuần | Menu gọn chỉ phần giảng dạy; vào `/team/*` bị chặn - chứng minh quyền vẫn giữ |

Phân quyền kiêm nhiệm được quản trị tại `/school/users` (BGH tick vai
trò kiêm nhiệm; chỉ vai trò nhân sự được chọn, `admin` không thể kiêm).
Menu và quyền được tính từ "vai trò chính + kiêm nhiệm" ở mọi tầng
(UI, server action, RLS database).

## 4. Kiểm chứng phân quyền nhanh (security smoke)

| Kiểm tra | Cách demo | Kỳ vọng |
|---|---|---|
| Cô lập trường | `bgh.cva@demo.scn` vào URL của trường ND | Chỉ thấy dữ liệu CVA |
| Giới hạn PHT | `pht@demo.scn` xem danh sách lớp | Chỉ các lớp Cơ sở 2 |
| GVBM không có quyền CN | `gvbm@demo.scn` vào route GVCN-only | Redirect về home GVBM |
| PH chỉ thấy con mình | `phuhuynh@demo.scn` | Chỉ hồ sơ em Nguyễn Gia Bảo |
| UBND read-only | `ubnd@demo.scn` | Không có nút ghi |
| Menu theo quyền | Soi menu từng tài khoản | Mỗi role chỉ thấy chức năng mình được cấp (kiểm chứng tự động: `node scripts/check-nav-access.mjs`) |

## 5. Ghi chú vận hành

- Re-seed lại toàn bộ: `node scripts/seed-real-demo.mjs` (wipe dữ liệu 3 trường + tài khoản `*.scn`, giữ nguyên user app khác).
- Khôi phục ngân hàng câu hỏi TVC360: `node scripts/restore-tvc-banks.mjs`.
- Tài khoản English Arena (`*@students.ioe-practice.example`) là của app khác dùng chung DB - không động vào.
