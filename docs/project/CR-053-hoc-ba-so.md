# CR-053: Học bạ số (staff-facing official record)

**Ngày tạo:** 23/10/2026 - **Trạng thái:** PO đã duyệt scope (§6); BA rev 3 pass 3 vòng lead review.

## 1. Hiện trạng (đã có)

| Thành phần | Vị trí | Ghi chú |
|---|---|---|
| Học bạ HS tự xem | `portal/student/hoc-ba` | TT22: ĐTBm HK1/HK2/CN + chi tiết ĐĐG; môn nhận xét Đạt/Chưa đạt; hạnh kiểm; tổng chuyên cần |
| Hạnh kiểm từng kỳ | `conduct_evaluations` + `conduct/evaluation` | rating + comment theo term |
| Năng lực phẩm chất | `competency_evaluations` + `nlpc_comments` (RPC `scn_save_nlpc` atomic) | TT22 NLPC |
| Ký duyệt/khóa sổ | `register/signoff`, `register/lock-records` | GVCN submit → BGH sign |
| Hồ sơ HS | `records/students` | intake/upload |
| Tính ĐTBm TT22 | `src/lib/tt22.ts` | `semesterAssessment`, `yearAverage`, `requiredTxCount` |

## 2. Khoảng trống (chưa có) - để thành học bạ số chuẩn theo TT22/2021

| # | Thiếu | Chi tiết |
|---|---|---|
| 1 | **Học bạ tổng hợp phía staff** | 1 màn hình/tài liệu gom đủ theo em HS: thông tin định danh + bảng điểm HK1/HK2/CN từng môn + hạnh kiểm + NLPC + nhận xét GVCN + tổng chuyên cần - hiện các mảnh này rải ở nhiều route |
| 2 | **Xếp loại kết quả học tập cả năm** | TT22 Đ.9 (đã hiệu chỉnh sau BA review r1): Tốt = tất cả ĐTBmcn ≥6.5 + ≥6 môn ≥8.0; Khá = tất cả ≥5.0 + ≥6 môn ≥6.5; Đạt = ≥6 môn ≥5.0, không môn <3.5, nhận xét tối đa 1 Chưa đạt; + bump rule Đ.9.3 |
| 3 | **Xếp loại kết quả rèn luyện cả năm** | Tổng hợp từ HK1 + HK2 conduct → rating cả năm |
| 4 | **Xét lên lớp** | Từ KQHT + KQRL cả năm → lên lớp/thi lại/ở lại (TT22 Đ.10-14); cần UI + lưu quyết định |
| 5 | **In / xuất học bạ** | Layout in chuẩn (PDF/print CSS hoặc DOCX export như studio) cho GVCN/BGH |
| 6 | **Danh hiệu/khen thưởng** | TT22 Đ.15: Xuất sắc/Giỏi tính tự động + Giấy khen BGH nhập tay (đã hiệu chỉnh sau BA review - "tiên tiến" là danh hiệu TT58 cũ) |

## 3. Phạm vi đề xuất

**Route mới:** `/(app)/records/hoc-ba` (staff) - chọn lớp → bảng tổng hợp per-HS hoặc drill-down per-HS với layout học bạ.

- **Roles:** `gvcn` (lớp mình), `bgh`/`pht` (toàn trường read), `so_gd`/`ubnd` (read). Deny: `gvbm`, `to_truong` (nếu không kiêm gvcn), `ke_toan`, `admin`, PH/HS (qua portal hiện có).
- **Nguồn dữ liệu:** tái dùng query của `portal/student/hoc-ba` - grades + subjects + conduct + competency + attendance + students. Không bảng mới trừ khi cần lưu quyết định lên lớp (xem Q3).
- **Xếp loại:** thêm `hocLucYear()` + `renLuyenYear()` vào `src/lib/tt22.ts` - pure function, unit-test được.
- **In:** `@media print` layout 1 trang/em, hoặc nút "In học bạ" trên drill-down.

## 4. Impact assessment

| Vùng | Mức | Ghi chú |
|---|---|---|
| Schema/RLS | Thấp | 1 bảng mới `year_end_decisions` + RLS + audit |
| Routes | 1 route mới + nav | `/records/hoc-ba` trong nav gvcn/bgh |
| RBAC/ROLE-MATRIX | Cập nhật | Thêm hàng `/records/hoc-ba` |
| TT22 lib | Trung bình | Xếp loại cả năm có nhiều điều kiện rẽ nhánh - cần unit test |
| QA suite | Cập nhật | Thêm route vào matrix 97→98+; W-flow verify hiển thị xếp loại đúng trên seed |
| Rủi ro | Thấp | Chủ yếu read/composition; không đụng write path hiện có |

## 5. Estimate (tách riêng theo quy ước)

- Tech Lead + Dev: ~2-3 ngày (route + tt22 xếp loại + print layout)
- QA: ~0.5-1 ngày (matrix + E2E xếp loại trên seed có đủ biên)
- Tổng ~3-4 dev-ngày nếu không làm xét lên lớp lưu DB (mục 4 chỉ hiển thị gợi ý); +1 ngày nếu lưu quyết định

## 6. Quyết định của PO (23/10/2026)

1. Xếp loại + xét lên lớp: **lưu quyết định vào DB** - bảng `year_end_decisions` + RLS + audit trail
2. In: **export DOCX/PDF theo mẫu học bạ chuẩn** - không chỉ CSS print
3. Danh hiệu khen thưởng: **gom luôn trong scope này** - **đã hiệu chỉnh theo BA Lead review**: TT22/2021 Đ.15 chỉ có **Xuất sắc** / **Giỏi** (tính tự động) + **Giấy khen** cá biệt (BGH nhập tay); "tiên tiến/lao động tiến bộ" là danh hiệu TT58 cũ, không còn.

**Scope cuối đã chốt:** route `/records/hoc-ba` (GVCN lớp mình, BGH/PHT/Sở read toàn trường) - drill-down per-HS với bảng điểm + hạnh kiểm + NLPC + chuyên cần + nhận xét + **xếp loại KQHT/KQRL cả năm tính + lưu** + **xét lên lớp lưu DB** + **danh hiệu tính + lưu** + **export DOCX/PDF**.
