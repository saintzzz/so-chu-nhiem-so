# Chiến lược hệ thống theo 6 đầu mục - tài liệu tổng hợp

Cập nhật 2026-11-08. Gộp toàn bộ phân tích + trạng thái + công việc đã làm
cho 6 đầu mục: căn cứ pháp lý, điều lệ quản trị trường, giá trị gia tăng,
trải nghiệm người dùng, kết nối CSDL ngành/dữ liệu cũ, bảo mật dữ liệu.

Nguồn: `AUDIT-6DM-2026-11-08.md` (audit), `CR-116` (work items W1-W4),
`CSDL-NGANH-CONNECTOR.md` (spec), `GIA-TRI-GIA-TANG.md` (định vị).

---

## PHẦN 1 - Phần mềm xây dựng trên quy định hiện hành nào

Hệ thống được thiết kế và audit theo bộ văn bản sau (trạng thái: ĐÃ ÁP
DỤNG trong code, không chỉ trên giấy):

| Văn bản | Phạm vi áp dụng trong hệ thống |
|---|---|
| **TT 15/2026/TT-BGDĐT** | Điều lệ trường THCS/THPT/liên cấp mới nhất (hiệu lực 10/5/2026, thay TT 32/2020 + TT 28/2020). Toàn bộ quy trình điều hành: phân công vai trò (BGH, PHT, GVCN, GVBM, tổ trưởng, ban CMHS), kiểm tra duyệt (giáo án, sổ chủ nhiệm, hoạt động), mối quan hệ trường-gia đình. Đã cập nhật tham chiếu UI qua CR-018. |
| **TT 22/2021/TT-BGDĐT** | Khung đánh giá học lực: cột điểm ĐĐGtx/ĐĐGgk/ĐĐGck, ĐTBm HK1/HK2/cả năm tách biệt, môn nhận xét Đạt/Chưa đạt, tiêu chí xếp loại và lên lớp - code tại `src/lib/tt22.ts`. |
| **Quyết định 3016/QĐ-BGDĐT** | Học bạ điện tử: export học bạ XML chuẩn SCN-QD3016-v1 kèm ký xác thực hệ thống (`src/lib/hbxml.ts`, màn hình `/records/exports`). |
| **TT 26/2019 + TT 42/2021/TT-BGDĐT** | CSDL ngành GD&ĐT: mã định danh (tối đa 20 ký tự, bất biến) cho HS/GV/CBQL/NV - trường dữ liệu `students.national_id` + `profiles.national_id` (CR-116). |
| **Luật 91/2025 (PDPL) + NĐ 13/2023** | Dữ liệu cá nhân: trang legal public, DPIA v2, sổ đồng thuận `consent_records`, sổ yêu cầu chủ thể `data_requests`, runbook breach 72h, retention policy. |
| **NĐ 356/2025/NĐ-CP** | Chuyển dữ liệu ra nước ngoài: hồ sơ đánh giá tác động chuyển dữ liệu (khung + data map 7 processor đã điền). |
| **NĐ 130/2018/NĐ-CP** | Chữ ký số: hệ thống dùng nhãn "ký xác thực hệ thống" (HMAC nội bộ) thay "ký số" - tránh hiểu nhầm chữ ký số CA hợp pháp. |
| **TT 10/2025/TT-BNV** | Chính quyền địa phương 2 cấp: không có Phòng GD&ĐT - UBND xã nghiệm thu, Sở GD&ĐT quản lý chuyên môn (CR-017). |
| **NĐ 53/2022/NĐ-CP** | Lưu trữ dữ liệu - phân tích tại Phần 6. |

Theo dõi: dự thảo sửa TT 22/2021 đang được BGD lấy ý kiến - khi có thông tư
mới sẽ mở CR thay công thức tính ĐTBm/xếp loại.

## PHẦN 2 - Quản lý nhà trường theo điều lệ/thông tư nào

**Căn cứ quản trị: TT 15/2026/TT-BGDĐT** - điều lệ áp dụng chung cho trường
tiểu học, THCS, THPT và **trường phổ thông có nhiều cấp học** (không tách
văn bản riêng từng cấp như thế hệ TT 28/32 cũ).

Hỗ trợ cấp trường trong hệ thống:

- Type `school.level`: `th | thcs | thpt | lien_cap` - 4 loại kể cả trường
  liên cấp (một trường nhiều cấp học, dùng chung nhân sự/TKB/cơ sở).
- Luồng đánh giá phân biệt theo cấp: tiểu học chủ yếu nhận xét Đạt/Chưa
  đạt, THCS/THPT chấm điểm số theo TT22 - cả hai đường đều chạy trong demo
  (2 trường TH + 1 trường THCS, ~1275 HS).
- THPT: xét tốt nghiệp (`/school/graduation`), tuyển sinh khối 10
  (`/apply`), đánh giá điểm - đầy đủ.
- Cấu trúc tổ chức theo Điều lệ: BGH - PHT (có thể theo campus), tổ chuyên
  môn (tổ trưởng), GVCN, GVBM, ban cán sự lớp, ban CMHS, nhân viên y tế,
  kế toán, thư viện, văn thư.
- Sở GD&ĐT + UBND cấp xã: cấp quản lý bên trên trường theo mô hình chính
  quyền 2 cấp (TT 10/2025).

Còn cần bổ sung khi pilot mở rộng: 1 tenant THPT và 1 tenant liên cấp thật
để test luồng thực tế (đã ghi trong backlog W3).

## PHẦN 3 - Giá trị gia tăng

Chi tiết đầy đủ tại `docs/positioning/GIA-TRI-GIA-TANG.md`. Tóm tắt:

**Tại sao cần**: GVCN mất 3-5 giờ/tuần vào sổ sách chép thủ công; dữ liệu
rải rác Excel/Zalo; TT 15/2026 + Luật 91/2025 bắt buộc dữ liệu trẻ em được
quản lý có kiểm soát; CSDL ngành yêu cầu mã định danh thống nhất.

**Trường cần gì**: chỉ cần trình duyệt + file Excel danh sách (hoặc file
xuất SMAS/vnEdu); không server, không IT, khởi tạo 1 buổi cho ~500 HS;
go-live chỉ cần GVCN điểm danh tuần 1.

**Khác biệt**: SMAS/vnEdu mạnh "báo cáo lên Bộ" nhưng yếu công việc hằng
ngày của GV; hệ này bắt đầu từ GVCN (điểm danh 1 chạm -> báo cáo ngày tự
động -> sổ chủ nhiệm tự sinh), AI đa tầng có fallback không cần API key,
19 module bán lẻ như phụ kiện, mã định danh ngành là trường dữ liệu chính.

## PHẦN 4 - Trải nghiệm người dùng: chức năng hay dùng hiển thị thẻ

Đã triển khai (CR-116-W2, commit kèm):

- Component `QuickActions` (`src/components/quick-actions.tsx`): strip
  thẻ 4-6 chức năng hay dùng nhất, icon + mô tả ngắn, đặt ngay dưới
  PageHeader của màn hình đầu tiên sau đăng nhập.
- Cấu hình theo vai trò (`src/lib/quick-actions.ts`):

| Vai trò | Màn hình đầu | Thẻ hay dùng |
|---|---|---|
| GVCN | `/dashboard` | Điểm danh, Báo cáo ngày BGH, Sổ điểm, Sổ đầu bài, Nhận xét rèn luyện, Tin nhắn PH |
| GVBM | `/academics/grades` | Lịch dạy, Nhập điểm, Sổ đầu bài, Bài tập trực tuyến, Giáo án, Trao đổi GVCN |
| Tổ trưởng | `/team/home` | Duyệt giáo án, Đánh giá năng lực, Sinh hoạt CM, GV trong tổ |
| BGH/PHT | `/school/dashboard` | Báo cáo ngày các lớp, Ký duyệt sổ, Phê duyệt, TKB trường, Radar, Nhân sự |
| Kế toán | `/school/staff` | Hóa đơn & thu tiền, Đợt thu, Danh mục, Báo cáo thu chi, Tích hợp TT |
| Sở/UBND/Admin | `/dept/dashboard` | Trường học, Dữ liệu & báo cáo, Xã/phường, Người dùng, Module |

- PH/HS: portal đã là màn hình tổng hợp một trang (điểm, chuyên cần, tin
  nhắn, học bạ, bài thi) - bản chất đã là "chức năng hay dùng" dựng sẵn.
- Static theo vai trò (không tracking cá nhân) - nếu sau này cần cá nhân
  hóa theo tần suất thì mở CR riêng.

## PHẦN 5 - Kết nối CSDL Bộ + chuyển dữ liệu từ hệ thống cũ

Spec đầy đủ tại `docs/research/CSDL-NGANH-CONNECTOR.md`. Bản chất:

**CSDL ngành = VEMIS** (`csdl.moet.gov.vn`, TT 26/2019 + TT 42/2021).
Cơ chế hiện nay là nhập/xuất **file chuẩn V.EMIS** qua tài khoản trường do
Sở cấp - không phải REST API công khai.

Đã làm (CR-116-W3):

- `profiles.national_id` (GV/CBQL/NV) + `students.national_id` (HS) - lưu
  mã định danh ngành tối đa 20 ký tự, nhập/sửa tại `/school/users` và hồ
  sơ HS.
- **Chuyển dữ liệu 2 chiều với hệ thống cũ** tại `/records/upload`:
  - Import: đọc được file xuất thật của vnEdu/SMAS - tự bỏ khối tiêu đề,
    nhận diện "Mã học sinh" -> `code`, "Mã VEMIS" -> `national_id`, "Họ
    đệm"+"Tên" gộp lại, "Chỗ ở hiện nay"/"Hộ khẩu thường trú" -> địa chỉ;
    cột cha/mẹ/SĐT/email -> tạo `parents` + `parent_students` (dedupe).
  - Export: xuất file `.xlsx` đúng mẫu-1 vnEdu (26 cột chuẩn + khối tiêu
    đề) để vnEdu/SMAS import ngược lại hoặc nộp lên `csdl.moet.gov.vn`.
  - Round-trip đã verify: `scripts/check-vnedu-roundtrip.mjs` + E2E thật
    (export lớp thật -> parse lại 0 lỗi).
- Học bạ XML QĐ3016 + Excel import toàn diện (HS, GV, điểm, chuyên cần,
  khởi tạo trường) - sẵn có.
- Integration framework (connectors + outbox + retry worker) - sẵn sàng
  cắm connector `csdl_nganh` khi Bộ mở API.

Còn lại: `schools.national_id` (mã định danh cơ sở GD), mẫu file V.EMIS
chính thức từ trường pilot để hoàn thiện export, đo endpoint API trên
csdl.moet.gov.vn khi có credential trường.

## PHẦN 6 - Bảo mật dữ liệu: provider VN + consent theo tuổi

### 6.1 Khung pháp lý thực tế

- **NĐ 13/2023 + Luật 91/2025**: dữ liệu HS là dữ liệu trẻ em = nhạy cảm -
  cần đồng thuận PHHS, DPIA, quyền chủ thể, breach 72h. ĐÃ CÓ trong hệ
  thống (CR-115).
- **Consent theo tuổi**: <14 tuổi bắt buộc người giám hộ đồng thuận;
  >=14 HS có thể tự đồng thuận (vẫn nên ghi kèm PH). Hệ thống sẽ suy diễn
  nhóm tuổi từ `students.dob` (CR-116-W4 - backlog kỹ thuật).
- **NĐ 53/2022 Điều 26**: DN **trong nước** phải lưu trữ tại VN: thông tin
  cá nhân người dùng dịch vụ, dữ liệu do người dùng tạo, mối quan hệ.
  DN **nước ngoài** chỉ bị áp khi: dịch vụ bị dùng vi phạm ANM + A05 gửi
  văn bản + không chấp hành (khi đó có 12 tháng để tuân thủ).
- **Dữ liệu trẻ em** thuộc nhóm "dữ liệu quan trọng" theo NĐ 53 - khi
  triển khai quy mô Sở/toàn quốc sẽ cần đánh giá ATTT với A05 (Cục An
  ninh mạng, Bộ Công an).

### 6.2 Câu hỏi đặt ra: có phải thay toàn bộ hạ tầng không? - KHÔNG

Kết luận nghiên cứu: **có thể giữ nguyên Supabase + Vercel hiện tại** mà
vẫn đạt compliance, vì luật không cấm tuyệt đối chuyển dữ liệu ra nước
ngoài - nó yêu cầu hồ sơ đánh giá + bảo vệ thích đáng. Ba lớp phương án:

**Phương án A - Giữ nguyên hạ tầng, hoàn thiện pháp lý (dùng ngay):**

1. Hồ sơ chuyển dữ liệu NĐ 356 đã sẵn khung - chỉ cần điền region Supabase
   thật + DPA các provider (đã tải 6/7, OpenRouter đang chờ trả lời).
2. Region: Supabase cho phép chọn region - nếu project đang ở region gần
   VN nhất (Singapore) thì ghi nhận; khi cần region châu Á khác thì migrate
   project (Supabase hỗ trợ).
3. AI providers: hệ thống ĐÃ pseudonymize + redact PII trước khi gửi AI
   (`src/lib/ai-privacy.ts`) - dữ liệu nhận diện trẻ em không ra nước
   ngoài qua kênh AI.
4. Giá: $0 - chỉ hoàn thiện giấy tờ. Compliance: đủ theo NĐ 13/356 nếu
   hồ sơ đầy đủ.

**Phương án B - Giữ stack, đổi chỗ đất (khi trường công yêu cầu dữ liệu ở
VN):**

- **Supabase là open-source**: self-host Supabase/PostgreSQL trên cloud
  có pháp nhân VN - Viettel IDC, VNPT Cloud, CMC Cloud, FPT Cloud đều có
  sẵn Postgres/VPS. Ứng dụng không đổi code (cùng Postgres + cùng API),
  chỉ đổi connection string + storage endpoint.
- **Vercel -> VPS VN**: Next.js chạy được trên VPS bất kỳ (Node runtime);
  hoặc giữ Vercel cho tĩnh + CDN còn compute nhạy cảm chuyển về VN
  (Vercel không có region VN - đây là điểm cần cấu trúc hybrid).
- **Resend -> SMTP VN**: dùng SMTP của VNPT/Viettel hosting hoặc dịch vụ
  email có máy chủ VN; code email đã trừu tượng (`src/lib/email.ts`).
- **AI providers**: giữ nguyên - chỉ dữ liệu đã pseudonymize đi ra.
- Chi phí ước tính: VPS/Postgres VN ~1-3 triệu/tháng cho trường đơn; so
  với việc viết lại là rẻ hơn nhiều. Compliance: mạnh nhất - toàn bộ dữ
  liệu nhận diện nằm trong VN.
- **Đã có deploy kit**: `deploy/vn-selfhost/` (Docker Compose postgres +
  gotrue + postgrest + storage + kong + Caddy, runbook đầy đủ) - đã verify
  E2E trên stack local: 192/192 tables, 423/423 policies, app login +
  dashboard chạy trên self-host (CR-117).

**Phương án C - Tầng mã hóa tầng ứng dụng (bổ sung, kết hợp A hoặc B):**

- Mã hóa trường nhạy cảm (sức khỏe, tư vấn, hành vi, số tiền) ở tầng ứng
  dụng trước khi ghi DB: AES-256-GCM với khóa đặt trong env/KMS - dù DB ở
  nước ngoài cũng chỉ là ciphertext.
- Không cần thay hạ tầng; ảnh hưởng: không tìm kiếm full-text trên trường
  mã hóa (thiết kế trường cần chọn lọc) + phải quản lý khóa.
- Áp dụng tốt nhất cho: `counseling`, `health`, `safety`, ghi chú rèn
  luyện - các bảng dữ liệu nhạy cảm cao nhất.

### 6.3 Khuyến nghị lộ trình

| Giai đoạn | Phương án | Lý do |
|---|---|---|
| Hiện tại (pilot, trường tư/thương mại) | A | Hồ sơ NĐ356 + DPA + pseudonymize AI là đủ compliance hiện hành |
| Khi bán cho trường công có yêu cầu dữ liệu VN | B | Self-host Supabase trên cloud VN - code không đổi, đáp ứng NĐ53 Đ26 cho DN trong nước |
| Khi mở rộng quy mô Sở/toàn quốc | B + C + hồ sơ A05 | Dữ liệu quan trọng -> lưu VN + mã hóa trường nhạy cảm + đánh giá ATTT |

Không cần viết lại ứng dụng ở bất kỳ phương án nào - kiến trúc (Supabase
open-source + Next.js portable + provider AI trừu tượng) đã thiết kế để
đổi chỗ đất khi cần.

### 6.4 Trạng thái hiện tại trong hệ thống

ĐÃ CÓ: sổ đồng thuận + sổ yêu cầu chủ thể (`/school/privacy`), DPIA v2,
runbook breach, retention, legal pages public, redact PII trước AI, RLS
đầy đủ, VNeID prep (`vneid_subject_id`).

BACKLOG (CR-116-W4): suy diễn nhóm tuổi từ `dob` - cảnh báo khi ghi
consent sai đối tượng + bộ lọc "HS <14 chưa có consent PH".

---

## Bảng tổng kết

| Đầu mục | Trạng thái sau CR-116 | Còn lại |
|---|---|---|
| 1. Quy định hiện hành | ĐẠT - 9 văn bản trong code | Theo dõi dự thảo TT22 mới |
| 2. Điều lệ quản trị | ĐẠT - TT15/2026, 4 loại trường | Tenant THPT/liên cấp khi pilot |
| 3. Giá trị gia tăng | ĐẠT - doc định vị sẵn | - |
| 4. UX thẻ hay dùng | ĐẠT - QuickActions 6 vai trò | Cá nhân hóa (nếu cần) |
| 5. CSDL Bộ/VNEDU | NỀN TẢNG + 2 chiều đã verify round-trip | schools.national_id, mẫu V.EMIS thật, endpoint khi Bộ mở |
| 6. Bảo mật VN | NỀN TẢNG + lộ trình A/B/C rõ ràng + deploy kit self-host đã verify | W4 consent tuổi; region thật; VM VN + cutover khi trường công yêu cầu |
