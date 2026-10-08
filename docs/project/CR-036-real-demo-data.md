# CR-036: Bộ dữ liệu demo sát thực tế (wipe + re-seed)

## Yêu cầu

Data demo hiện tại không sát thực tế: 300 tài khoản `gv001@nd.test` kiểu load-test,
GV không phân bộ môn/tổ chuyên môn rõ ràng, các trường phụ thiếu nhân sự.
Yêu cầu: xóa toàn bộ data seed cũ, seed lại dataset mà **mỗi trường có đầy đủ vai
trò theo đúng mô hình nhà trường VN** (TT 15/2026 Điều lệ trường), GV được phân về
tổ chuyên môn + môn dạy (departments.subject_ids, teacher_subjects), phân quyền
đầy đủ (staff_code, employment_type, qualification, campus). Cập nhật user guide +
kịch bản demo.

## Phạm vi

- Giữ 3 trường + ID cố định (referenced nơi khác): THCS Nguyễn Du, TH Chu Văn An,
  TH Kim Đồng.
- XÓA: mọi business data của 3 trường + auth users `*@demo.scn`, `*@school.scn`,
  `*@nd|cva|kd.test`.
- GIỮ: `tvc_*` content (ngân hàng câu hỏi/đề của tvc360) - reassign owner sang GV
  mới; users `@students.ioe-practice.example` (English Arena); org_units.
- KHÔNG đụng: schema, RLS, app code.

## Cơ cấu nhân sự mới (sát TT 15/2026)

### THCS Nguyễn Du - 12 lớp (6A1-9A3), 2 cơ sở
- BGH: 1 Hiệu trưởng + 1 Phó hiệu trưởng (bgh) + 1 PHT phụ trách cơ sở 2 (pht, campus CS2)
- 1 kế toán
- 4 tổ chuyên môn (mỗi tổ 1 tổ trưởng, head_id):
  - Tổ Toán - Tự nhiên: Toán, Vật lý, Hóa học, Sinh học, Tin học
  - Tổ Văn - Xã hội: Ngữ văn, Lịch sử và Địa lý, GDCD
  - Tổ Ngoại ngữ: Tiếng Anh
  - Tổ Thể chất - Nghệ thuật: Thể dục, Âm nhạc, Mỹ thuật, Công nghệ
- 24 GV bộ môn theo định biên từng môn; 12 GVCN (kiêm nhiệm GVBM, mỗi lớp 1)
- ~36 HS/lớp (~430 HS), 2 PH/HS phổ biến, BCS + tổ trưởng tổ

### TH Chu Văn An - 15 lớp (1A1-5A3), 1 cơ sở
- 1 HT + 1 PHT + 1 kế toán
- 4 tổ: Khối 1-2, Khối 3, Khối 4-5, Chuyên biệt (Anh/Tin/TD/Nhạc/MT/CN)
- 15 GVCN (dạy Tiếng Việt + Toán + Đạo đức + TNXH/KH/LS-ĐL theo khối)
- 8 GV chuyên biệt (gvbm)
- ~33 HS/lớp (~495 HS)

### TH Kim Đồng - 10 lớp (1A1-5A2), 1 cơ sở
- 1 HT + 1 PHT + 1 kế toán
- 3 tổ: Khối 1-2, Khối 3-5, Chuyên biệt
- 10 GVCN + 6 GV chuyên biệt
- ~33 HS/lớp (~330 HS)

### Cấp sở / hệ thống
- sogd@demo.scn (Sở GD&ĐT), ubnd@demo.scn (UBND xã), admin@demo.scn
- phuhuynh@demo.scn + hocsinh@demo.scn (liên kết HS 8A2 - ND)

## Tài khoản demo chuẩn (password: demo1234)

| Email | Role | Trường | Nhân sự |
|---|---|---|---|
| gvcn@demo.scn | gvcn | ND | Phạm Thị Lan Anh - GVCN 8A2, dạy Toán, Tổ Toán-TN |
| gvbm@demo.scn | gvbm | ND | Trần Văn Minh - GV Vật lý, Tổ Toán-TN |
| totruong@demo.scn | to_truong | ND | Lê Thị Hồng Hạnh - TT Tổ Toán-TN |
| bgh@demo.scn | bgh | ND | Nguyễn Văn Hải - Hiệu trưởng |
| pht@demo.scn | pht | ND | Lê Minh Đức - PHT phụ trách CS2 |
| ketoan@demo.scn | ke_toan | ND | Phạm Thu Trang |
| gvcn.cva@demo.scn / bgh.cva@demo.scn / totruong.cva@demo.scn | | CVA | |
| gvcn.kd@demo.scn / bgh.kd@demo.scn | | KD | |
| phuhuynh@demo.scn | phu_huynh | ND | PH em Nguyễn Gia Bảo 8A2 |
| hocsinh@demo.scn | hoc_sinh | ND | Nguyễn Gia Bảo 8A2 |
| sogd@demo.scn / ubnd@demo.scn / admin@demo.scn | | - | |

## Phương án thực hiện

- `scripts/seed-real-demo.mjs`: pha wipe (xóa leaf→root theo FK scope trường) +
  pha seed parameterized theo cấu hình từng trường. Idempotent: chạy lại wipe hết
  rồi seed lại.
- Reassign `tvc.questions/exams/matrices/generations` owner sang GV mới cùng
  trường trước khi xóa auth users cũ.

## Rủi ro & kiểm chứng

- Wipe dùng service-role, giới hạn theo school_id/email-domain demo - không đụng
  tvc schema, ioe users.
- Verify sau seed: count theo role/trường, teacher_subjects coverage đủ mọi môn,
  mỗi lớp có gvcn_id, tổ có head_id; Playwright spot-check theo role.

## Kết quả thực hiện (verify trực tiếp DB)

- Seed chạy xong cho cả 3 trường; `auth.users` cũ của demo đã xóa sạch, user
  `*@students.ioe-practice.example` (English Arena) giữ nguyên.
- Nhân sự: ND 34 cán bộ / 12 lớp / 435 HS; CVA 30 cán bộ / 15 lớp / ~496 HS;
  KD 22 cán bộ / 10 lớp / ~341 HS. Phân vai đúng: mỗi trường có bgh (HT+PHT),
  ke_toan, to_truong theo tổ, gvcn đủ từng lớp, gvbm phân môn.
- Toàn vẹn quan hệ: `timetable_entries` 985/985 có GV; 0 lớp thiếu GVCN;
  0 tổ thiếu head_id; 0 môn thiếu GV; 0 HS mồ côi.
- Phân bộ môn: `teacher_subjects` ND 28 / CVA 81 / KD 55; mỗi GV có
  `department_id` + staff_code + employment_type + qualification.
- TVC360 (`schema tvc`): ngân hàng theo trường khôi phục 360 câu/trường gán về
  GV thật của trường (ND 28 owners, CVA 27, KD 19); 2499 câu template chung
  giữ nguyên; **0 owner mồ côi** trên questions/exams/matrices/khbd_templates/
  ai_jobs/generations (đối chiếu `tvc.profiles` - bảng owner thật của app TVC).
- Tài khoản demo: xem bảng mục "Tài khoản demo chuẩn" - tất cả đã verify role +
  school + lớp chủ nhiệm trong DB (vd `gvcn@demo.scn` = GVCN 8A2,
  `gvcn.cva@demo.scn` = GVCN 3A2 CVA).
- Docs cập nhật: `docs/user-guide/MO-TA-CHUC-NANG.md` (bảng vai trò + cơ cấu
  trường), `docs/user-guide/HUONG-DAN-SU-DUNG.md` (phần đăng nhập),
  `docs/user-guide/KICH-BAN-DEMO.md` (kịch bản demo mới theo luồng A-F).
