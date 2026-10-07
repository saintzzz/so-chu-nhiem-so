# CR-035: Cấu trúc hóa Kế hoạch bài dạy (KHBD)

## Phát hiện (owner report)

"Nội dung Kế hoạch bài dạy rất tệ về cả bố cục" - khi xem/nhập giáo án.

## Phân tích hiện trạng

- `lesson_plans.content` là 1 text blob; form là 1 textarea duy nhất.
- AI "gợi ý dàn ý" sinh bullet list phẳng, không theo biểu mẫu.
- Xem chi tiết = `whitespace-pre-wrap` trong ô bảng - không phân section.
- KHBD theo CV 5512/CTGDPT 2018 đòi cấu trúc: Mục tiêu (KT/NL/PC),
  Thiết bị dạy học (GV/HS), Tiến trình 4 hoạt động (Khởi động, Khám phá,
  Luyện tập, Vận dụng) mỗi hoạt động gồm Mục tiêu / Tổ chức thực hiện
  (GV-HS) / Sản phẩm / Đánh giá.

## Scope

1. `lesson_plans` thêm `content_json jsonb` - lưu KHBD có cấu trúc;
   `content` giữ làm plain-text mirror (backward compat, AI review, search).
2. `src/lib/khbd.ts` - schema section + serialize/parse + render text
   (pure, unit-testable).
3. `lesson-plan-board.tsx`: form nhập structured theo section; chi tiết
   render theo section (không còn blob); fallback pre-wrap cho plan cũ.
4. `/api/ai/lesson-plan` mode outline: trả JSON structured khớp schema,
   điền thẳng các section.
5. Shared cho 3 mode teacher/team/bgh (cùng component).

## Impact

- DB: 1 column nullable, không migration data (plan cũ đọc `content`).
- Không đổi quy trình duyệt (submitted -> team_approved -> approved).
- Giáo án cũ hiển thị fallback như cũ.

## Tests

- Behavioral: khbd.ts serialize->parse roundtrip, render text đủ section.
- Static: board có đủ section labels, AI route trả structured schema.
