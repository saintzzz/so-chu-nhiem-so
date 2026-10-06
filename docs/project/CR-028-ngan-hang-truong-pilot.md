# CR-028 - Ngân hàng câu hỏi cấp trường + quy trình duyệt + sửa câu hỏi (pilot-readiness)

## 1. Bối cảnh (phản hồi PO)

1. Bank câu hỏi hiện per-owner (RLS `owner_id = auth.uid()`): tổ trưởng không
   thấy câu hỏi GV đóng góp → không ai duyệt ngoài chính người tạo. Sai nghiệp
   vụ trường: bank phải là tài nguyên chung của trường, tổ trưởng/BGH duyệt.
2. UI bank chưa cho sửa câu hỏi (chỉ thêm/xoá/đổi trạng thái duyệt).
3. Pilot nhiều trường (100k → 1M user): per-owner nhân bản dữ liệu, thiếu index,
   RLS owner-only không phản ánh tổ chức trường.

Phân loại: **CR** (thay đổi mô hình dữ liệu + workflow duyệt).

## 2. Thiết kế

### 2.1. Mô hình

`tvc.questions` thêm `school_id` (FK `schools`, nullable = câu cá nhân cũ /
không thuộc trường). Backfill từ `profiles.school_id` của owner.

Phạm vi truy cập:
- Đọc: owner + giáo viên/nhân sự cùng trường (bank chung trường).
- Tạo: staff cùng trường; `school_id` lấy từ profile server-side.
- Sửa nội dung: owner + `to_truong/bgh/admin` cùng trường (tổ trưởng chỉnh
  lỗi chính tả/ngữ pháp trước khi duyệt).
- Duyệt (`review_state` → approved/flagged): `to_truong/bgh/admin` cùng trường
  mới duyệt câu của người khác; owner chỉ tự duyệt câu của mình (đánh dấu
  "sẵn sàng đưa lên tổ" vẫn là unreviewed→owner-ok như hiện nay, nhưng
  nghiệp vụ chuẩn là reviewer duyệt).
- Xoá: owner + admin/bgh cùng trường.

### 2.2. UI

- Bank list: thêm cột "Người tạo" (rút gọn) + filter "Của tôi / Cả trường".
- Mở rộng row: hiển thị đầy đủ stem + context + đáp án + lời giải (đã có) +
  nút **Sửa** (mở form preload: stem, context, đáp án, lời giải, môn/lớp,
  YCCĐ, mức, điểm) và nút duyệt theo quyền.
- Người không phải owner & không phải reviewer: không có nút Sửa/Xoá; nút
  duyệt chỉ owner-tự-duyệt hoặc reviewer.
- DC-03 rút câu theo **bank trường** (không còn giới hạn câu của mình).

### 2.3. Scale

- Index: `(school_id)`, `(owner_id)`, GIN `standard_ids`, `(review_state)`,
  `(subject_code, grade, qtype, level)` composite cho rút câu theo ma trận.
- Pagination cursor-based đã có (`listQuestionsChunk` offset - giữ).
- Ghi chú backlog 1M: partition questions theo school_id hash nếu >10M rows;
  export DOCX chuyển hàng đợi; ai_jobs poll theo exponential backoff.

## 3. Verify

- RLS test JWT: gvcn thấy câu của totruong cùng trường và ngược lại; trường
  khác không thấy; gvcn không duyệt được câu của người khác (update tự động
  bị RLS chặn nếu policy siết) / totruong duyệt được.
- UI: gvcn thấy bank trường, sửa câu của mình, thấy nhưng không sửa được câu
  người khác; totruong duyệt/sửa câu GV.
- DC-03 rút được câu của bank trường (không chỉ của mình).
- typecheck/lint/build/check-consistency.
