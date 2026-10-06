# CR-024 - Nâng chuẩn nội dung tiểu học: YCCĐ chính thức, ngân hàng câu hỏi, đề thi theo TT 22/2021

## 1. Bối cảnh và yêu cầu

User yêu cầu đối chiếu module studio (CR-023) với bộ tài liệu `presale_đề án` và nâng chất
lượng nội dung theo chuẩn BGD&ĐT thật:

1. Đáp ứng yêu cầu trong folder `presale_đề án` chưa.
2. YCCĐ nghiên cứu sâu từ nguồn chính thức -> tạo ngân hàng câu hỏi khớp theo.
3. Template đề và cấu trúc đề thi nghiên cứu lại theo đề mẫu tiểu học thật.
4. Phase "chuyên gia rà soát" để sau development -> đưa vào backlog, chưa xử lý.

Phân loại: **CR** (thay đổi yêu cầu nội dung + quy chuẩn sinh đề). Phạm vi: cấp tiểu học
(lớp 1-5), 3 môn Toán / Tiếng Việt / Tiếng Anh.

## 2. Gap-check với presale_đề án (đánh giá trước CR-024)

Bộ tài liệu presale gồm: đề án tổng thể (40 trang), chuyên đề Toán 12 mẫu, mẫu đáp án +
hướng dẫn chấm, mẫu bảng điểm, ảnh quy ước mã câu hỏi FPT (D/F/S/E), CV 7991
(BGD hướng dẫn KTĐGĐK - phạm vi THCS/THPT).

| Yêu cầu đề án | Trạng thái CR-023 | Sau CR-024 |
|---|---|---|
| 12 công cụ P0 (DC-01..05, T-01/02, V-01/02, A-01..03) | Đạt | Đạt |
| Mã câu `<YCCĐ>-<D|F|S|E><seq>` | Đạt (đúng quy ước ảnh FPT) | Đạt |
| Đề + đáp án + HDC | Đạt (thêm đề dự phòng + BBPB) | Đạt |
| Ma trận + bản đặc tả có năng lực | Đạt | Đạt |
| YCCĐ bám chương trình GDPT 2018 | **Chưa đạt** - seed paraphrase AI, thiếu nhiều mảng | Đạt mức tham khảo (80 mã bám văn bản CT, chờ chuyên gia) |
| Đề thi đúng cấu trúc theo cấp học | **Chưa đạt** - áp dáng CV 7991 (B-H-VD) cho cả tiểu học | Đạt - TH dùng TT 22/2021 (4 mức), THCS+ giữ CV 7991 |
| Ngân hàng câu hỏi đủ dùng cho DC-03 | **Chưa đạt** - bank rỗng, đề toàn placeholder | Đạt mức starter (90 câu mẫu gốc, khớp YCCĐ, đủ sinh đề Toán 3 trọn gói) |
| Chế độ "Cùng soạn", QTI/LTI, kiểm duyệt 4 lớp, DPIA | Chưa (ngoài scope) | Backlog |

## 3. Deep research - nguồn chính thức đã dùng

- **TT 32/2018/TT-BGDĐT** - CTGDPT 2018, văn bản chương trình môn:
  - Toán: 3 mạch "Số và phép tính" / "Hình học và Đo lường" / "Một số yếu tố Thống kê
    và Xác suất" + "Hoạt động thực hành và trải nghiệm"; bảng YCCĐ theo lớp.
    Nguồn: CT môn Toán (PDF BGD, mirror dienbien.edu.vn / navi.edu.vn cho bảng lớp 4).
  - Tiếng Việt (Ngữ văn, phần cấp TH): 4 phân môn Đọc / Viết / Nói và nghe /
    Kiến thức tiếng Việt; YCCĐ lớp 3-5 trích nguyên văn (kỹ thuật đọc, đọc hiểu nội
    dung - hình thức, viết đoạn văn - văn bản, KTTV danh từ-động từ-tính từ, dấu câu,
    từ đồng nghĩa - đa nghĩa...).
  - Ngoại ngữ 1 / Tiếng Anh: chương trình theo chủ điểm, 4 kỹ năng, ưu tiên nghe - nói
    ở TH; ra trường đạt Bậc 1 khung 6 bậc (TT 01/2014). Tham chiếu CV 3818/BGDĐT-GDTH
    (31/7/2023) về tổ chức dạy Ngoại ngữ 1 lớp 3-5.
- **TT 22/2021/TT-BGDĐT** - Đánh giá HS tiểu học, **Điều 10**: đề định kì theo **4 mức**
  (Nhận biết / Hiểu / Vận dụng vào vấn đề quen thuộc / Vận dụng linh hoạt vào vấn đề
  mới); điểm thang 10, **không cho điểm 0, không cho điểm thập phân** ở điểm tổng;
  chỉ lớp 4-5 thêm kiểm tra giữa kì.
- **CV 7991/BGDĐT-GDTrH (17/12/2024)**: áp cho THCS/THPT - KHÔNG áp máy móc cho TH
  (sửa từ CR-023).
- Đề mẫu tiểu học thực tế (dethi.violet, dethimau, trường TH): cấu trúc quốc trường
  "TRƯỜNG TH ... / KIỂM TRA ĐỊNH KÌ ... MÔN: ... - LỚP ...", ô họ tên/lớp/phách/điểm,
  PHẦN I TRẮC NGHIỆM (khoanh A-D, Đ/S, điền/trả lời ngắn) + PHẦN II TỰ LUẬN, nhãn
  MĐ1-MĐ4, đáp án + hướng dẫn chấm kèm tổng 10đ.

## 4. Thay đổi đã thực hiện

### 4.1 YCCĐ tiểu học theo văn bản chương trình (`scripts/seed-tvc-th-content.mjs`)

- Xoá 64 mã AI-paraphrase cũ; ghi lại **80 mã** bám văn bản CTGDPT 2018:
  - Toán 1-5: 34 mã (mạch Số-phép tính / HH-ĐL / TKXS / TH-TN), văn phong "Đọc, viết,
    so sánh được...", "Thực hiện được...", "Giải được bài toán có đến n bước...".
  - Tiếng Việt 1-5: 20 mã (Đọc [kỹ thuật + đọc hiểu + ngữ liệu], Viết, Nói-nghe, KTTV)
    kèm ngưỡng tốc độ đọc chuẩn (lớp 3: 70-80 tiếng/phút, lớp 5: 90-100).
  - Tiếng Anh 3-5: 15 mã (4 kỹ năng + "Kiến thức ngôn ngữ" từ vựng/cấu trúc theo chủ điểm).
- Competencies gắn đúng tên năng lực chương trình (Tư duy và lập luận toán học, Mô hình
  hoá toán học, Năng lực ngôn ngữ / văn học, Năng lực giao tiếp tiếng Anh).
- Script idempotent: update-in-place theo code (giữ UUID -> ma trận/câu hỏi đã lưu
  không mồ côi khi re-seed), xoá mã đã bỏ, chèn mã mới. YCCĐ trường (`school_id`)
  không bị động.

### 4.2 Ngân hàng câu hỏi mẫu (90 câu, owner gvcn@demo.scn, source=imported, review=approved)

- Toán 3: đủ phủ một ma trận TH trọn gói (đề CT + đề dự phòng) - MC/Đ-S/TLN/TL ở đủ
  mức 1-4. Toán 1,2,4,5: 4-10 câu/mức chủ chốt.
- Tiếng Việt: câu đọc hiểu **kèm `context` là đoạn văn tự viết** (không sao chép SGK -
  tuân thủ bản quyền NĐ 17/2023), KTTV Đ/S 4 ý, câu viết đoạn văn có gợi ý chấm.
- Tiếng Anh: MC vocab/ngữ pháp, Đ/S 4 ý, đọc hiểu có passage trong `context`, TLN điền
  từ, essay viết email - hướng "chủ điểm + mẫu câu" đúng CT Ngoại ngữ 1.
- Mọi câu có `standard_ids` khớp mã YCCĐ, `level` theo 4 mức TH (biet/hieu/van_dung/
  van_dung_cao), đáp án + lời giải/hướng chấm.
- Migration: `questions_level_check` mở rộng thêm `van_dung_cao` (trước chỉ 3 mức -
  vốn sẽ fail khi seed M4).

### 4.3 Template đề tiểu học theo TT 22/2021 (`generate/route.ts`, `fallbacks.ts`)

- **DC-02 fbMatrix**: tự nhận khung theo khối:
  - Lớp <= 5: `tt22` - trọng số TN 5.5đ / TL 4.5đ (MC 3, Đ/S 1.5, TLN 1, TL 4.5),
    vòng mức M1-M4 (M4 = vận dụng linh hoạt là chuẩn chính thức, không phải opt-in),
    meta ghi "TT 22/2021 Điều 10 - 4 mức", nhãn "Mức 1 (Nhận biết)" ... "Mức 4".
    Ô "Vận dụng cao" của form chỉ còn nghĩa với THCS/THPT.
  - Lớp >= 6: giữ `cv7991` 3 mức 3-2-2-3 (VDC opt-in như CR-023).
  - Bù làm tròn cell cuối để tổng điểm luôn = `total_points` (trước đó 9.75/10).
- **DC-03 buildExamDoc**: với đề lớp <= 5 -
  - Tiêu đề "KIỂM TRA ĐỊNH KÌ - <MÔN> LỚP X" (bỏ tiền tố "MA TRẬN").
  - Gộp PHẦN I. TRẮC NGHIỆM (MC + Đ/S + TLN, đánh số Câu 1..n liên tục) +
    PHẦN II. TỰ LUẬN - đúng mẫu đề định kì TH.
  - Meta có ô "Họ và tên học sinh / Lớp / Mã phách" + ghi chú chấm TT22
    (thang 10, không điểm 0/thập phân ở điểm tổng).
  - HDC ghi chú Đ/S trỏ đúng "phần I" thay vì "phần II" cố định.
  - Biên bản phản biện trích TT 22/2021 cho đề TH (trước luôn trích CV 7991).
- `question-validate`/`usable()` giữ nguyên (đã có gate context từ CR-19 tại TVC360;
  SCN port kế thừa).

## 5. Kết quả verify

- `npm run typecheck`: pass. `check-consistency.mjs`: ALL PASS.
- Seed: `80 YCCĐ + 90 câu` cho gvcn@demo.scn (idempotent - chạy lại update in place).
- Playwright (gvcn, dev :3113):
  - DC-02 Toán lớp 3: form cascade YCCĐ mới -> ma trận hiển thị "Khung: TT 22/2021
    Điều 10 - 4 mức", cột mức "Mức 1 (Nhận biết)"..., TỔNG = 10đ (fix rounding).
  - DC-03 pack full: đề CT "KIỂM TRA ĐỊNH KÌ - TOÁN LỚP 3", PHẦN I TRẮC NGHIỆM 10 câu
    liên tục + PHẦN II TỰ LUẬN, 0 câu `[THIẾU]`; tab Đề dự phòng + BBPB đủ; đáp án -
    HDC khớp mã câu.
- DB verify: `tvc.curriculum_standards` 80 mã `school_id IS NULL` grade<=5;
  `tvc.questions` 90 câu `source=imported`, `review_state=approved`, level phân bố đủ
  4 mức (có `van_dung_cao`).

## 6. Backlog - phase chuyên gia rà soát (sau development, KHÔNG làm trong CR này)

| # | Hạng mục | Nội dung | Ghi chú |
|---|---|---|---|
| B1 | Rà soát YCCĐ TH | Chuyên gia CTGDPT duyệt 80 mã: văn phong, phạm vi, thứ tự chủ đề theo 3 bộ SGK | Khi duyệt xong set `version`/`status` phù hợp |
| B2 | Rà soát ngân hàng câu hỏi | Tổ bộ môn duyệt 90 câu mẫu + mở rộng coverage các mã ít câu | Seed hiện `approved` chỉ để demo; sản xuất cần quy trình duyệt thật |
| B3 | Kiểm chứng ma trận TH | Rà tỉ trọng TN/TL theo địa phương (có nơi TN 4đ/TL 6đ) | Cân nhắc cấu hình `pack` theo trường |
| B4 | Định kì giữa kì lớp 4-5 | Thêm template kiểm tra giữa kì (TT22 Đ.10 chỉ quy định cho lớp 4-5) | UI chọn kì |
| B5 | Đề Tiếng Việt đầy đủ | Cụm đọc hiểu + chính tả nghe-viết + tập làm văn đúng phiếu TH | Cần cơ chế "đề nhiều phần theo phân môn" |
| B6 | Audio nghe cho Tiếng Anh | Câu nghe hiện chỉ là transcript - cần TTS/file audio kèm | Phụ thuộc hạ tầng media |
| B7 | "Cùng soạn" wizard, QTI/LTI, DPIA Luật 91/2025, kiểm duyệt 4 lớp | Theo đề án presale | CR riêng |

## 7. Rủi ro còn lại

- YCCĐ lớp 1-2 và một số mã diễn giải theo tinh thần CT (văn bản gốc phân bố theo
  chủ đề chứ không liệt kê từng bullet rời) - cần B1 xác nhận.
- Ngân hàng là dữ liệu mẫu demo; triển khai thật cần nhập liệu của trường + B2.
- Câu nghe Tiếng Anh chưa có audio (transcript dạng chữ) - ghi rõ trong đề.
