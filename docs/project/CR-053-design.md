# CR-053 Design Spec - Học bạ số `/records/hoc-ba` (rev 2)

**Fidelity:** token-faithful - bám Fluent 2 (`theme-fluent` + `src/lib/domain-theme.ts`), tái dùng component hiện có. Không theme mới, không icon ngoài lucide, không emoji.

## 0. Nhãn đầy đủ (rule naming - áp cho toàn màn hình)

| Viết tắt nội bộ | Nhãn UI bắt buộc |
|---|---|
| KQHT | Kết quả học tập |
| KQRL | Kết quả rèn luyện |
| HK1 / HK2 / CN | Học kỳ 1 / Học kỳ 2 / Cả năm |
| NLPC | Năng lực phẩm chất |
| mã HS | Mã học sinh |
| Trình BGH duyệt | Trình Ban Giám Hiệu duyệt |
| đđ | Buổi vắng (có phép / không phép) |

## 1. Điều hướng + chọn ngữ cảnh

- Nav "Học bạ số" cho `gvcn`, `bgh`, `pht`, `so_gd`, `ubnd` (cả 5 role có đường vào).
- **Bộ chọn phân cấp** theo role:
  - `gvcn`: chỉ lớp mình chủ nhiệm - picker 1 cấp (chips nếu ≤4 lớp, dropdown nếu >4).
  - `bgh`/`pht`: lớp trong trường mình - picker lớp.
  - `so_gd`/`ubnd`: **chọn trường → lớp → HS** - 2 dropdown phân cấp (trường nạp từ bảng schools quyền dept; lớp theo trường). Đổi trường reset lớp+HS; đổi lớp reset HS.
- Query state: `?school=` `?class=` `?student=`; deep-link tải thẳng được.
- Không có trường/lớp: empty state "Chưa có trường/lớp nào trong phạm vi".

## 2. Màn hình danh sách lớp

- `PageHeader` `section="Hồ sơ lớp học"`, `title="Học bạ số"`.
- **DataTable**: `Học sinh` (sort `sortByVietnameseName`) | `Kết quả học tập` | `Kết quả rèn luyện` | `Danh hiệu` | `Lên lớp` | `Trạng thái` | `Thao tác` (link "Xem").
  - Xếp loại: `StatusBadge` - tot→success, kha→primary, dat→warning, chua_dat→error, null→"Chưa đủ dữ liệu" muted; trường thiếu môn tính điểm → "Chưa đủ môn theo TT22" (tooltip/footnote giải thích: trường chưa khai đủ môn tính điểm trong danh mục).
  - Trạng thái duyệt: nháp (muted) / chờ duyệt (warning) / đã duyệt (success) / bị trả (error) / đã khóa (primary).
- **Banner warning** trên bảng khi ≥1 HS có recompute ≠ `computed_snapshot`: "Dữ liệu nguồn đã thay đổi sau khi trình duyệt - cần rà soát lại".
- Empty: "Lớp chưa có học sinh" + số lượng.
- **Nút export cấp lớp** "Xuất học bạ cả lớp" chỉ hiện với `bgh`; read-only roles và gvcn không thấy (gvcn chỉ export từng em ở drill-down).

## 3. Drill-down học bạ 1 HS

Sections dọc, mỗi section `rounded-xl border bg-card shadow-[var(--shadow-sm-token)]`:

1. **Định danh:** họ tên (heading), Mã học sinh, Ngày sinh (`fmtDateVN`), Giới tính, Lớp, Năm học - grid 2 cột (mobile 1 cột) như portal hoc-ba.
2. **Bảng điểm theo môn:** DataTable `Môn học | Học kỳ 1 | Học kỳ 2 | Cả năm` - môn nhận xét render Đạt/Chưa đạt; empty state "Chưa có điểm".
3. **Hạnh kiểm:** 3 badge Học kỳ 1 / Học kỳ 2 / Cả năm + nhận xét giáo viên chủ nhiệm; empty "Chưa đánh giá hạnh kiểm".
4. **Năng lực phẩm chất:** nhóm tiêu chí + nhận xét; empty "Chưa đánh giá năng lực phẩm chất".
5. **Chuyên cần:** tổng **buổi** vắng có phép / không phép / tổng; badge đỏ ">45 buổi - không được xét lên lớp".
6. **Kết quả năm:** 2 hàng - "Hệ thống tính" (computed) vs "Quyết định" (stored): Kết quả học tập, Kết quả rèn luyện, Danh hiệu, Lên lớp + trạng thái + người quyết định/người duyệt + `formatDateTime` timestamp; khi có reject → hiển thị `reject_reason` rõ ràng (alert error); khi recompute ≠ snapshot → badge "Dữ liệu nguồn đã thay đổi".

## 4. Panel quyết định - ma trận role × status × stage

**Khả năng ghi** (tất cả bị chặn khi `locked` hoặc role read-only):

| Trạng thái | GVCN (lớp mình) | BGH |
|---|---|---|
| không có row / draft | Chỉnh + "Lưu nháp" + "Trình Ban Giám Hiệu duyệt" | xem |
| submitted | xem + banner "Đang chờ Ban Giám Hiệu duyệt" | "Duyệt" / "Trả lại" (bắt buộc lý do) |
| rejected | Chỉnh (hiển thị `reject_reason` + "Lần trình: N") + trình lại | xem |
| approved | xem (+ cảnh báo nếu dữ liệu nguồn đổi) | xem (không reopen - BA không cho phép; muốn sửa phải qua flow mới/chờ locked) |
| locked | xem | xem |

**Stage** `initial`/`after_retest`/`after_summer` hiển thị badge "Sau đánh giá lại"/"Sau rèn luyện hè" trên section Kết quả năm. Tạo quyết định stage sau **chỉ khi** stage trước `approved` VÀ kết quả `promotion` của nó cho phép:
- `kiem_tra_danh_gia_lai` → cho phép tạo `after_retest`
- `ren_luyen_he` → cho phép tạo `after_summer`; `after_summer` có thể dẫn `kiem_tra_danh_gia_lai` → tạo `after_retest` (khi chưa có)
- `len_lop`/`o_lai` → kết thúc, không tạo stage mới
- Nút "Tạo quyết định sau đánh giá lại/rèn luyện hè" chỉ hiện đúng nhánh; mỗi stage tối đa 1 lần (unique student+year+stage đã enforce ở DB).

**Form GVCN:** hiển thị computed; ghi đè KQHT/KQRL/lên lớp dùng **inline chips/radio** (≤4 option - theo control-selection rule); khác computed → bắt buộc chọn căn cứ pháp lý (inline radio 4 lựa chọn: "Điều chỉnh theo TT22 Điều 9.3" / "Sau đánh giá lại" / "Học sinh khuyết tật" / "Miễn môn") + `AutoGrowTextarea` ghi chú; submit disabled đến khi valid.
**Form BGH:** `giay_khen_note` dùng `AutoGrowTextarea` (chỉ BGH nhập); reject reason `AutoGrowTextarea` bắt buộc.
**Read-only** (pht/so_gd/ubnd): panel ẩn hoàn toàn.

## 5. Export

- Drill-down: 2 nút "Xuất DOCX" + "Xuất PDF" - chỉ `gvcn` lớp mình + `bgh`.
- List: "Xuất học bạ cả lớp" (DOCX gộp, page-break per HS) - chỉ `bgh`.
- File layout: header trường/lớp/năm → định danh → bảng điểm → hạnh kiểm → NLPC → chuyên cần → kết quả năm + danh hiệu + ô "Giấy khen" khi `giay_khen_note` có → ô chữ ký "Giáo viên chủ nhiệm" + "Hiệu trưởng". Chưa approved → watermark "BẢN NHÁP - CHƯA DUYỆT".

## 6. Feedback + states (mutation + export)

- Mọi action có pending spinner + nút disable trong lúc chạy (chống double-submit); success toast + cập nhật badge trạng thái không cần reload tay (`refresh()`).
- Thất bại: giữ nguyên text đã nhập, inline error gắn field ("Cần chọn căn cứ pháp lý", "Lý do bắt buộc ≥10 ký tự"), toast error tổng.
- Export: nút chuyển "Đang xuất..." trong lúc gen; lỗi → toast + giữ trạng thái.
- Route loading skeleton (`loading.tsx`) khớp list + drill-down; mọi DataTable có empty state; loadError notice `border-l-error` như portal hoc-ba.
- Mobile: bảng `overflow-x-auto relative`; drill-down 1 cột.

## 7. A11y

- Inline radio group thật (role=radiogroup), reject reason dialog keyboard-nav, focus ring token; badge tones đạt contrast sẵn.
