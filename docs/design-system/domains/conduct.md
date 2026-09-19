# IV. Rèn luyện (`/conduct/*`)

**Vai trò**: GVCN, BGH.
**Routes**: `/conduct/records` `/evaluation` `/student-chat`

## Đánh giá & xếp loại (`/conduct/evaluation`)

- 4 `StatCard` đầu trang: Sĩ số · Đã đánh giá · Xếp loại Tốt · Chưa đạt.
- `ConductEvaluationEditor`: bảng [Mã định danh, Họ tên, Xếp loại (select), Nhận xét + nút AI ⚡ per-row]. Toolbar: template/import/AI gợi ý nhận xét/Lưu.
- Xếp loại: `tot`=Tốt (success) · `kha`=Khá (primary) · `dat`=Đạt (warning) · `chua_dat`=Chưa đạt (error).
- Template theo mẫu rèn luyện CSDL ngành: `STT | Mã định danh | Họ tên | Ngày sinh | Kết quả rèn luyện | Nhận xét`.

## NLPC tiểu học (`NlpcEditor`)

Chỉ hiển thị khi `schools.level ∈ {th, lien_cap}` — render dưới bảng hạnh kiểm cùng trang.

- Mỗi HS 1 dòng: **15 cột mức T/H/C** (3 NL chung · 7 NL đặc thù · 5 phẩm chất) + 3 ô nhận xét nhóm.
- Cột nhỏ (`w-12` select, `w-40` input nhận xét), font `text-xs` do mật độ cao.
- Lưu: `competency_evaluations` (mức) + `nlpc_comments` (grp: nlc/nldt/pc).

## Nhận xét & vi phạm (`/conduct/records`)

- Bảng ghi nhận: type badge `vi_pham`=error · `khen_thuong`=success · `nhan_xet`=primary; cột điểm `+`/`-` màu tương ứng.

## AI nhận xét

- Nút `AI gợi ý nhận xét` (Sparkles icon) — chỉ điền ô trống.
- Fallback Devin: banner inline "LLM hết hạn mức - Devin đang xử lý (mở session)", tự điền khi job done.
