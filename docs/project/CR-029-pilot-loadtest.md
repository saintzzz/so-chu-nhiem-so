# CR-029 - Pilot readiness: data test 3 trường + load/security test + kiểm duyệt trường + DC-06 + DPIA

## 1. Bối cảnh

Yêu cầu PO: tạo data test thật cho 3 trường (mỗi trường 100 GV), chạy load
test + security test, xử lý backlog đã ghi (DC-06, kiểm duyệt đa lớp, DPIA,
dedupe, coverage).

## 2. Đã làm

### 2.1. Test data (scripts/seed-test-schools.mjs, idempotent)
- Trường mới: Tiểu học Kim Đồng (thêm vào 2 trường sẵn có).
- 300 user auth: `gv001-gv100@{nd,cva,kd}.test`, pass demo1234; role phân bố
  2 to_truong + 1 bgh + 97 gvcn/gvbm mỗi trường; public.profiles +
  tvc.profiles đầy đủ.
- Bank trường: 1356 câu/trường (clone 226 câu mẫu × 6 biến thể, gán đều cho
  GV, 25% để unreviewed mô phỏng thực tế chờ duyệt).

### 2.2. Security test (scripts/sectest-tvc.mjs) - 9/9 PASS
- GV trường ND đọc bank ND (1582), KHÔNG thấy bank trường CVA.
- GV thường không sửa/xoá câu đồng nghiệp.
- Insert school_id trường khác bị RLS chặn.
- Tổ trưởng duyệt được câu đồng nghiệp; phụ huynh/anon 0 dòng.

**Bug bảo mật + hiệu năng bắt được nhờ sec test:**
- `phu_huynh` có profiles.school_id → trước đó đọc được bank trường → fix:
  policy đọc giờ yêu cầu `my_role() in (staff)`.
- Policy subquery `(select role from profiles ...)` kích hoạt RLS chain của
  bảng profiles (scn_profile_visible seq-scan khổng lồ) → UPDATE timeout 8s.
  Fix: dùng `my_role()`/`my_school_id()` security definer trong mọi policy
  tvc.questions + tvc.khbd_templates.
- reviews.status check thiếu 'submitted'; reviews.layer là int (0=gửi,
  1=tổ trưởng, 2=BGH); materials.type/status check mở rộng 'slides' /
  'totruong_ok'.

### 2.3. Load test (scripts/loadtest-tvc.mjs) - baseline micro instance
- pick theo YCCĐ+qtype+level (GIN): p50 ~0.5s @ conc 50 - đạt.
- list 100 câu: p50 0.34s conc1 → 2.7s conc50; count exact ~2.5s conc20.
- Kết luận: đủ cho pilot vài trường; cho 100k user cần: instance lớn hơn +
  Supavisor pooling + bỏ count exact (đổi estimated) + index
  (school_id, created_at desc) đã thêm.

### 2.4. Kiểm duyệt học liệu đa lớp (trong trường)
- materials + school_id; staff cùng trường đọc học liệu trường.
- RPC secdef `scn_submit_material_review` (tác giả) +
  `scn_review_material` (to_truong → in_review→totruong_ok; bgh/admin →
  totruong_ok→published / reject). Log tvc.reviews theo layer.
- UI: nút "Gửi duyệt"/"Tổ duyệt"/"BGH duyệt - xuất bản"/"Trả về" + lịch sử
  kiểm duyệt; library hiện mục "Chờ duyệt của trường" cho reviewer.
- E2E verify bằng JWT thật: gv010 gửi → gv001 tổ duyệt → gv003 BGH →
  published; gvbm thường bị từ chối đúng.

### 2.5. DC-06 Bài trình chiếu (.pptx)
- Registry DC-06 (môn/khối/YCCĐ/tên bài/số slide), prompt chuyên slide.
- Fallback fbSlides theo tiến trình KHBD; AI sinh nội dung thật đã verify.
- `docToPptx` (pptxgenjs): slide bìa + mỗi section = 1 slide, bullet, Arial.
- Export `fmt=pptx` + nút "Xuất PPTX" cho material type slides.
  Verify: 116KB file pptx thật tải về được.

### 2.6. Dedupe ngân hàng
- 176 nhóm stem trùng (1168 dòng) trong bank legacy TVC360 → flag bản thừa
  (giữ bản sớm nhất mỗi nhóm). Bank trường sạch.

### 2.7. DPIA v1 (docs/project/DPIA-v1-tvc-scn.md)
- Ma trận dữ liệu cá nhân, rủi ro, biện pháp, checklist còn thiếu trước pilot
  (consent PH cho dữ liệu HS, DPA với AI provider, retention, quyền chủ thể).

## 3. Còn lại (backlog mới)
- Coverage câu hỏi lớp 1-3 & các ô ma trận thiếu - chạy tiếp harness CR-025.
- Kiểm duyệt cấp Sở (layer 3) khi triển khai liên trường/sở.
- DOCX export queue + ai_jobs backoff khi scale >1 trường/thời điểm.
- Partition questions khi >10M rows.
