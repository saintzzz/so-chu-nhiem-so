# ĐỀ XUẤT KINH PHÍ DỰ ÁN - ~2.85 TỶ ĐỒNG

**Mục tiêu:** kêu gọi đồng đầu tư / share-risk cho VieSchool - Sổ Chủ Nhiệm Số + TVC360.
**Ngày:** 16/10/2026 - cập nhật 02/11/2026 theo tình hình thực tế. Trạng thái: bản nháp để negotiate.

**Phương pháp tính:** bottom-up - rate/tháng × allocation % × số tháng của từng người theo từng phase. Không có con số tổng tròn - tổng là kết quả cộng dồn.

## Rate card (lương FTE/tháng)

| Người | Vai trò | Rate (VND/tháng) |
|---|---|---|
| Bình | Fullstack lead | 55 000 000 |
| Phiên | Backend | 40 000 000 |
| Lan | QA / Tester | 25 000 000 |
| (PM) | PM / PO / BA | 30 000 000 |

---

## PHẦN A - ĐÃ ĐẦU TƯ (T03/2026 - 02/11/2026, ~8 tháng)

Bên phát triển đã tự gánh toàn bộ để đưa sản phẩm từ 0 → production và tiếp tục phát triển đến hôm nay, không dừng ở demo gate 15/10.

### Resource plan theo phase

| Người | T03-T06/26 (4 tháng) - nền tảng | T07-T08/26 (2 tháng) - nghiệp vụ lõi | T09/26 (1 tháng) - TVC360 + SCN | T10-02/11/26 (1 tháng) - modular + trial | Tổng (VND) |
|---|---|---|---|---|---|
| Bình - Fullstack | 100% → 220M | 100% → 110M | 100% → 55M | 100% → 55M | **440 000 000** |
| Phiên - Backend | 80% → 128M | 100% → 80M | 100% → 40M | 100% → 40M | **288 000 000** |
| Lan - QA | - | 50% → 25M | 100% → 25M | 100% → 25M | **75 000 000** |
| PM / BA | - | 30% → 18M | 30% → 9M | 30% → 9M | **36 000 000** |
| **Nhân sự** | **348M** | **233M** | **129M** | **129M** | **839 000 000** |
| Infra + AI dev + domain | | | | | ~20 500 000 |
| **TỔNG PHẦN A** | | | | | **~859 500 000** |

### Nội dung từng sub-phase

- **T03-T06:** kiến trúc multi-tenant, RBAC 11 role, RLS/tenant isolation, schema nghiệp vụ (chuyên cần, hồ sơ, điểm, hạnh kiểm)
- **T07-T08:** hoàn thiện nghiệp vụ lõi, portal PH/HS, auth + phân quyền, QA vào cuộc 50%
- **T09:** requirement TVC360 (04/09) + khởi động SCN (11/09) - Studio soạn học liệu, ngân hàng câu hỏi, KHBĐ CV 5512; full team
- **T10-02/11:** demo gate → modular packaging (20 module / 4 suite bán lẻ, entitlement per-school) → provision tenant trial TRIAL01 cho khách tiềm năng thật

### Minh chứng giá trị đã có (cập nhật 02/11)

- **77+ CR lớn đã merge** (CR-001 → CR-077), gồm ~40 vòng external review độc lập theo External Review Loop
- **20 module nghiệp vụ** chia 4 suite bán lẻ: Quản lý trường / Dạy & học / Chăm sóc PH-HS / Dashboard & tích hợp - bật-tắt theo từng trường, menu + route + RPC đều gate
- **Tenant trial TRIAL01 đang chạy** cho khách hàng tiềm năng thật - chỉ mở tác vụ cơ bản, khóa phân hệ nâng cao (đã verify Playwright end-to-end)
- Nghiệp vụ mới trong T10: học bạ XML QĐ 3016 + ký số 2 cấp, xét tốt nghiệp, điều động GV trên TKB, văn thư, y tế-BHYT (campus-scoped RLS), thư viện, biến động HS, integration framework (connectors + outbox + worker) sẵn sàng cho CSDL Bộ/VNeID/cổng thanh toán
- Multi-tenant 4 trường, phân quyền 11 role enforce ở DB (RLS)
- Ngân hàng 21k+ câu hỏi phủ 81/81 YCCĐ; export DOCX/PPTX; TTS audio thật
- AI production-grade: multi-key/multi-model fallback, hedged race (doc dài 33.7s → ~5s), PII redaction
- Camera điểm danh: DPIA + kiến trúc edge đã thiết kế xong, chờ pilot phần cứng

> Tham chiếu: thuê dev shop cùng scope ~8 tháng thường 1.4-1.7 tỷ; định giá ở cost payroll là conservative.

---

## PHẦN B - DỰ KIẾN PHÁT TRIỂN (03/11/2026 - 18/04/2027, 5.5 tháng)

Giữ nguyên cấu hình team đã chứng minh hiệu quả (3.3 FTE = 129M/tháng nhân sự).

| Người | Allocation | Rate | 5.5 tháng (VND) |
|---|---|---|---|
| Bình - Fullstack | 100% | 55M | 302 500 000 |
| Phiên - Backend | 100% | 40M | 220 000 000 |
| Lan - QA | 100% | 25M | 137 500 000 |
| PM / BA | 30% | 30M | 49 500 000 |
| **Nhân sự** | 3.3 FTE | **129M/tháng** | **709 500 000** |
| Supabase Pro + compute Small | | ~2.5M/th | 13 750 000 |
| Vercel Pro | | ~0.6M/th | 3 300 000 |
| AI API (gen bank câu hỏi, KHBĐ) | | ~4M/th | 22 000 000 |
| Domain + Resend + monitoring | | ~1M/th | 5 500 000 |
| Contingency ~10% (phát sinh pilot) | | | ~75 400 000 |
| **TỔNG PHẦN B** | | | **~829 450 000** |

### Deliverables theo tháng

- **T11/2026:** trial TRIAL01 đang chạy → mở rộng pilot 3-5 trường thật (data migration + đào tạo GV), SLA hotfix trong ngày
- **T12/2026:** ngân hàng câu hỏi THCS theo YCCĐ đối tác, pipeline duyệt 2 lớp (tổ → BGH); billing path trên nền suite entitlement đã có
- **T01-T02/2027:** báo cáo DPIA/bảo mật, tài liệu vận hành, runbook; tích hợp thật khi đối tác cấp credential (CSDL Bộ nạp điểm, VNeID, cổng thanh toán - framework đã sẵn)
- **T03-T04/2027:** hoàn thiện theo feedback pilot, commercial launch + billing trên mô hình bán lẻ module

> Supabase Pro + compute Small bắt buộc từ khi có tenant trả phí (vụ throttling 09/10 chứng minh free tier không đủ) - đã tính trong bảng.

---

## PHẦN C - MAINTAIN / SỬA LỖI (T05/2027 - T01/2029, 21 tháng)

Vận hành lean sau launch - không giữ team build.

| Người | Allocation | Rate | 21 tháng (VND) |
|---|---|---|---|
| Bình - Fullstack (oncall/hotfix/CR nhỏ) | 70% | 55M | 808 500 000 |
| Lan - QA (regression mỗi release) | 20% | 25M | 105 000 000 |
| PM / BA (triage + báo cáo) | 10% | 30M | 63 000 000 |
| **Nhân sự** | 1.0 FTE | **46.5M/tháng** | **976 500 000** |
| Infra (Supabase Pro+Small, Vercel, domain, email) | | ~6M/th | 126 000 000 |
| AI API vận hành | | ~3M/th | 63 000 000 |
| **TỔNG PHẦN C** | | **~55.5M/tháng** | **~1 165 500 000** |

### Cam kết maintain

- SLA: hotfix critical trong ngày làm việc; regression suite chạy lại mỗi deploy
- Security patching + review định kỳ (kế thừa external review loop CR-049)
- Minor CR trong phạm vi sửa lỗi/tinh chỉnh - feature mới lớn tính CR riêng
- Monitoring uptime + báo cáo định kỳ cho đối tác

---

## TỔNG HỢP

| Phần | Giai đoạn | Số tiền (VND) |
|---|---|---|
| A - Đã đầu tư (sunk) | T03/26 - 02/11/26 (~8 tháng) | **~859 500 000** |
| B - Phát triển | 03/11/26 - 18/04/27 (5.5 tháng) | **~829 450 000** |
| C - Maintain | T05/27 - T01/29 (21 tháng) | **~1 165 500 000** |
| **TỔNG** | | **~2 854 450 000 (~2.85 tỷ)** |

- Bên phát triển đã bỏ: ~859.5M (30%) - sunk, không hoàn, không khấu trừ
- Kêu gọi trước tiên (PA-1): **50% phần B ≈ 414 725 000** - dev gánh 50% còn lại
- Nếu mở rộng (PA-2): **50% của B + C ≈ 997 475 000** - dev gánh 50% còn lại
- Burn rate build: 129M nhân sự + ~8.1M infra /tháng
- Burn rate maintain: 46.5M nhân sự + ~9M infra /tháng

---

## PHƯƠNG ÁN KÊU GỌI & CHIA SẺ

Mô hình chung: **share-risk 50-50** - nhà đầu tư và bên phát triển mỗi bên gánh 50% chi phí kêu gọi. **Từ khách trả phí đầu tiên +24 tháng chia doanh thu; sau đó chuyển sang chia cổ phần.** Phần A (~859.5M) là sweat equity của bên phát triển - không hoàn, không khấu trừ, không tính vào phần 50-50.

### PA-1 - Share-risk 50-50 phần B (~829 450 000) - ưu tiên trước

| Mục | Đề xuất |
|---|---|
| Nhà đầu tư gánh | **50% phần B ≈ 414 725 000** cho 5.5 tháng phát triển |
| Bên phát triển gánh | 50% phần B (~414.7M sweat equity) + phần A sunk (~859.5M) + tự gánh phần C (~1 166M maintain) + toàn bộ công sức vận hành |
| Chia doanh thu T03/27 - T03/29 | **Nhà đầu tư ~40% / dev ~60%** - dev giữ majority vì gánh A sunk + C + IP + vận hành |
| Cổ phần sau T03/2029 | Nhà đầu tư ~**10-15%** |

### PA-2 - Share-risk 50-50 cả B + C (~1 994 950 000)

| Mục | Đề xuất |
|---|---|
| Nhà đầu tư gánh | **50% của B+C ≈ 997 475 000** - phần B ứng theo milestone, phần C trả theo tháng thực tế (~27.75M/th × 21 tháng) |
| Bên phát triển gánh | 50% của B+C (~997.5M) + phần A sunk (~859.5M) + vận hành |
| Chia doanh thu T03/27 - T03/29 | **Nhà đầu tư ~45% / dev ~55%** - cam kết lớn hơn PA-1 → share cao hơn |
| Cổ phần sau T03/2029 | Nhà đầu tư ~**15-20%** |

> Tổng quan contribute: PA-1 dev gánh ~2.44 tỷ vs NĐT ~415M; PA-2 dev gánh ~1.86 tỷ vs NĐT ~997M. Cổ phần sau kỳ phản ánh chênh lệch cam kết.

### Điều khoản bắt buộc kèm theo

- Giải ngân theo milestone có deliverable kiểm chứng được - không ứng trọn
- Clock chia doanh thu chỉ đếm từ khách trả phí đầu tiên - pilot free không tính; nếu khách paid đầu tiên trễ hơn T03/2027, cửa sổ 2 năm dịch tương ứng
- Cổ phần vesting từ ngày ký, ghi rõ entity - không phải hứa sau 2 năm
- Báo cáo burn + doanh thu hàng tháng; audit rights cho phần giải ngân
- IP codebase thuộc bên phát triển; nhà đầu tư nhận quyền sử dụng / chia theo deal
- Khi scale >5 trường đồng thời: review hạ tầng (compute tier, read replica) - chi phí vượt khung C tính CR riêng có phê duyệt 2 bên

---

*Gen PPTX: `node scripts/gen-proposal-investment-pptx.mjs` → `docs/handover/PROPOSAL-tong-dau-tu-2ty8.pptx`*
