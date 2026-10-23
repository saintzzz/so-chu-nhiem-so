# CR-053 BA Requirements - Học bạ số (rev 3)

**Trạng thái:** BA rev 3 - BA Lead APPROVE_WITH_CHANGES sau round 4; doc polish applied.
**Nguồn:** INTENT.md + CR-053-hoc-ba-so.md (PO đã duyệt scope).
**Regulatory anchor:** TT22/2021 Đ.8, Đ.9, Đ.10-14 (xét lên lớp), Đ.15 (danh hiệu); dự thảo CV 4582 (20/7/2026) định hướng học bạ số thay giấy - **OPEN:** thông tư sửa chưa ban hành, công thức giữ theo TT22 hiện hành.

## 1. User stories

- **US-1 (GVCN):** Cuối năm, tôi cần xem học bạ tổng hợp của từng HS lớp mình (điểm + hạnh kiểm + NLPC + chuyên cần + nhận xét) trên 1 màn hình để rà soát trước khi chốt.
- **US-2 (GVCN):** Hệ thống tự tính KQHT/KQRL cả năm + gợi ý danh hiệu + gợi ý lên lớp theo TT22; tôi xác nhận hoặc ghi đè kèm căn cứ pháp lý, rồi **trình BGH duyệt**.
- **US-3 (BGH):** Tôi xem + **phê duyệt/trả lại** học bạ từng lớp, xuất file chuẩn để nghiệm thu với Sở; giấy khen cá biệt do tôi quyết định thủ công.
- **US-4 (Sở GD/UBND):** Xem học bạ (read-only, chọn trường → lớp → HS) để nghiệm thu.

## 2. Requirements (EARS + AC)

### REQ-53.1 - Màn hình học bạ tổng hợp

- `The system shall` cung cấp route `/records/hoc-ba`: chọn lớp → bảng 1 dòng/HS gồm họ tên, **xếp loại KQHT**, **KQRL**, **danh hiệu**, **quyết định lên lớp**, trạng thái duyệt. (Không cột "ĐTBm CN trung bình" - TT22 không dùng điểm TB chung các môn, tránh số hỗn hợp che cấu trúc thông tư.)
- `When` GVCN chọn 1 HS, `the system shall` hiển thị học bạ chi tiết: thông tin định danh (họ tên, mã HS, ngày sinh, giới tính, lớp) + bảng điểm từng môn **HK1/HK2/CN riêng** (môn nhận xét hiển Đạt/Chưa đạt) + hạnh kiểm HK1/HK2/CN + NLPC + tổng chuyên cần tính theo **buổi** (vắng có phép + không phép) + nhận xét GVCN.
- `Where` lớp chưa đủ dữ liệu xếp loại (thiếu cột điểm bắt buộc `requiredTxCount`, thiếu hạnh kiểm, thiếu result môn nhận xét HK2), `the system shall` hiển thị "Chưa đủ dữ liệu" - không đoán.
- `Where` HS miễn môn (vd GDTC) hoặc HS khuyết tật đánh giá theo kế hoạch riêng, `the system shall` loại môn đó khỏi tập xếp loại; đánh dấu `is_exempt`/`is_special` trên `subjects`/`students` nếu cần (Tech Lead quyết ở Phase 4).

**AC-53.1.1** GIVEN gvcn `anhptl@nd.scn`, WHEN `/records/hoc-ba` chọn 8A2, THEN đủ HS 8A2 + cột KQHT/KQRL/danh hiệu/lên lớp/trạng thái.
**AC-53.1.2** GIVEN click 1 HS, THEN chi tiết khớp DB (định danh + điểm HK1/HK2/CN từng môn + hạnh kiểm + NLPC + chuyên cần buổi + nhận xét).
**AC-53.1.3** GIVEN HS thiếu dữ liệu, THEN "Chưa đủ dữ liệu" thay vì xếp loại.

### REQ-53.2 - Xếp loại cả năm theo TT22/2021 (đã hiệu chỉnh theo BA Lead r1)

Pure functions trong `src/lib/tt22.ts` (nơi `yearAverage` đã làm `(HK1 + 2×HK2)/3` đúng Đ.7; môn nhận xét năm = result HK2 như portal đang làm).

**`hocLucYear` (Đ.9)** - input: danh sách ĐTBmcn môn tính điểm + result cả năm môn nhận xét:

| Mức | Môn nhận xét | Môn tính điểm |
|---|---|---|
| Tốt | tất cả Đạt | tất cả ≥6.5 **và ít nhất 6 môn ≥8.0** |
| Khá | tất cả Đạt | tất cả ≥5.0 **và ít nhất 6 môn ≥6.5** |
| Đạt | **tối đa 1 môn Chưa đạt** | **ít nhất 6 môn ≥5.0** và không môn nào <3.5 |
| Chưa đạt | còn lại | |

- Đ.9.3 **bump rule:** nếu chỉ do 01 môn kéo xuống ≥2 mức so với Tốt/Khá (các môn còn lại thỏa mức đó), xếp lên 1 mức.
- Thiếu dữ liệu bắt buộc → `null`. **Trường <6 môn tính điểm (TH) hoặc thiếu môn trong danh sách trường → `null` + flag "chưa đủ môn theo TT22"** - TT22 Đ.9 ghi "ít nhất 06 môn" không có ngoại lệ; THCS luôn ≥8 môn tính điểm nên không invent rule (rev 3 - bỏ ruling co ngưỡng).

**`renLuyenYear` (Đ.8)** - input rating HK1 + HK2:

| HK2 \ HK1 | Tốt | Khá | Đạt | Chưa đạt |
|---|---|---|---|---|
| Tốt | Tốt | Tốt | Khá | Khá |
| Khá | Khá | Khá | Khá | Đạt |
| Đạt | **Khá** | Đạt | Đạt | Đạt |
| Chưa đạt | Chưa đạt | Chưa đạt | Chưa đạt | Chưa đạt |

(16 pair - thiếu kỳ nào → `null`.)

**`danhHieu` (Đ.15):** **Xuất sắc** = KQRL Tốt + KQHT Tốt + ≥6 môn tính điểm ĐTBmcn ≥9.0; **Giỏi** = KQRL Tốt + KQHT Tốt (không Xuất sắc); **Giấy khen** thành tích đột xuất/tiến bộ vượt bậc = **BGH ghi thủ công**, không tính tự động. Bỏ "tiên tiến/lao động tiến bộ" (danh hiệu TT58 cũ, PO scope cập nhật theo TT22).

**`xetLenLop` (Đ.10-14) gợi ý - thứ tự đánh giá cố định, không chồng nhánh:**
1. Thiếu dữ liệu → `null`
2. Tổng buổi vắng (có phép + không phép) **>45** → `o_lai` (TT22: không được lên lớp, không đánh giá lại/rèn hè)
3. KQRL Chưa đạt → `ren_luyen_he`
4. KQHT Chưa đạt → `kiem_tra_danh_gia_lai` (môn ĐTBmcn <5.0 hoặc nhận xét Chưa đạt)
5. Còn lại → `len_lop`

Stage `after_retest`/`after_summer` (đánh giá lại/rèn luyện hè xong): cùng thứ tự trên với dữ liệu sau đánh giá, **trừ các nhánh kết thúc** - mỗi phương án rèn luyện tối đa 1 lần:
- `after_summer` + KQRL vẫn Chưa đạt → `o_lai` (không `ren_luyen_he` lần 2)
- `after_summer` + KQRL Đạt nhưng KQHT vẫn Chưa đạt → `kiem_tra_danh_gia_lai` **nếu chưa có quyết định stage `after_retest`** (HS chưa từng được đánh giá lại); nếu đã có `after_retest` → `o_lai`
- `after_retest` + KQHT vẫn Chưa đạt → `o_lai`

**AC-53.2.1** GIVEN fixture boundary (ĐTBmcn **6.4/6.5**, môn đếm ngưỡng **7.9/8.0** - lưu ý ĐTBmcn làm tròn 0.1 nên 6.49 không tồn tại), WHEN `hocLucYear`, THEN đúng bảng Đ.9 gồm cả bump-rule Đ.9.3. Unit + property test.
**AC-53.2.2** GIVEN đủ 16 pair (HK1, HK2) fixture, WHEN `renLuyenYear`, THEN đúng bảng Đ.8.
**AC-53.2.3** GIVEN màn hình học bạ, THEN KQHT/KQRL/danh hiệu/gợi ý lên lớp hiển thị khớp công thức trên dữ liệu thật.
**AC-53.2.4** GIVEN fixture stage `after_retest`/`after_summer` (gồm cả path cả-2-Chưa-đạt: `ren_luyen_he` → sau hè KQRL Đạt + KQHT Chưa đạt → `kiem_tra_danh_gia_lai` → vẫn Chưa đạt → `o_lai`), WHEN `xetLenLop`, THEN mỗi phương án rèn luyện xảy ra tối đa 1 lần; không vòng lặp `ren_luyen_he`/`kiem_tra_danh_gia_lai` lần 2.

### REQ-53.3 - Lưu quyết định + luồng duyệt

Bảng mới `year_end_decisions`: `student_id`, `school_id`, `academic_year_id`, `stage` (`initial`/`after_retest`/`after_summer`), `kqht`, `kqrl`, `danh_hieu`, `giay_khen_note` (BGH nhập tay), `promotion`, `override_legal_ground`, `computed_snapshot jsonb` (giá trị hệ thống tính tại thời điểm submit - base để phát hiện dữ liệu nguồn đổi), `status` (`draft`/`submitted`/`approved`/`rejected`/`locked`), `reject_reason`, `revision int` (tăng mỗi lần resubmit), `decided_by`, `decided_at`, `approved_by`, `approved_at`. Unique `(student_id, academic_year_id, stage)`.

- `When` GVCN lưu nháp, → `draft`; `When` trình duyệt, → `submitted` (lưu `computed_snapshot` + override nếu có).
- `When` BGH duyệt, → `approved`; trả lại → `rejected` + `reject_reason` bắt buộc; `When` GVCN sửa học bạ bị reject và trình lại, → `submitted` với `revision+1`; `locked` khi khóa sổ cuối năm (liên kết `lock-records`) - sau `locked` mọi ghi bị deny.
- `The system shall` bắt buộc `override_legal_ground` khi GVCN ghi đè gợi ý, **chỉ chấp nhận căn cứ hợp lệ**: điều chỉnh Đ.9.3 / đánh giá lại / HS khuyết tật / miễn môn - override chỉ hiệu lực khi BGH `approved`.
- `When` dữ liệu nguồn đổi sau `submitted`, `the system shall` recompute và cảnh báo "dữ liệu nguồn đã thay đổi" khi recompute ≠ `computed_snapshot` (không so với giá trị quyết định - tránh báo giả khi override hợp lệ).
- `The system shall` ghi audit log mọi transition + insert `notifications` cho BGH khi GVCN submit, cho GVCN khi BGH duyệt/trả.
- RLS: read dept dùng **`my_role() in ('so_gd','ubnd')`** tường minh (KHÔNG `scn_is_dept()` - hàm này include `admin`, sẽ leak read cho admin); GVCN ghi HS lớp mình chủ nhiệm cùng trường; BGH ghi/duyệt toàn trường; pht/so_gd/ubnd chỉ SELECT.

**AC-53.3.1** GIVEN gvcn submit trên UI, THEN row tồn tại với `school_id` + `year` + `decided_by` đúng + `status=submitted`.
**AC-53.3.2** GIVEN gvcn trường khác / gvbm không chủ nhiệm / PH, WHEN gọi action trực tiếp, THEN 403 + không ghi row.
**AC-53.3.3** GIVEN ghi đè không chọn căn cứ pháp lý, THEN submit bị chặn inline.
**AC-53.3.4** GIVEN submitted → BGH approve, THEN `status=approved` + `approved_by` đúng + notification tới GVCN.
**AC-53.3.5** GIVEN đổi điểm sau submitted, THEN cảnh báo "dữ liệu nguồn đã thay đổi" hiển thị (so `computed_snapshot`, không phải giá trị quyết định).
**AC-53.3.6** GIVEN BGH reject kèm lý do, THEN `status=rejected` + `reject_reason` lưu + notification GVCN; GVCN sửa → resubmit `status=submitted`, `revision+1`.
**AC-53.3.7** GIVEN `status=locked`, WHEN GVCN/BGH thử ghi, THEN deny cả UI lẫn DB.
**AC-53.3.8** GIVEN GVCN lưu nháp chưa trình, THEN `status=draft` tồn tại, BGH chưa thấy trong hàng chờ duyệt.

### REQ-53.4 - Export học bạ

- `When` GVCN/BGH bấm "Xuất học bạ" (từng em hoặc **cả lớp** cho BGH), `the system shall` tạo **DOCX** theo mẫu học bạ: thông tin + bảng điểm + hạnh kiểm + NLPC + xếp loại + quyết định + ô ký GVCN/Hiệu trưởng + ô "Giấy khen" nếu có. **PDF** qua thư viện render (docx→pdf nếu có pipeline sẵn, hoặc tạo PDF trực tiếp từ cùng data - Tech Lead chọn ở Phase 4; không dùng browser print trên file DOCX).
- `Where` học bạ chưa `approved`, export vẫn được nhưng watermark/nhãn "BẢN NHÁP - CHƯA DUYỆT".
- Export staff học bạ chỉ cho **gvcn (lớp mình) + bgh**; deny `pht`, `so_gd`, `ubnd` (read-only không export), `gvbm`, `to_truong` (không kiêm gvcn), `ke_toan`, `admin`, `phu_huynh`, `hoc_sinh`, GVCN lớp khác.
- Xuất cả lớp = **1 file DOCX gộp**, mỗi HS ngắt trang (không zip).

**AC-53.4.1** GIVEN học bạ approved, WHEN xuất DOCX, THEN file mở được, đủ section; WHEN role deny (gồm pht/so_gd) gọi export, THEN 403.
**AC-53.4.2** GIVEN BGH xuất cả lớp, THEN 1 file DOCX duy nhất chứa đủ học bạ từng HS.
**AC-53.4.3** GIVEN học bạ draft/submitted, WHEN export, THEN watermark "BẢN NHÁP - CHƯA DUYỆT" hiện trên trang.
**AC-53.4.4** GIVEN export PDF, THEN file PDF mở được và nội dung khớp DOCX (cùng data source).

### REQ-53.5 - RBAC + nav + role matrix cascade

- `/records/hoc-ba` allow: `gvcn` (ghi, lớp mình), `bgh` (ghi/duyệt, toàn trường), `pht` (read), `so_gd`/`ubnd` (read, chọn trường→lớp→HS, RLS check `my_role() in ('so_gd','ubnd')` tường minh). Deny phần còn lại.
- **Cascade ROLE-MATRIX:** `records/*` hiện chỉ gvcn+bgh; thêm dòng `/records/hoc-ba` allow-list trên; ghi chú override rõ ràng dòng 83 (PHT "Không tiếp cận hồ sơ chi tiết HS" per CR-016) và dòng 102 (so_gd/ubnd "Deny mọi route khác") - PO đã duyệt đọc toàn trường cho học bạ trong scope CR-053.
- Nav: "Học bạ số" dưới nhóm Hồ sơ cho `gvcn`/`bgh` **và cả `pht`/`so_gd`/`ubnd`** (read roles phải có đường vào - role chọn trường→lớp→HS).

**AC-53.5.1** `qa-matrix` thêm route: allow `gvcn`/`bgh`/`pht`/`so_gd`/`ubnd` (read render OK); deny `gvbm`/`to_truong`/`ke_toan`/`admin`/`phu_huynh`/`hoc_sinh`; write action deny cho pht/so_gd/ubnd + gvcn lớp khác (DB-level).

## 3. Adversarial elicitation (tự tấn công) - đã triage

| Vector | Quyết |
|---|---|
| Trường <6 môn tính điểm | `null` + flag "chưa đủ môn theo TT22" (Đ.9 không ngoại lệ; THCS luôn ≥8 môn) |
| HS chuyển lớp giữa năm | Decision gắn (student, year, stage); GVCN lớp cuối năm ghi - GVCN chốt có thể không dạy HK1, chấp nhận theo nghiệp vụ thật |
| 2 actor chốt đồng thời | Last-write-wins + status transition + audit (không CAS) |
| Điểm đổi sau khi đã submit | Cảnh báo recompute; BGH duyệt dựa trên snapshot tại submit |
| KQHT+KQRL đều Chưa đạt | → `ren_luyen_he` trước; sau hè KQRL vẫn CĐ → `o_lai`; KQRL Đạt + KQHT CĐ → `kiem_tra_danh_gia_lai` → vẫn CĐ → `o_lai` (xem REQ-53.2 / AC-53.2.4) |
| Miễn môn/HS khuyết tật | Loại khỏi tập xếp loại; cần flag dữ liệu - Phase 4 quyết column hay config |
| Miền đếm chuyên cần | Tính theo **buổi** (khớp TT22 "45 buổi"); cần Tech Lead map `attendance_records` → buổi |
| Giấy khen cá biệt | Trường thủ công của BGH (`giay_khen_note`), không auto |
| **OPEN:** CV 4582 thay đổi công thức → giữ TT22 hiện hành, CR sau | |

## 4. Scope NGOÀI

- Ký số hiệu trưởng; đồng bộ CSDL ngành; học bạ nhiều năm (chỉ năm hiện tại).

## 5. RTM seeds

`REQ-53.1 → AC-53.1.x` | `REQ-53.2 → AC-53.2.x` | `REQ-53.3 → AC-53.3.x` | `REQ-53.4 → AC-53.4.x` | `REQ-53.5 → AC-53.5.1`
