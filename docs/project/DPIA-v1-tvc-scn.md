# DPIA v1 - Đánh giá tác động dữ liệu cá nhân (Luật 91/2025/QH15 về BVĐLCN)

Phạm vi: module SCN + TVC360 (công cụ giáo viên). Ngày: 2026-10-06.
Trạng thái: bản nháp nội bộ - cần pháp chế/chuyên gia rà soát trước pilot.

## 1. Dữ liệu cá nhân được xử lý

| Nhóm | Chủ thể | Loại dữ liệu | Nhạy cảm? |
|---|---|---|---|
| Hồ sơ | GV, HS, PH | họ tên, email, vai trò, trường | Không |
| Học tập | HS | điểm, hạnh kiểm, điểm danh, nhận xét | Có (trẻ em) |
| Sức khỏe/an toàn | HS | sự cố an toàn, tư vấn tâm lý | **Rất nhạy cảm** |
| Liên lạc | PH | email, nội dung trao đổi | Không |
| AI | GV | prompt, file đính kèm khi extract đề | Không |

## 2. Rủi ro chính

1. **Dữ liệu trẻ em** (HS <18): Điều 20-22 Luật 91 - cần sự đồng ý của PH;
   nguyên tắc lợi ích tốt nhất của trẻ.
2. **AI xử lý dữ liệu**: prompt gửi LLM bên thứ 3 (Gemini/OpenAI) - KHÔNG
   đưa PII học sinh vào prompt. Hiện prompt studio chỉ chứa YCCĐ/môn/lớp.
3. **Rò rỉ cross-tenant**: trường A đọc trường B - RLS school_id + my_role().
4. **Tải ảnh đề thi/bài làm**: có thể chứa PII HS - cần cảnh báo + hạn chế lưu.

## 3. Biện pháp hiện có

- RLS per-school trên mọi bảng tvc (CR-028/029), views security_invoker.
- Tách biệt vai trò: GV chỉ đọc bank trường; chỉ tổ trưởng/BGH duyệt.
- Audit log cho create/update/duyệt/xoá.
- AI prompt không chứa PII HS (chỉ YCCĐ).
- JWT verify local (getClaims) - không gọi ra ngoài mỗi request.

## 4. Còn thiếu (đưa vào roadmap pilot)

- [ ] Điều khoản đồng ý PH (consent) cho dữ liệu HS + bản ghi consent.
- [ ] Chính sách retention: xoá/ẩn danh hóa dữ liệu HS khi hết niên học.
- [ ] Data Processing Agreement với nhà cung cấp AI (Gemini/OpenAI) -
      chuyển dữ liệu ra nước ngoài cần đánh giá theo NĐ 356/2025.
- [ ] Báo cáo sự cố rò rỉ dữ liệu (72h theo quy định).
- [ ] Quyền truy cập/xoá dữ liệu của chủ thể (PH/HS yêu cầu xem, sửa, xoá).
- [ ] Mã hoá at-rest xác nhận với Supabase (mặc định có); at-transit TLS.
