# CR-027 - Duyệt câu hỏi hàng loạt + đề giữa kì lớp 4-5 + fix double-default KHBD

## 1. Bối cảnh

- CR-026 sau review cho thấy **2 biểu mẫu "Mặc định" cùng lúc** (hệ thống + trường)
  vì thiếu unique constraint theo scope và hành vi "đặt mặc định" chưa bỏ mặc định
  mẫu khác cùng trường.
- Bank câu hỏi sau CR-025 có ~120 câu AI `unreviewed` - UI chỉ duyệt từng câu,
  không khả thi cho đợt duyệt lớn.
- TT 22/2021: lớp 4-5 có kiểm tra **giữa kì** ngoài cuối kì - DC-02/DC-03 chưa
  phân biệt đợt kiểm tra, tiêu đề đề chỉ "KIỂM TRA ĐỊNH KÌ".
- Backlog: DC-03 chưa có lựa chọn "chỉ rút câu đã duyệt" (hard-gate mềm).

Phân loại: **CR** (thay đổi yêu cầu nghiệp vụ đề + workflow duyệt).

## 2. Phạm vi

- Migration `khbd_tpl_default_scope`: unique partial index trên
  `coalesce(school_id, NULL-uuid)` khi `is_default` - mỗi scope (hệ thống /
  từng trường) chỉ 1 mặc định. `saveKhbdTemplate` bỏ mặc định các mẫu trường
  khác khi đặt mặc định. Badge UI phân biệt "Hệ thống/Của trường" +
  "Mặc định hệ thống/Mặc định trường".
- Ngân hàng câu hỏi: cột checkbox + "chọn hết trang" + thanh bulk action
  (Đã duyệt / Đánh dấu lỗi / Về chưa duyệt), action `bulkSetQuestionReviewState`
  (max 200/lần, audit `question.bulk_*`). Đã dùng để duyệt 121 câu AI trong bank
  demo (190→211 approved).
- DC-02: field `term` (Giữa/Cuối HK I/II, Thường xuyên) → tiêu đề ma trận
  "MA TRẬN ĐỀ KIỂM TRA GIỮA HỌC KÌ I - ..."; note TT22 khi giữa kì cho lớp 1-3
  (TT22 không bắt buộc KT giấy giữa kì lớp nhỏ - nhắc kiểm tra văn bản Sở).
- DC-03: field `approved_only` - khi "Chỉ câu đã duyệt", `usable()` lọc
  `review_state='approved'`; ô thiếu vẫn báo trung thực. Tiêu đề đề lấy đợt
  kiểm tra từ tiêu đề ma trận (strip prefix đúng).

## 3. Verify

- DB: sau bulk duyệt bank demo 211/211 approved; audit `question.bulk_approved`.
- Playwright gvcn: filter "Chưa duyệt" → chọn 100 → duyệt (DB 190), trang 2
  21 câu → duyệt (DB 211). DC-02 Toán 4 + GK1 → ma trận "KIỂM TRA ... GIỮA HỌC
  KÌ I" khung TT22, lưu được. DC-03 pack full + approved_only → đề
  "KIỂM TRA ĐỊNH KÌ - GIỮA HỌC KÌ I - TOÁN LỚP 4", 3 ô THIẾU báo trung thực
  (Toán 4 thiếu combo dạng-mức cụ thể), phụ lục không còn câu chưa duyệt.
- typecheck/lint/build/check-consistency xanh.

## 4. Backlog còn lại (đánh dấu xử lý sau)

- Nhập liệu/duyệt tiếp để bank lớp 1-3 và các combo Đ/S+TL lớp 4 đủ phủ.
- CR-20: gom câu đọc hiểu Văn rời thành cụm ngữ liệu; dedupe stem trùng.
- DC-06 slide .pptx (P1); kiểm duyệt 4 lớp; DPIA Luật 91/2025.
