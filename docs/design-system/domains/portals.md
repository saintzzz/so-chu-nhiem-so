# Cổng Phụ huynh / Học sinh

**Vai trò**: `phu_huynh`, `hoc_sinh` — layout riêng, **mobile-first** (khác staff desktop-first).

## Nguyên tắc chung

- Chỉ đọc + phản hồi — không có form nhập liệu phức tạp.
- Card-based, ít bảng; font lớn hơn staff UI (`text-base`), touch target ≥44px.
- Chỉ xem con/mình — RLS scope `my_student_ids()`.
- Copy đơn giản, không thuật ngữ ngành (dùng "Điểm trung bình" thay "ĐTBm").

## Cổng phụ huynh

- Điểm con: bảng điểm rút gọn — môn, ĐTB, xếp loại chữ (Tốt/Khá/Đạt); tiểu học hiển thị mức T/H/C.
- Chuyên cần: tổng hợp % + danh sách vắng/muộn gần nhất.
- Hạnh kiểm + nhận xét GVCN: card dễ đọc.
- Thông báo: feed từ GVCN/BGH; nút xác nhận đã đọc.
- Hẹn gặp: đề xuất/xác nhận lịch hẹn với GVCN.

## Cổng học sinh

- Điểm số + hạnh kiểm của bản thân (read-only).
- Thời khóa biểu tuần — lưới rút gọn.
- Hoạt động GD: đăng ký tham gia.
- Điểm tích cực hiển thị khuyến khích (`+n` xanh).

## Accessibility
Cổng PH/HS ưu tiên WCAG AA trên mobile — contrast, font size, đơn giản hóa điều hướng (bottom nav nếu cần).
