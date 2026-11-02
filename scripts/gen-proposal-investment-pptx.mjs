/**
 * PROPOSAL keu goi dong dau tu / share-risk: tong ~2.85 ty VND - 3 phan, tinh bottom-up
 * theo resource plan (rate x allocation x thang) - khong dung so tron.
 * Cap nhat 02/11/2026 theo tinh hinh thuc te.
 *   A - Da dau tu (sunk):    T03/2026 -> 02/11/2026 (~8 thang)  ~ 859.5M
 *   B - Du kien phat trien:  03/11/2026 -> 18/04/2027 (5.5 thang) ~ 829.45M
 *   C - Maintain/sua loi:    T05/2027 -> T01/2029 (21 thang)     ~ 1 165.5M
 * Nguon: docs/handover/PROPOSAL-tong-dau-tu-2ty8.md
 * node scripts/gen-proposal-investment-pptx.mjs -> docs/handover/PROPOSAL-tong-dau-tu-2ty8.pptx
 */
import PptxGenJS from "pptxgenjs";
import { mkdirSync } from "node:fs";

const p = new PptxGenJS();
p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
p.layout = "W";

const C = {
  ink: "0f172a", muted: "475569", accent: "0f766e", accentL: "ccfbf1",
  amber: "b45309", white: "ffffff", bg: "f8fafc", line: "e2e8f0", code: "1e293b",
  red: "b91c1c",
};
const FONT = "Segoe UI";

function slideTitle(s, section, title, desc) {
  s.addText(section, { x: 0.55, y: 0.28, w: 12, h: 0.3, fontFace: FONT, fontSize: 11, color: C.accent, bold: true });
  s.addText(title, { x: 0.55, y: 0.55, w: 12.2, h: 0.7, fontFace: FONT, fontSize: 25, bold: true, color: C.ink });
  if (desc) s.addText(desc, { x: 0.55, y: 1.24, w: 12.2, h: 0.45, fontFace: FONT, fontSize: 12.5, color: C.muted });
  s.addShape(p.shapes.LINE, { x: 0.55, y: 1.68, w: 12.2, h: 0, line: { color: C.line, width: 1 } });
}
function bullets(s, items, { x = 0.7, y = 1.9, w = 12, h = 5, fontSize = 13.5, gap = 8 } = {}) {
  s.addText(
    items.flatMap((it) => [
      ...((typeof it === "object" && it.t === undefined) ? [] : [{ text: String(it.t ?? it), options: { bullet: { code: "2022", indent: 14 }, breakLine: true, bold: !!it.b, color: it.c ?? C.ink } }]),
      ...(it.sub ?? []).map((t) => ({ text: String(t), options: { bullet: { code: "2013", indent: 30 }, breakLine: true, color: C.muted, fontSize: fontSize - 1.5 } })),
    ]),
    { x, y, w, h, fontFace: FONT, fontSize, color: C.ink, paraSpaceAfter: gap, valign: "top" },
  );
}
function table(s, rows, opts = {}) {
  s.addTable(
    rows.map((r, i) =>
      r.map((c) => ({
        text: String(c),
        options: {
          fontFace: FONT, fontSize: opts.fontSize ?? 11.5, bold: i === 0 || opts.boldLast && i === rows.length - 1,
          color: i === 0 ? C.white : C.ink,
          fill: { color: i === 0 ? C.accent : i === rows.length - 1 && opts.boldLast ? C.accentL : i % 2 ? C.white : C.bg },
          valign: "middle", margin: 0.06,
        },
      })),
    ),
    { x: opts.x ?? 0.7, y: opts.y ?? 1.9, w: opts.w ?? 12, border: { pt: 0.75, color: C.line }, rowH: opts.rowH ?? 0.45 },
  );
}
function note(s, txt, y = 6.9) {
  s.addText(txt, { x: 0.7, y, w: 12, h: 0.45, fontFace: FONT, fontSize: 10.5, italic: true, color: C.accent });
}

// ---------- S1 Cover ----------
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addText("ĐỀ XUẤT KINH PHÍ DỰ ÁN - ~2.85 TỶ ĐỒNG", {
    x: 0.8, y: 2.0, w: 11.7, h: 1, fontFace: FONT, fontSize: 32, bold: true, color: C.white,
  });
  s.addText("VieSchool - Sổ Chủ Nhiệm Số + TVC360 - kêu gọi đồng đầu tư / share-risk", {
    x: 0.8, y: 3.05, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 15, color: "5eead4",
  });
  s.addText("Tính bottom-up từ resource plan (rate × allocation × tháng): ~859.5M đã đầu tư · ~829M phát triển đến T04/2027 · ~1 166M maintain đến T01/2029", {
    x: 0.8, y: 3.7, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 13, color: "94a3b8" });
  s.addText("Sản phẩm live production tại vieschool.com - tenant trial TRIAL01 đang onboard khách hàng tiềm năng thật", {
    x: 0.8, y: 4.25, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 11.5, italic: true, color: "64748b" });
}

// ---------- S2 Rate card + tong quan ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHƯƠNG PHÁP TÍNH", "Mọi con số = rate × allocation × tháng - kiểm chứng được");
  table(s, [
    ["Người", "Vai trò", "Rate FTE (VND/tháng)"],
    ["Bình", "Fullstack lead", "55 000 000"],
    ["Phiên", "Backend", "40 000 000"],
    ["Lan", "QA / Tester", "25 000 000"],
    ["(PM)", "PM / PO / BA", "30 000 000"],
  ], { y: 1.9, w: 5.6 });
  table(s, [
    ["Phần", "Giai đoạn", "Số tiền"],
    ["A - Đã đầu tư", "T03/26 - 02/11/26 (~8th)", "~859.5M (30%)"],
    ["B - Phát triển", "03/11/26 - 18/04/27 (5.5th)", "~829.45M (29%)"],
    ["C - Maintain", "T05/27 - T01/29 (21th)", "~1 165.5M (41%)"],
    ["TỔNG", "", "~2 854.45M ≈ 2.85 tỷ"],
  ], { x: 6.6, y: 1.9, w: 6.2, boldLast: true });
  bullets(s, [
    { t: "Team ramp theo thực tế: đầu dự án 2 người, QA vào từ T08, full team từ T09 - không tính 3.3 FTE suốt để inflate phần A", c: C.accent },
    { t: "Maintain sau launch chỉ ~1.0 FTE (oncall + regression + triage) - rẻ hơn ~2.8 lần so với build phase" },
    { t: "Phần A là bằng chứng cam kết: đã bỏ tiền thật đưa sản phẩm lên production trước khi kêu gọi" },
  ], { y: 4.7, fontSize: 12.5 });
}

// ---------- S3 Phan A resource plan ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN A - ĐÃ ĐẦU TƯ", "T03/2026 - 02/11/2026 (~8 tháng) - tổng ~859.5M VND, sunk cost không hoàn lại");
  table(s, [
    ["Người", "T03-06 (4th) nền tảng", "T07-08 (2th) nghiệp vụ lõi", "T09 (1th) TVC360+SCN", "T10-02/11 (1th) modular+trial", "Tổng"],
    ["Bình - FS (55M)", "100%", "100%", "100%", "100%", "440 000 000"],
    ["Phiên - BE (40M)", "80%", "100%", "100%", "100%", "288 000 000"],
    ["Lan - QA (25M)", "-", "50%", "100%", "100%", "75 000 000"],
    ["PM/BA (30M)", "-", "30%", "30%", "30%", "36 000 000"],
    ["Nhân sự", "348M", "233M", "129M", "129M", "839 000 000"],
    ["Infra + AI dev + domain", "", "", "", "", "~20 500 000"],
    ["TỔNG PHẦN A", "", "", "", "", "~859 500 000"],
  ], { boldLast: true, fontSize: 10.5, rowH: 0.42 });
}

// ---------- S4 Phan A gia tri ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN A - GIÁ TRỊ ĐÃ TẠO RA", "~859.5M sunk - sản phẩm live + khách trial thật, không phải ý tưởng");
  bullets(s, [
    { t: "77+ CR lớn đã merge (CR-001 → CR-077) - ~40 vòng external review độc lập theo External Review Loop" },
    { t: "20 module nghiệp vụ / 4 suite bán lẻ (Quản lý trường, Dạy-học, PH-HS, Dashboard-tích hợp) - entitlement bật-tắt theo trường, gate menu + route + RPC" },
    { t: "Tenant trial TRIAL01 đang chạy cho khách tiềm năng thật - chỉ mở tác vụ cơ bản, khóa phân hệ nâng cao (verified E2E)" },
    { t: "Nghiệp vụ T10: học bạ XML QĐ 3016 + ký số 2 cấp, xét tốt nghiệp, điều động GV trên TKB, văn thư, y tế-BHYT, thư viện, biến động" },
    { t: "Integration framework (connectors + outbox + worker) sẵn sàng cho CSDL Bộ / VNeID / cổng thanh toán - chờ credential đối tác" },
    { t: "Multi-tenant 4 trường, RBAC 11 role enforce ở DB (RLS); Studio: ngân hàng 21k+ câu hỏi phủ 81/81 YCCĐ, export DOCX/PPTX, TTS thật" },
    { t: "AI production-grade: multi-key/multi-model fallback, hedged race (doc dài 33.7s → ~5s), PII redaction; camera điểm danh đã có DPIA + kiến trúc edge" },
    { t: "Tham chiếu giá trị thay thế: thuê dev shop cùng scope ~8 tháng thường 1.4-1.7 tỷ - định giá ở payroll là conservative", c: C.accent },
  ]);
}

// ---------- S5 Phan B resource plan ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN B - PHÁT TRIỂN", "03/11/2026 - 18/04/2027 (5.5 tháng) - giữ nguyên team 3.3 FTE");
  table(s, [
    ["Người / Khoản", "Allocation", "Rate", "5.5 tháng (VND)"],
    ["Bình - Fullstack", "100%", "55M", "302 500 000"],
    ["Phiên - Backend", "100%", "40M", "220 000 000"],
    ["Lan - QA", "100%", "25M", "137 500 000"],
    ["PM / BA", "30%", "30M", "49 500 000"],
    ["Nhân sự (3.3 FTE)", "", "129M/th", "709 500 000"],
    ["Supabase Pro + compute Small", "", "~2.5M/th", "13 750 000"],
    ["Vercel Pro", "", "~0.6M/th", "3 300 000"],
    ["AI API (gen bank, KHBĐ)", "", "~4M/th", "22 000 000"],
    ["Domain + Resend + monitoring", "", "~1M/th", "5 500 000"],
    ["Contingency ~10% (phát sinh pilot)", "", "", "~75 400 000"],
    ["TỔNG PHẦN B", "", "", "~829 450 000"],
  ], { boldLast: true, fontSize: 11, rowH: 0.38 });
  note(s, "Supabase Pro + Small bắt buộc từ khi có tenant trả phí - vụ throttling 09/10 chứng minh free tier không đủ cho trường thật.", 6.5);
}

// ---------- S6 Phan B deliverables ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN B - DELIVERABLES", "Giải ngân gắn milestone kiểm chứng được");
  table(s, [
    ["Tháng", "Deliverable", "Acceptance"],
    ["Đã xong T10/26", "Suite entitlement/billing foundation + integration framework + tenant trial self-serve (TRIAL01)", "20 module/4 suite gate menu+route+RPC; trial E2E verified - KHÔNG tính lại vào B", ],
    ["T11-T12/2026", "Pilot 3-5 trường thật: data migration + đào tạo GV + onboarding self-serve", "Trường pilot đăng nhập + nhập liệu thật; SLA hotfix trong ngày"],
    ["T01/2027", "Ngân hàng THCS theo YCCĐ đối tác + duyệt 2 lớp (tổ → BGH)", "Coverage YCCĐ đạt target; workflow approve hoạt động E2E"],
    ["T02/2027", "Báo cáo DPIA/bảo mật + tài liệu vận hành + runbook + cổng thanh toán VNPAY/MoMo", "External review pass; handover docs hoàn chỉnh; payment path test"],
    ["T03-T04/2027", "Hoàn thiện theo feedback pilot + commercial launch", "Sản phẩm sẵn sàng bán; 3-5 trường trả phí (stretch)"],
  ], { rowH: 0.62, fontSize: 10.5 });
  bullets(s, [
    { t: "Không ứng trọn một lần - giải ngân theo tháng/milestone có deliverable kiểm chứng được", c: C.accent },
  ], { y: 5.4, fontSize: 12.5 });
}

// ---------- S7 Phan C ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN C - MAINTAIN / SỬA LỖI", "T05/2027 - T01/2029 (21 tháng) - vận hành lean ~1.0 FTE");
  table(s, [
    ["Người / Khoản", "Allocation", "Rate", "21 tháng (VND)"],
    ["Bình - Fullstack (oncall/hotfix/CR nhỏ)", "70%", "55M", "808 500 000"],
    ["Lan - QA (regression mỗi release)", "20%", "25M", "105 000 000"],
    ["PM / BA (triage + báo cáo)", "10%", "30M", "63 000 000"],
    ["Nhân sự (1.0 FTE)", "", "46.5M/th", "976 500 000"],
    ["Infra (Supabase Pro+Small, Vercel, domain, email)", "", "~6M/th", "126 000 000"],
    ["AI API vận hành", "", "~3M/th", "63 000 000"],
    ["TỔNG PHẦN C", "", "~55.5M/th", "~1 165 500 000"],
  ], { boldLast: true, fontSize: 11, rowH: 0.42 });
  bullets(s, [
    { t: "Cam kết: hotfix critical trong ngày làm việc - regression suite chạy lại mỗi deploy - security review định kỳ (kế thừa external review loop) - monitoring uptime + báo cáo cho đối tác" },
    { t: "Feature mới lớn tính CR riêng - phần C chỉ cover sửa lỗi, tinh chỉnh, bảo trì, vận hành hạ tầng", c: C.accent },
  ], { y: 5.55, fontSize: 12 });
}

// ---------- S8 Phuong an share-risk ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHƯƠNG ÁN KÊU GỌI & CHIA SẺ", "Chia doanh thu 24 tháng từ khách trả phí đầu tiên - sau đó chuyển cổ phần");
  table(s, [
    ["Tiêu chí", "PA-1: fund phần B (ưu tiên)", "PA-2: fund B + C"],
    ["Nhà đầu tư gánh (50%)", "~414 725 000 (50% phần B)", "~997 475 000 (50% của B+C)"],
    ["Dev gánh", "50% B + A sunk ~859.5M + tự gánh C ~1 166M + vận hành", "50% (B+C) + A sunk ~859.5M + vận hành"],
    ["Rev-share 24 tháng đầu", "Nhà đầu tư ~40% / dev ~60%", "Nhà đầu tư ~45% / dev ~55%"],
    ["Cổ phần sau kỳ rev-share", "~10-15%", "~15-20% (cam kết lớn hơn)"],
  ], { rowH: 0.55, fontSize: 11 });
  note(s, "Share-risk 50-50 về chi phí ở cả 2 phương án; dev giữ majority rev-share vì gánh sunk A + IP + toàn bộ công sức vận hành.", 6.45);
}

// ---------- S9 Dieu khoan + tom tat ----------
{
  const s = p.addSlide();
  slideTitle(s, "ĐIỀU KHOẢN & TÓM TẮT", "Con số chốt mang đi negotiate");
  table(s, [
    ["Mục", "Giá trị"],
    ["Tổng kinh phí dự án", "~2 854 450 000 VND (~2.85 tỷ)"],
    ["Đã đầu tư (sunk - sweat equity)", "~859.5M (30%) - T03/26 → 02/11/26"],
    ["PA-1 - kêu gọi trước tiên", "NĐT gánh 50% B ≈ ~414.7M → NĐT ~40% rev-share 2 năm + ~10-15% cổ phần sau 2029"],
    ["PA-2 - mở rộng", "NĐT gánh 50% (B+C) ≈ ~997.5M → NĐT ~45% rev-share 2 năm + ~15-20% cổ phần sau 2029"],
    ["Burn rate", "Build: 129M NS + ~8.1M infra /th · Maintain: 46.5M NS + ~9M infra /th"],
    ["Trạng thái sản phẩm", "Live production - 3 trường demo + 1 tenant trial khách thật - 20 module/4 suite - QA xanh"],
  ], { rowH: 0.48, fontSize: 11 });
  bullets(s, [
    { t: "Điều khoản bắt buộc: giải ngân theo milestone - phần A không hoàn/khấu trừ - clock doanh thu đếm từ khách paid đầu tiên (trễ thì dịch cửa sổ) - cổ phần vesting từ ngày ký - báo cáo burn hàng tháng + audit rights - IP thuộc bên phát triển - scale >5 trường thì review hạ tầng qua CR riêng", c: C.muted },
  ], { y: 5.4, fontSize: 11.5 });
}

mkdirSync("docs/handover", { recursive: true });
await p.writeFile({ fileName: "docs/handover/PROPOSAL-tong-dau-tu-2ty8.pptx" });
console.log("Written docs/handover/PROPOSAL-tong-dau-tu-2ty8.pptx");
