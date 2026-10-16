# ĐỀ XUẤT KINH PHÍ DỰ ÁN - ~2.79 TỶ ĐỒNG

**Mục tiêu:** kêu gọi đồng đầu tư / share-risk cho VieSchool - Sổ Chủ Nhiệm Số + TVC360.
**Ngày:** 16/10/2026. Trạng thái: bản nháp để negotiate.

**Phương pháp tính:** bottom-up - rate/tháng × allocation % × số tháng của từng người theo từng phase. Không có con số tổng tròn - tổng là kết quả cộng dồn.

## Rate card (lương FTE/tháng)

| Người | Vai trò | Rate (VND/tháng) |
|---|---|---|
| Bình | Fullstack lead | 55 000 000 |
| Phiên | Backend | 40 000 000 |
| Lan | QA / Tester | 25 000 000 |
| (PM) | PM / PO / BA | 30 000 000 |

---

## PHẦN A - ĐÃ ĐẦU TƯ (T03/2026 - 15/10/2026, 7.5 tháng)

Bên phát triển đã tự gánh toàn bộ để đưa sản phẩm từ 0 → production sẵn sàng demo gate 15/10.

### Resource plan theo phase

| Người | T03-T06/26 (4 tháng) - nền tảng | T07-T08/26 (2 tháng) - nghiệp vụ lõi | T09/26 (1 tháng) - TVC360 + SCN | T01-15/10/26 (0.5 tháng) - demo gate | Tổng (VND) |
|---|---|---|---|---|---|
| Bình - Fullstack | 100% → 220M | 100% → 110M | 100% → 55M | 100% → 27.5M | **412 500 000** |
| Phiên - Backend | 80% → 128M | 100% → 80M | 100% → 40M | 100% → 20M | **268 000 000** |
| Lan - QA | - | 50% → 25M | 100% → 25M | 100% → 12.5M | **62 500 000** |
| PM / BA | - | 30% → 18M | 30% → 9M | 30% → 4.5M | **31 500 000** |
| **Nhân sự** | **348M** | **233M** | **129M** | **64.5M** | **774 500 000** |
| Infra + AI dev + domain | | | | | ~19 200 000 |
| **TỔNG PHẦN A** | | | | | **~793 700 000** |

### Nội dung từng sub-phase

- **T03-T06:** kiến trúc multi-tenant, RBAC 11 role, RLS/tenant isolation, schema nghiệp vụ (chuyên cần, hồ sơ, điểm, hạnh kiểm)
- **T07-T08:** hoàn thiện nghiệp vụ lõi, portal PH/HS, auth + phân quyền, QA vào cuộc 50%
- **T09:** requirement TVC360 (04/09) + khởi động SCN (11/09) - Studio soạn học liệu, ngân hàng câu hỏi, KHBĐ CV 5512; full team
- **T01-15/10:** demo gate - self-service onboarding trên sochunhiem.vieschool.com, QA toàn diện, fix perf + RLS

### Minh chứng giá trị đã có

- 49 CR lớn đã merge (CR-001 → CR-049), gồm chiến dịch hardening ~30 vòng external review độc lập
- Multi-tenant 3 trường, phân quyền 11 role enforce ở DB (RLS)
- Ngân hàng 21k+ câu hỏi phủ 81/81 YCCĐ; export DOCX/PPTX; TTS audio thật
- QA production: 49/49 coverage + 57/57 security-edge + 18/18 onboarding + 23/23 lifecycle
- AI production-grade: multi-key/multi-model fallback, hedged race (doc dài 33.7s → ~5s), PII redaction

> Tham chiếu: thuê dev shop cùng scope ~7.5 tháng thường 1.3-1.6 tỷ; định giá ở cost payroll là conservative.

---

## PHẦN B - DỰ KIẾN PHÁT TRIỂN (16/10/2026 - 31/03/2027, 5.5 tháng)

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

- **T10-T11:** pilot 3-5 trường thật (data migration + đào tạo GV), SLA hotfix trong ngày
- **T12:** ngân hàng câu hỏi THCS theo YCCĐ đối tác, pipeline duyệt 2 lớp (tổ → BGH)
- **T01/2027:** báo cáo DPIA/bảo mật, tài liệu vận hành, runbook
- **T02-T03/2027:** hoàn thiện theo feedback pilot, chuẩn bị commercial launch + billing

> Supabase Pro + compute Small bắt buộc từ khi có tenant trả phí (vụ throttling 09/10 chứng minh free tier không đủ) - đã tính trong bảng.

---

## PHẦN C - MAINTAIN / SỬA LỖI (T04/2027 - T12/2028, 21 tháng)

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
| A - Đã đầu tư (sunk) | T03/26 - 15/10/26 (7.5 tháng) | **~793 700 000** |
| B - Phát triển | 16/10/26 - 31/03/27 (5.5 tháng) | **~829 450 000** |
| C - Maintain | T04/27 - T12/28 (21 tháng) | **~1 165 500 000** |
| **TỔNG** | | **~2 788 650 000 (~2.79 tỷ)** |

- Bên phát triển đã bỏ: ~794M (28%) - sunk, không hoàn, không khấu trừ
- Kêu gọi trước tiên: phần B (~829M) - forecast 5.5 tháng tới
- Nếu đồng ý mở rộng: B + C = ~1 995M (72%)
- Burn rate build: 129M nhân sự + ~8.1M infra /tháng
- Burn rate maintain: 46.5M nhân sự + ~9M infra /tháng

---

## PHƯƠNG ÁN KÊU GỌI & CHIA SẺ

Mô hình chung: **T03/2027 - T03/2029 (2 năm đầu) chia doanh thu; sau T03/2029 chuyển sang chia cổ phần.** Phần A (~794M) là sweat equity của bên phát triển - không hoàn, không khấu trừ.

### PA-1 - Kêu gọi phần B (~829 450 000) - ưu tiên trước

| Mục | Đề xuất |
|---|---|
| Nhà đầu tư bỏ | ~829M cho 5.5 tháng phát triển |
| Bên phát triển gánh | Phần A sunk (~794M) + tự gánh phần C (~1 166M maintain) + toàn bộ công sức vận hành |
| Chia doanh thu T03/27 - T03/29 | **Nhà đầu tư 40-45% / dev 55-60%**, có cơ chế recoup-first: phần share nhà đầu tư trừ vào gốc 829M; recoup xong thì nhà đầu tư còn ~30-35% đến hết kỳ |
| Cổ phần sau T03/2029 | Nhà đầu tư ~**10-15%** |

> Lý do tỉ lệ: nhà đầu tư gánh 30% tổng chi phí dự án nhưng nhận 40-45% doanh thu 2 năm đầu - ưu đãi bù rủi ro early; dev giữ majority vì đóng góp ~70% (sunk A + maintain C) và sở hữu IP.

### PA-2 - Kêu gọi B + C (~1 994 950 000)

| Mục | Đề xuất |
|---|---|
| Nhà đầu tư bỏ | ~1 995M: ứng B (~829M) + trả C theo tháng thực tế (~55.5M/th × 21 tháng) |
| Bên phát triển gánh | Phần A sunk (~794M) + vận hành |
| Chia doanh thu T03/27 - T03/29 | **Nhà đầu tư 60-65% / dev 35-40%**, recoup-first trên tổng đã giải ngân; recoup xong thì nhà đầu tư còn ~40-45% đến hết kỳ |
| Cổ phần sau T03/2029 | Nhà đầu tư ~**20-25%** |

> Nhà đầu tư gánh 72% tổng chi phí → nhận 60-65% doanh thu - dev vẫn giữ trên mức tỷ lệ vốn nhờ IP + sunk A + vai trò vận hành.

### Điều khoản bắt buộc kèm theo

- Giải ngân theo milestone có deliverable kiểm chứng được - không ứng trọn
- Clock chia doanh thu chỉ đếm từ khách trả phí đầu tiên - pilot free không tính; nếu khách paid đầu tiên trễ hơn T03/2027, cửa sổ 2 năm dịch tương ứng
- Cổ phần vesting từ ngày ký, ghi rõ entity - không phải hứa sau 2 năm
- Báo cáo burn + doanh thu hàng tháng; audit rights cho phần giải ngân
- IP codebase thuộc bên phát triển; nhà đầu tư nhận quyền sử dụng / chia theo deal
- Khi scale >5 trường đồng thời: review hạ tầng (compute tier, read replica) - chi phí vượt khung C tính CR riêng có phê duyệt 2 bên

---

*Gen PPTX: `node scripts/gen-proposal-investment-pptx.mjs` → `docs/handover/PROPOSAL-tong-dau-tu-2ty8.pptx`*
