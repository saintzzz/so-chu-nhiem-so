# Mô tả chức năng - Sổ Chủ Nhiệm Số

Phiên bản: 1.0 · Ngày: 21/09/2026 · Môi trường: https://so-chu-nhiem-so-theta.vercel.app

## 1. Tổng quan

**Sổ Chủ Nhiệm Số** là nền tảng số hóa công tác chủ nhiệm và quản lý trường học cho trường phổ thông Việt Nam (Tiểu học, THCS, THPT - kể cả mô hình nhiều cơ sở/phân hiệu). Hệ thống thay thế sổ chủ nhiệm giấy bằng quy trình nghiệp vụ số: điểm danh, sổ đầu bài, sổ điểm, rèn luyện, tư vấn học sinh, liên lạc phụ huynh, hoạt động giáo dục, an toàn học sinh, thi đua và báo cáo cấp trên - đồng bộ thời gian thực trên một cơ sở dữ liệu chung.

### Nguyên tắc nghiệp vụ

- Một sự thật nghiệp vụ chỉ ghi một nơi và **đồng bộ** sang các màn hình liên quan (VD: vắng trong sổ đầu bài tự cập nhật điểm danh ngày).
- Mọi hành động quan trọng ghi **audit log** (người làm, việc gì, đối tượng, payload).
- Hành động ảnh hưởng người khác tạo **notification** cho đúng người nhận.
- Phân quyền theo vai trò + phạm vi trường/cơ sở ở cả tầng UI, route và Row-Level-Security.
- AI hỗ trợ 3 tuyến: LLM cấu hình được (Gemini/OpenAI/Anthropic) → Devin async → rule-based fallback.

## 2. Vai trò và phạm vi dữ liệu

| Vai trò | Tài khoản demo | Phạm vi |
|---|---|---|
| Giáo viên chủ nhiệm (GVCN) | gvcn@demo.scn | Lớp mình chủ nhiệm; lịch dạy cá nhân các lớp được phân công |
| Giáo viên bộ môn (GVBM) | gvbm@demo.scn | Điểm các lớp mình dạy; lịch cá nhân; giáo án |
| Tổ trưởng chuyên môn | totruong@demo.scn | Giáo viên trong tổ, duyệt giáo án/đánh giá năng lực |
| Ban Giám Hiệu (BGH) | bgh@demo.scn | Toàn trường: phê duyệt, TKB, kỳ thi, radar cảnh báo, AI điều hành |
| Phó Hiệu trưởng cơ sở (PHT) | pht@demo.scn | Như BGH nhưng chỉ các lớp thuộc campus mình phụ trách |
| Kế toán | ketoan@demo.scn | Nhân sự, đánh giá cơ sở vật chất TT15 |
| Sở GD&ĐT | sogd@demo.scn | Tổng hợp nhiều trường, quản trị người dùng, toàn vẹn dữ liệu |
| Phòng GD&ĐT / UBND | phonggd@demo.scn, ubnd@demo.scn | Dashboard địa bàn (read-only) |
| Phụ huynh | phuhuynh@demo.scn | Con mình: thông báo, tin nhắn, lịch hẹn, đăng ký hoạt động |
| Học sinh | hocsinh@demo.scn | Bản thân: thời khóa biểu, điểm, hạnh kiểm, thông báo |

Mật khẩu demo chung: `demo1234`.

## 3. Danh mục chức năng theo module

### 3.1 Hồ sơ lớp học (GVCN)

| Chức năng | Mô tả |
|---|---|
| Tiếp nhận lớp | Nhận phân công chủ nhiệm đầu năm học, khai báo thông tin lớp |
| Upload danh sách HS | Import Excel/CSV danh sách học sinh (mã HS quốc gia, ngày sinh, giới tính, dân tộc, địa chỉ); tải template mẫu; báo lỗi từng dòng |
| Chi tiết hồ sơ HS | Xem/sửa hồ sơ từng em: định danh, gia đình, sức khỏe, hoàn cảnh |
| Lịch sử cập nhật | Audit trail mọi thay đổi hồ sơ |
| Báo cáo tổng hợp (AI) | AI phân tích hồ sơ lớp: cơ cấu, hoàn cảnh đặc biệt, đề xuất chú ý |

### 3.2 Chuyên cần (GVCN)

| Chức năng | Mô tả |
|---|---|
| Điểm danh hàng ngày | Danh sách lớp, 4 trạng thái/em (Có mặt/Vắng CP/Vắng KP/Đi muộn) + thao tác nhanh "Tất cả có mặt"; thẻ tổng 6 chỉ số (Sĩ số/Có mặt/Vắng/CP/KP/Muộn). **Chọn ngày bất kỳ** để xem lại hoặc sửa điểm danh ngày cũ |
| Báo cáo ngày cho BGH | Tổng hợp chuyên cần lớp theo ngày chọn, gửi BGH |
| Nghỉ học / đi muộn | Sổ vắng/muộn theo **khoảng ngày** (`from`-`to`): lý do, nguồn ghi (GVCN/sổ đầu bài/phụ huynh) |
| Thông báo phụ huynh | Gửi thông báo vắng/muộn cho PH các em liên quan (email + in-app) |
| Theo dõi tình trạng | Ma trận HS × ngày đến **mốc ngày chọn** (`to`), phát hiện em vắng liên tục |
| Lịch sử chuyên cần | Thống kê + biểu đồ theo **khoảng ngày**: tỷ lệ chuyên cần, phân bố trạng thái |

Quy tắc tính: tỷ lệ chuyên cần = `(có mặt + đi muộn) / sĩ số`. Đi muộn vẫn tính là có đi học.

### 3.3 Học tập

| Chức năng | Vai trò | Mô tả |
|---|---|---|
| Sổ điểm | GVCN, GVBM | **Gradebook cá nhân**: cột động Miệng/15 phút/1 tiết (hệ số 1), ĐĐGgk (hệ số 2), ĐĐGck (hệ số 3). Thêm/xóa cột đánh giá thường xuyên theo loại; ĐTBm tự tính theo **TT22/2021**: `(Tổng ĐGTX + 2×ĐĐGgk + 3×ĐĐGck) / (số ĐGTX + 5)`. Hiển thị riêng HK1, HK2, cả năm; môn đánh giá bằng nhận xét hiện Đạt/Chưa đạt. Import/export Excel, tải template |
| Phân tích kết quả | GVCN | Phân bố điểm, top/bottom, môn yếu của lớp |
| Học sinh cần hỗ trợ | GVCN | Danh sách em có điểm/kết quả dưới ngưỡng + gợi ý |
| Trao đổi GVCN ↔ GVBM | 2 chiều | Tin nhắn gắn học sinh cụ thể |
| Trao đổi phụ huynh | GVCN | Tin nhắn 1-1 với PH đã liên kết |
| Kế hoạch hỗ trợ & tiến bộ | GVCN | Lập kế hoạch kèm cho HS yếu, theo dõi tiến độ |
| Giáo án / Kế hoạch bài dạy | GVBM, GVCN | Soạn giáo án (AI hỗ trợ), nộp tổ trưởng duyệt |
| Quản lý kỳ thi | GVCN, BGH, GVBM (xem) | Tạo kỳ thi, buổi thi (lớp/môn/ngày/giờ/phòng/giám thị), import Excel, công bố/đánh dấu đã thi, **AI sinh câu hỏi** theo 4 mức nhận thức (Nhận biết - Thông hiểu - Vận dụng - Vận dụng cao) |

### 3.4 Rèn luyện (GVCN)

| Chức năng | Mô tả |
|---|---|
| Nhận xét & vi phạm/khen thưởng | Ghi nhận 3 loại: nhận xét, khen thưởng (+điểm), vi phạm (-điểm); cộng/trừ điểm rèn luyện từng em |
| Đánh giá & xếp loại | Xếp loại hạnh kiểm từng em theo học kỳ (Tốt/Khá/Đạt/Chưa đạt) |
| Trao đổi học sinh | Kênh chat riêng với HS |
| +/− điểm trong sổ đầu bài | Ngay trong form tiết học: nút +/− cạnh tên HS ghi `conduct_records` khen_thuong/vi_pham |

### 3.5 Tư vấn học sinh (GVCN)

Quy trình 3 bước: **Tiếp nhận** (tạo ca: loại vấn đề, mô tả) → **Đánh giá mức độ** (Thấp/Trung bình/Cao - AI gợi ý mức + hướng xử lý) → **Chuyển tuyến** (giới thiệu chuyên gia/đơn vị ngoài cho ca mức Cao). Trạng thái: mở → đang tư vấn → đã chuyển tuyến/đóng.

### 3.6 Phụ huynh

| Chức năng | Vai trò | Mô tả |
|---|---|---|
| Soạn & gửi thông báo | GVCN | Gửi cả lớp hoặc PH từng em; lưu in-app + **email** qua Resend |
| Hộp thư phản hồi | GVCN | Hộp thư tin nhắn PH gửi lại |
| Lịch hẹn trao đổi | GVCN, PH | PH đề xuất lịch (ngày giờ, hình thức, lý do) → GVCN xác nhận/từ chối → trạng thái proposed/confirmed |
| Cổng thông tin PH | GVCN xem | Xem lớp theo góc nhìn PH |
| Ban đại diện CMHS | GVCN, BGH | Thành lập ban: Trưởng ban/Phó ban/Ủy viên, đổi vai trò |

**Portal phụ huynh** (`/portal/parent`): xem thông báo lớp, tin nhắn GVCN (trả lời được), đặt lịch hẹn, đăng ký hoạt động giáo dục đã công bố, thông tin con (điểm, chuyên cần). Hai PH cùng con xem chung dữ liệu.

### 3.7 Hoạt động giáo dục

Kế hoạch (GVCN lập: tên, ngày, địa điểm, nội dung) → gửi BGH duyệt → công bố → PH đăng ký cho con → điểm danh & đánh giá sau hoạt động.

### 3.8 An toàn học sinh

| Chức năng | Mô tả |
|---|---|
| Ghi nhận sự cố | 6 loại (sức khỏe, tai nạn, bạo lực/xung đột, tài sản, an ninh, khác) × 4 mức; **AI viết lại mô tả** chuyên nghiệp + gợi ý xử lý |
| Theo dõi & nhắc | Cập nhật trạng thái xử lý + ghi chú từng sự cố |
| Báo cáo BGH | Chỉ BGH mới thấy nút; đánh dấu sự cố đã báo cáo |
| Lưu trữ & tra cứu | Kho sự cố đã xử lý, lọc theo loại/mức |

### 3.9 Sổ chủ nhiệm (GVCN, BGH duyệt)

| Chức năng | Mô tả |
|---|---|
| Danh sách HS & Tổ | Roster: tạo tổ, chia đều tổ tự động, gán Ban cán sự (4 chức danh), tạo + liên kết phụ huynh cho HS |
| Sơ đồ lớp | Lưới chỗ ngồi kéo-thả; **thêm/bớt hàng (2-10) và cột (2-12)**, giữ vị trí HS khi resize; lưu theo phiên bản |
| Lịch sử phiên bản sơ đồ | Xem/khôi phục các version đã lưu |
| Upload lịch năm học | Thêm sự kiện thủ công + import CSV |
| Gợi ý công việc (AI) | AI phân tích lịch năm học → đề xuất việc theo tuần/tháng, thêm thẳng vào kế hoạch |
| Kế hoạch tháng / sơ kết tuần | Checklist việc tháng + sơ kết tuần |
| Đăng ký chỉ tiêu (KPI) | Đăng ký chỉ tiêu hiệu suất lớp |
| Ký duyệt sổ | BGH ký xác nhận sổ chủ nhiệm từng lớp theo đợt |
| Duyệt & khóa sổ học bạ | Tạo đợt duyệt toàn trường → khóa sổ từng lớp |
| Xuất sổ | Export CSV toàn bộ dữ liệu sổ chủ nhiệm |
| Nhật ký thao tác | Audit log đầy đủ: actor/action/entity/payload |

### 3.10 Thời khóa biểu & Sổ đầu bài

| Chức năng | Mô tả |
|---|---|
| TKB theo lớp | Grid tuần Thứ 2-7 × 5 tiết: môn, GV, phòng. GVCN chỉ thấy lớp chủ nhiệm (đánh dấu CN); BGH thấy tất cả + **toolbar import Excel/template**; PHT scope campus |
| TKB cá nhân | Mọi giáo viên: gộp tiết `teacher_id` = mình, ô hiển thị `Lớp · Môn · Phòng`; tiết trùng slot stack đủ + viền cảnh báo |
| Sổ đầu bài | Theo ngày: mỗi tiết ghi **Tên bài học / Nội dung / Nhận xét GV** (3 trường riêng), sĩ số có mặt, đánh dấu vắng CP/KP/muộn từng em, +/− điểm rèn luyện. Lưu → **đồng bộ `attendance_records`** (source=period_log). Row collapsed hiện đủ: tiết, môn, sĩ số, chip vắng/muộn, preview nội dung. **AI tóm tắt tuần** |

### 3.11 Thi đua

| Chức năng | Mô tả |
|---|---|
| Thu thập & tính điểm | Grid tiêu chí × lớp, chấm theo max từng tiêu chí |
| Xếp hạng & khen thưởng | Bảng xếp hạng toàn trường, xử lý hạng bằng điểm, badge "Lớp mình" |

### 3.12 Năng lực giáo viên

Mọi GV: tự đánh giá theo tiêu chí + kế hoạch phát triển → nộp → tổ trưởng duyệt. Minh chứng đính kèm URL; đánh giá cuối năm.

### 3.13 Quản trị trường (BGH/PHT)

| Chức năng | Mô tả |
|---|---|
| Dashboard cấp trường | Chuyên cần/học tập/sự cố/cảnh báo toàn trường theo ngày gần nhất có data |
| Trung tâm phê duyệt | Hàng chờ: hoạt động giáo dục, đơn từ các bộ phận → duyệt/từ chối |
| Báo cáo ngày các lớp | Tổng hợp báo cáo GVCN đã gửi |
| Điều động dạy thay | Phân công GV dạy thay khi GV vắng |
| Radar cảnh báo sớm | Cảnh báo học sinh/lớp (học tập, chuyên cần, tâm lý, an toàn, bỏ học) - chấm điểm rủi ro, AI đề xuất can thiệp, tiếp nhận/đóng cảnh báo |
| Trợ lý điều hành (AI) | Chat hỏi-đáp trên số liệu thật: phê duyệt, sự cố, chuyên cần, cảnh báo |
| Cơ sở & đánh giá TT15 | Quản lý phân hiệu + đánh giá chất lượng theo TT15 (5 nhóm tiêu chuẩn, /100, mức 1-4) |
| Nhân sự trường | Danh sách GV + phân công |
| Phân công năm học | Gán GVCN cho lớp, GV dạy môn |

### 3.14 Cấp Sở/Phòng/UBND

| Chức năng | Mô tả |
|---|---|
| Dashboard Sở/Phòng/UBND | Tổng hợp các trường thuộc đơn vị: quy mô, chuyên cần, cảnh báo; **AI bản tin** (dept-brief) |
| Quản trị người dùng (Sở) | Danh sách tài khoản các trường |
| Quản trị dữ liệu (Sở) | Kiểm tra toàn vẹn: lớp thiếu GVCN, HS chưa có tổ/PH, liên kết mồ côi |

## 4. Luồng nghiệp vụ xuyên module

1. **Vắng trong tiết học**: Sổ đầu bài đánh dấu vắng → `attendance_records` cập nhật → dashboard/tracking/leaves thống kê → PH nhận thông báo.
2. **Hoạt động giáo dục**: GVCN lập kế hoạch → BGH duyệt → công bố → PH đăng ký → GVCN điểm danh & đánh giá.
3. **Giáo án**: GV soạn (AI hỗ trợ) → tổ trưởng duyệt/trả về kèm nhận xét (AI gợi ý nhận xét) → GV sửa nộp lại.
4. **Kỳ thi**: GVCN/BGH tạo kỳ thi + buổi thi (thủ công/Excel) → công bố → GV/PH/HS xem lịch → AI sinh câu hỏi theo ma trận nhận thức.
5. **Sự cố an toàn**: GVCN ghi nhận (AI viết lại) → xử lý + ghi chú → mức Cao báo BGH → lưu trữ tra cứu.
6. **Cảnh báo sớm**: hệ thống chấm điểm rủi ro từ chuyên cần/điểm/sự cố → BGH radar → AI đề xuất → tiếp nhận → đóng.

## 5. Trí tuệ nhân tạo (AI)

| Tính năng | Đầu vào | Đầu ra |
|---|---|---|
| Advisor (BGH) | Câu hỏi + context số liệu thật | Trả lời điều hành |
| Dept-brief (Sở/Phòng) | Số liệu các trường | Bản tin tổng hợp |
| Warning-advice | Cảnh báo + loại | Gợi ý can thiệp (bước/người/thời hạn) |
| Gen-questions | Môn, chủ đề, mức nhận thức | Câu hỏi + lời giải |
| Incident-report | Mô tả thô sự cố | Mô tả chuẩn + gợi ý xử lý |
| Counseling level | Mô tả ca | Mức độ + hướng xử lý |
| Suggest-tasks | Lịch năm học | Việc đề xuất theo tháng |
| Period-log summary | Sổ đầu bài tuần | Tóm tắt chuyên cần/nội dung dạy |
| Lesson-plan review | Nội dung giáo án | Nhận xét chuyên môn |
| Class analysis / comments / digest / draft-message | Dữ liệu lớp | Phân tích, nhận xét, bản tin, thư nháp |

**Cấu hình** (env, không hard-code): `AI_PROVIDER`, `AI_MODEL`, `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`. Fallback: LLM lỗi/quota → Devin async (kết quả về qua callback) → rule-based.

## 6. Báo cáo & xuất dữ liệu

- Xuất sổ chủ nhiệm: CSV đầy đủ (HS, chuyên cần, điểm, rèn luyện, sổ đầu bài, hoạt động).
- Import/Export Excel: danh sách HS, điểm (2 mẫu), TKB, buổi thi, lịch năm học - mỗi nơi có nút "Tải template".
- Báo cáo ngày lớp → BGH; bản tin Sở/Phòng; biểu đồ chuyên cần, phân tích điểm.

## 7. Bảo mật & kiểm soát

- Mọi route gọi `requireRoles` riêng (default-deny); server action/API kiểm tra role.
- RLS Postgres theo `school_id`/`campus_id`: PH chỉ thấy con mình, HS chỉ thấy bản thân, PHT chỉ thấy campus mình, GV chỉ ghi lớp được phân công.
- Audit log toàn bộ mutation quan trọng; `check-consistency.mjs` kiểm tra toàn vẹn dữ liệu + quy ước code trước mỗi release.
