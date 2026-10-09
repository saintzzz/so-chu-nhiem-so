# Kịch bản demo - Sổ Chủ Nhiệm Số & Công cụ số Giáo viên

Phiên bản: 2.0 · Ngày demo: 15/10/2026 · Môi trường: https://sochunhiem.vieschool.com

Tài liệu này là kịch bản demo theo vai trò, dùng bộ dữ liệu thực tế được seed lại theo CR-036. Mật khẩu demo chung: `demo1234`. Một ứng dụng duy nhất gồm 2 module: Sổ Chủ Nhiệm Số (vận hành lớp/nhà trường) và Studio - công cụ số giáo viên TVC360 (soạn học liệu, ngân hàng câu hỏi, đề kiểm tra).

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
| Hiệu trưởng ND | hainv@nd.scn | Nguyễn Văn Hải - THCS Nguyễn Du, kiêm dạy (`bgh`+`gvbm`) |
| PHT cơ sở 2 ND | duclm@nd.scn | Lê Minh Đức - chỉ thấy các lớp A3, kiêm dạy (`pht`+`gvbm`) |
| Tổ trưởng ND | hanhlth@nd.scn | Lê Thị Hồng Hạnh - Tổ Toán-Tự nhiên, kiêm dạy (`to_truong`+`gvbm`) |
| GVCN ND | anhptl@nd.scn | Phạm Thị Lan Anh - GVCN 8A2, dạy Toán, Tổ trưởng Toán-TN (`gvcn`+`gvbm`+`to_truong`) |
| GVBM ND | minhtv@nd.scn | Trần Văn Minh - GV Vật lý, Tổ Toán-TN (đơn vai trò) |
| Kế toán ND | trangpt@nd.scn | Phạm Thu Trang |
| Phụ huynh | annv@nd.scn | Nguyễn Văn An - bố em Nguyễn Gia Bảo lớp 8A2 |
| Học sinh | baong@nd.scn | Nguyễn Gia Bảo - lớp 8A2 |
| Sở GD&ĐT | sovqt@demo.scn | Vũ Quản Trị Sở - xem được cả 3 trường |
| UBND | daonvl@demo.scn | Ngô Văn Lãnh Đạo - dashboard địa bàn, chỉ đọc |
| Quản trị | admin@demo.scn | Toàn hệ thống |

Trường khác: `phuongttm@cva.scn`, `oanhdtk@cva.scn` (GVCN 3A2), `lienttb@cva.scn`, `havt@cva.scn`; `longhd@kd.scn`, `ngaltt@kd.scn` (GVCN 3A2), `anhdn@kd.scn`.

Các GV còn lại của từng trường login bằng email dạng `tenvt@nd.scn` / `@cva.scn` / `@kd.scn` (vd: `minhtv@nd.scn`), cùng mật khẩu `demo1234` - xem danh sách trong `scripts/seed-real-demo.mjs`.

## 3. Kịch bản theo luồng

### Luồng A - GVCN một ngày làm việc (anhptl@nd.scn, ~10 phút)

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

1. `hanhlth@nd.scn` → **Tổ chuyên môn** (`/dept`): thấy GV trong Tổ Toán-TN, giáo án chờ duyệt của cô Lan Anh → xem bản cấu trúc CV 5512 → **Duyệt** (hoặc trả về kèm nhận xét).
2. `hainv@nd.scn` → **Phê duyệt** (`/school/approvals`): giáo án `team_approved` hiện trong hàng chờ → **Duyệt** → trạng thái `approved`, GV nhận thông báo.
3. Điểm nhấn: tổ trưởng chỉ thấy giáo án của GV trong tổ mình; BGH thấy toàn trường. Cô Lan Anh (đang là GVCN) cũng mở được `/team/lesson-plans` vì kiêm tổ trưởng - menu "Tổ chuyên môn" chỉ xuất hiện khi có vai trò đó.

### Luồng C - Điều hành trường (hainv@nd.scn + duclm@nd.scn, ~8 phút)

1. **Dashboard BGH**: KPI toàn trường - chuyên cần, sự cố, radar cảnh báo, tình hình phê duyệt.
2. **TKB toàn trường** (`/school/timetable`): 360 tiết/tuần của 12 lớp, không tiết trống.
3. **Phân công** (`/school/assignments`): danh sách GVCN từng lớp + GVBM phân môn.
4. **Nhân sự** (`/school/users`): 34 cán bộ có mã NV, hợp đồng, trình độ, tổ chuyên môn.
5. **So sánh PHT**: đăng nhập `duclm@nd.scn` → cùng màn hình nhưng chỉ thấy các lớp A3 (Cơ sở 2) - demo giới hạn phạm vi cơ sở.
6. **Báo cáo** (`/school/reports`): báo cáo tổng hợp gửi Sở.

### Luồng D - Phụ huynh & học sinh (~5 phút)

1. `annv@nd.scn` → **Cổng PH** (`/portal/parent`): thấy con Nguyễn Gia Bảo 8A2 - điểm, chuyên cần, hạnh kiểm, thông báo từ GVCN ở luồng A.
2. Nhắn tin cho GVCN → đặt lịch hẹn → GVCN nhận thông báo.
3. `baong@nd.scn` → **Cổng HS**: TKB của 8A2, điểm, hạnh kiểm, thông báo.

### Luồng E - Cấp trên & đa trường (sogd + ubnd + admin, ~5 phút)

1. `sovqt@demo.scn` → **Sở GD&ĐT** (`/dept`): tổng hợp 3 trường, `/dept/schools` tạo trường mới, `/dept/usage` giám sát sử dụng.
2. `daonvl@demo.scn` → dashboard địa bàn, chỉ đọc.
3. `admin@demo.scn` → quản trị hệ thống.

### Luồng F - Trường tiểu học (oanhdtk@cva.scn, ~5 phút)

1. Đăng nhập GVCN 3A2 Chu Văn An: dữ liệu đánh giá theo **mức độ** (không phải điểm số) đúng TT 22/2021 cho tiểu học.
2. Tổ trưởng `lienttb@cva.scn` duyệt giáo án tổ Khối 1-2.
3. `phuongttm@cva.scn` xem dashboard 15 lớp.

### Luồng G - Vai trò kiêm nhiệm (CR-038, ~4 phút)

Thực tế trường VN: GVCN luôn kiêm dạy bộ môn, tổ trưởng vẫn đứng lớp,
PHT/Hiệu trưởng vẫn dạy. Hệ thống hỗ trợ bằng "vai trò kiêm nhiệm".

| Tài khoản | Vai trò | Demo nhanh |
|---|---|---|
| `anhptl@nd.scn` | gvcn + gvbm + to_truong | Topbar 3 nhãn; menu gộp đủ Chuyên cần + Tổ chuyên môn; vào được `/team/lesson-plans` duyệt giáo án tổ mình |
| `hanhlth@nd.scn` | to_truong + gvbm | Menu Tổ chuyên môn + Giảng dạy bộ môn; nhập điểm lớp mình dạy |
| `duclm@nd.scn` | pht + gvbm | Điều hành cơ sở 2 + menu giảng dạy của GV |
| `hainv@nd.scn` | bgh + gvbm | Toàn quyền BGH + công cụ soạn học liệu của GV |
| `minhtv@nd.scn` | gvbm thuần | Menu gọn chỉ phần giảng dạy; vào `/team/*` bị chặn - chứng minh quyền vẫn giữ |

Phân quyền kiêm nhiệm được quản trị tại `/school/users` (BGH tick vai
trò kiêm nhiệm; chỉ vai trò nhân sự được chọn, `admin` không thể kiêm).
Menu và quyền được tính từ "vai trò chính + kiêm nhiệm" ở mọi tầng
(UI, server action, RLS database).

### Luồng H - Studio công cụ số giáo viên (minhtv@nd.scn, ~5 phút)

Studio là module TVC360 tích hợp ngay trong app - cùng đăng nhập, cùng
phân quyền, ngân hàng câu hỏi chung của trường.

1. **Tất cả công cụ** (`/studio`): nhóm DC (soạn - đánh giá), T (Toán), V (Văn), A (Anh). Môn tự preselect theo môn phụ trách của GV.
2. **DC-01 Kế hoạch bài dạy**: chọn môn/khối/bài → Sinh → KHBD đúng khung CV 5512 (5 phần a-đ) → chỉnh sửa → lưu Thư viện → xuất DOCX.
3. **DC-02 → DC-03**: lập ma trận đề theo YCCĐ → sinh đề rút câu từ ngân hàng của trường, kèm đáp án + biên bản phản biện.
4. **Ngân hàng câu hỏi** (`/studio/questions`): filter Cả trường / Của tôi / Môn của tổ; câu hỏi đã được dọn trùng (mỗi câu gộp đủ YCCĐ); môn Ngữ văn chỉ khối 6-12, Tiếng Việt 1-5 đúng CTGDPT 2018.
5. **A-03 Hội thoại + bài nghe Tiếng Anh**: sinh hội thoại theo chủ đề → material có **audio nghe thật** (giọng neural, phát ngay trong trình duyệt) - material mẫu "Dialogue: At the Market (A2)" lớp 5 ở trường Chu Văn An, đăng nhập `anhhd@cva.scn` để xem/phát.
6. **Xuất - chia sẻ**: mọi học liệu xuất DOCX/PDF/PPTX; học liệu `published` mọi người trong trường xem được, bản nháp chỉ tác giả + người duyệt.

Điểm nhấn: AI sinh nội dung có kiểm chứng 2 lớp (khung cứng + bộ lọc lạc đề), hết quota tự chuyển engine rule-based - demo không bao giờ "đứng".

## 4. Kiểm chứng phân quyền nhanh (security smoke)

| Kiểm tra | Cách demo | Kỳ vọng |
|---|---|---|
| Cô lập trường | `phuongttm@cva.scn` vào URL của trường ND | Chỉ thấy dữ liệu CVA |
| Giới hạn PHT | `duclm@nd.scn` xem danh sách lớp | Chỉ các lớp Cơ sở 2 |
| GVBM không có quyền CN | `minhtv@nd.scn` vào route GVCN-only | Redirect về home GVBM |
| PH chỉ thấy con mình | `annv@nd.scn` | Chỉ hồ sơ em Nguyễn Gia Bảo |
| UBND read-only | `daonvl@demo.scn` | Không có nút ghi |
| Menu theo quyền | Soi menu từng tài khoản | Mỗi role chỉ thấy chức năng mình được cấp (kiểm chứng tự động: `node scripts/check-nav-access.mjs`) |

## 5. Ghi chú vận hành

- Re-seed lại toàn bộ: `node scripts/seed-real-demo.mjs` (wipe dữ liệu 3 trường + tài khoản `*.scn`, giữ nguyên user app khác).
- Khôi phục ngân hàng câu hỏi TVC360: `node scripts/restore-tvc-banks.mjs`.
- Tài khoản English Arena (`*@students.ioe-practice.example`) là của app khác dùng chung DB - không động vào.
