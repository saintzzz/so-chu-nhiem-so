/**
 * VIESCHOOL INTRO DECK - gioi thieu cong ty + san pham cho doi tac
 * (anh Tri + anh Dong - TVC360). 4 phan:
 *   I.   Dinh huong cong ty: su menh, tam nhin, gia tri cot loi,
 *        4 module core, hop tac, nen tang cong nghe.
 *   II.  Tinh nang theo 4 module chinh (khop SUITES trong src/lib/modules.ts).
 *   III. Tinh nang dang live tren production.
 *   IV.  Diem manh/yeu kien truc + roadmap khac phuc theo nguong.
 * Nguon: modules.ts SUITES, ARCH-1M-USERS.md, PROPOSAL-tong-dau-tu-2ty8.md,
 *        MO-TA-CHUC-NANG.md, CR-081-reconcile.md.
 * node scripts/gen-vieschool-intro-pptx.mjs -> docs/handover/VIESCHOOL-INTRO.pptx
 */
import PptxGenJS from "pptxgenjs";
import { mkdirSync } from "node:fs";

const p = new PptxGenJS();
p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
p.layout = "W";

const C = {
  ink: "0f172a", muted: "475569", accent: "0f766e", accentL: "ccfbf1",
  amber: "b45309", white: "ffffff", bg: "f8fafc", line: "e2e8f0", code: "1e293b",
  red: "b91c1c", green: "15803d", blue: "1d4ed8",
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
    items.flatMap((raw) => {
      const it = typeof raw === "object" ? raw : { t: raw };
      return [
        { text: String(it.t ?? ""), options: { bullet: { code: "2022", indent: 14 }, breakLine: true, bold: !!it.b, color: it.c ?? C.ink } },
        ...(it.sub ?? []).map((t) => ({ text: String(t), options: { bullet: { code: "2013", indent: 30 }, breakLine: true, color: C.muted, fontSize: fontSize - 1.5 } })),
      ];
    }),
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
function card(s, { x, y, w, h, title, body, color = C.accent }) {
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, width: 1 } });
  s.addShape(p.shapes.RECTANGLE, { x, y, w: 0.08, h, fill: { color }, line: { type: "none" } });
  s.addText(title, { x: x + 0.18, y: y + 0.08, w: w - 0.3, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color });
  s.addText(body, { x: x + 0.18, y: y + 0.5, w: w - 0.3, h: h - 0.6, fontFace: FONT, fontSize: 10.5, color: C.muted, valign: "top" });
}
function note(s, txt, y = 6.95) {
  s.addText(txt, { x: 0.7, y, w: 12, h: 0.45, fontFace: FONT, fontSize: 10.5, italic: true, color: C.accent });
}

// ============ S1 Cover ============
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addText("VieSchool", { x: 0.8, y: 1.6, w: 11.7, h: 1.1, fontFace: FONT, fontSize: 44, bold: true, color: C.white });
  s.addText("Nền tảng quản lý & chăm sóc học sinh cho trường phổ thông Việt Nam", {
    x: 0.8, y: 2.75, w: 11.7, h: 0.55, fontFace: FONT, fontSize: 17, color: "5eead4" });
  s.addText("Sổ Chủ Nhiệm Số (SCN) + TVC360 Studio - một codebase, hai sản phẩm thương mại", {
    x: 0.8, y: 3.4, w: 11.7, h: 0.45, fontFace: FONT, fontSize: 13.5, color: "94a3b8" });
  s.addText("Live: sochunhiem.vieschool.com · Bản giới thiệu cho đối tác · 10/2026", {
    x: 0.8, y: 4.0, w: 11.7, h: 0.45, fontFace: FONT, fontSize: 11.5, italic: true, color: "64748b" });
}

// ============ S2 Agenda ============
{
  const s = p.addSlide();
  slideTitle(s, "NỘI DUNG", "4 phần chính");
  const items = [
    ["I", "Định hướng công ty", "Chúng tôi là ai - sứ mệnh, tầm nhìn, giá trị cốt lõi, 4 module core business, hướng hợp tác anh Trí & anh Đông, nền tảng công nghệ"],
    ["II", "Tính năng theo 4 module chính", "Quản lý nhà trường · Chăm sóc PH & HS · Dịch vụ giảng dạy · Báo cáo & dashboard"],
    ["III", "Tính năng đang live", "Những gì đang chạy production hôm nay - không phải roadmap"],
    ["IV", "Đánh giá kiến trúc", "Điểm mạnh, điểm yếu, cần làm gì để khắc phục và khi nào nên làm"],
  ];
  items.forEach(([n, t, d], i) => {
    card(s, { x: 0.7, y: 1.95 + i * 1.2, w: 11.9, h: 1.05, title: `${n}. ${t}`, body: d });
  });
}

// ============ PHAN I ============
// ============ S3 Chung toi la ai ============
{
  const s = p.addSlide();
  slideTitle(s, "I. ĐỊNH HƯỚNG", "VieSchool là ai");
  bullets(s, [
    { t: "Đội phát triển sản phẩm giáo dục Việt Nam - build nhanh, chuẩn quy định, kiểm chứng được", b: true },
    { t: "Hai sản phẩm trên một codebase multi-tenant:", b: true },
    { t: "Sổ Chủ Nhiệm Số (SCN) - nền tảng quản lý trường học: chủ nhiệm, điểm, hạnh kiểm, tài chính, tuyển sinh, y tế, thư viện, văn thư...", sub: [] },
    { t: "TVC360 Studio - bộ công cụ giáo viên: ngân hàng câu hỏi, giáo án điện tử KHBĐ CV 5512, export DOCX/PPTX, TTS audio", sub: [] },
    { t: "Đã đầu tư ~794M VND (7.5 tháng, T03-10/2026) - sản phẩm live production, không phải bản vẽ", c: C.accent },
    { t: "3 trường demo chạy thật trên sochunhiem.vieschool.com - self-service onboarding", c: C.accent },
  ]);
}

// ============ S4 Su menh / Tam nhin / Gia tri ============
{
  const s = p.addSlide();
  slideTitle(s, "I. ĐỊNH HƯỚNG", "Sứ mệnh - Tầm nhìn - Giá trị cốt lõi");
  card(s, { x: 0.7, y: 1.95, w: 5.85, h: 4.8, title: "SỨ MỆNH", body: "Số hóa công tác quản lý và chăm sóc học sinh cho trường phổ thông Việt Nam.\n\nThay sổ sách giấy bằng quy trình số: điểm danh, sổ đầu bài, sổ điểm, học bạ, liên lạc phụ huynh - một dữ liệu chung, đồng bộ thời gian thực.\n\nGiảm giấy tờ cho giáo viên để họ dạy - đó là mục tiêu đo được.", color: C.accent });
  card(s, { x: 6.75, y: 1.95, w: 5.85, h: 4.8, title: "TẦM NHÌN", body: "1 triệu người dùng (HS + GV + PH) trên 500-1,000 trường.\n\nTrở thành lớp dữ liệu chuẩn cho giáo dục phổ thông: học bạ XML QĐ 3016, điểm TT22/2021, BHYT học sinh - sẵn sàng kết nối Sở GD&ĐT và dịch vụ công (VNeID).\n\nBán theo gói module - trường mua phần mình cần.", color: C.blue });
  s.addText("GIÁ TRỊ CỐT LÕI", { x: 0.7, y: 6.85, w: 2.4, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.ink });
  const vals = [
    "Một sự thật nghiệp vụ ghi một nơi - đồng bộ mọi màn hình liên quan",
    "Chuẩn quy định Việt Nam (TT22, QĐ 3016, BHYT) - không dịch lại quy trình nước ngoài",
    "Tách biệt dữ liệu trường ở tầng DB (RLS) - không phụ thuộc code cẩn thận",
    "AI có fallback - nghiệp vụ không bao giờ đứng vì AI lỗi",
  ];
  s.addText(vals.map((v) => ({ text: v, options: { bullet: { code: "2022", indent: 12 }, breakLine: true } })),
    { x: 2.6, y: 6.83, w: 10, h: 0.6, fontFace: FONT, fontSize: 10, color: C.muted, paraSpaceAfter: 2 });
}

// ============ S5 Core business 4 modules ============
{
  const s = p.addSlide();
  slideTitle(s, "I. ĐỊNH HƯỚNG", "Core business - 4 gói module bán được (đã mã hóa trong sản phẩm)",
    "Sản phẩm đã packaging thành 4 suite trong code (school_features) - trường bật gói nào dùng gói đó");
  const mods = [
    ["1", "QUẢN LÝ TRƯỜNG & HÀNH CHÍNH", "12 module: tuyển sinh, khoản thu + thanh toán, biến động HS, học bạ số + XML ký số, xét tốt nghiệp, chuyên cần, điều động, y tế-BHYT, văn thư, thư viện, bữa ăn bán trú, vận hành nâng cao", C.accent],
    ["2", "CHĂM SÓC PH & HS", "Portal PH-HS, thông báo đa kênh (email nay, Zalo/SMS sẵn sàng), CRM tuyển sinh public (cổng apply + tra cứu = thu hút tuyển sinh mới), tư vấn & an toàn, thi đua", C.blue],
    ["3", "DỊCH VỤ GIẢNG DẠY (TVC360)", "Ngân hàng 21k+ câu hỏi chuẩn YCCĐ, giáo án KHBĐ CV 5512, lập kế hoạch giảng dạy, bài trắc nghiệm online chấm tự động, export DOCX/PPTX, TTS audio, AI soạn đề", C.amber],
    ["4", "BÁO CÁO, DASHBOARD & TÍCH HỢP", "Dashboard BGH/Sở GD/UBND, báo cáo tài chính, integration framework (connector + outbox), học bạ XML QĐ 3016 ký số, VNeID-ready, API webhook", C.green],
  ];
  mods.forEach(([n, t, d, c], i) => {
    card(s, { x: 0.7 + (i % 2) * 6.1, y: 2.15 + Math.floor(i / 2) * 2.4, w: 5.85, h: 2.2, title: `${n}. ${t}`, body: d, color: c });
  });
  note(s, "Khớp 1-1 với SUITES trong src/lib/modules.ts - gói nào cũng bật/tắt được theo từng trường trong /dept/modules");
}

// ============ S6 Hop tac anh Tri + anh Dong ============
{
  const s = p.addSlide();
  slideTitle(s, "I. ĐỊNH HƯỚNG", "Hướng hợp tác với anh Trí & anh Đông (TVC360)",
    "TVC360 requirement nhận 04/09/2026 - đã build xong và chạy trong production như suite /studio của SCN");
  table(s, [
    ["Khía cạnh", "Định hướng"],
    ["Sản phẩm", "TVC360 giữ standalone về tính năng - đồng thời bán kèm như module 'Dịch vụ giảng dạy' trong SCN. Một codebase, hai gói thương mại."],
    ["Phân công", "Đội phát triển: build + vận hành + IP codebase. Đối tác: thị trường, quan hệ trường/Sở, ký hợp đồng, định giá bán."],
    ["Tài chính", "Share-risk 50-50 trên phần chi phí kêu gọi (không phải chia doanh thu 50-50). Ưu tiên phần B - 5.5 tháng phát triển tới T03/2027 (~415M phía nhà đầu tư). Phần A ~794M là sweat equity đội dev - không hoàn, không khấu trừ."],
    ["Chia sẻ", "T03/2027-T03/2029: chia doanh thu (đề xuất NĐT ~40% / dev ~60%). Sau T03/2029: chuyển chia cổ phần (~10-15%, vesting từ ngày ký)."],
    ["Điều khoản", "Giải ngân theo milestone kiểm chứng được; clock doanh thu đếm từ khách trả phí đầu tiên; IP codebase thuộc đội phát triển; audit rights cho phần giải ngân."],
  ], { fontSize: 10.5, rowH: 0.62, y: 1.95 });
  note(s, "Chi tiết số liệu: docs/handover/PROPOSAL-tong-dau-tu-2ty8.md - tổng ~2.79 tỷ gồm sunk A + phát triển B + maintain C");
}

// ============ S7 Nen tang cong nghe ============
{
  const s = p.addSlide();
  slideTitle(s, "I. ĐỊNH HƯỚNG", "Nền tảng công nghệ - đang dùng và lựa chọn");
  table(s, [
    ["Tầng", "Đang dùng", "Ghi chú chiến lược"],
    ["Ứng dụng web", "Next.js 16 + React 19 + TypeScript strict", "148 routes, App Router, render server-side"],
    ["CSDL + Auth", "Supabase Postgres (RLS ~350 policies)", "Postgres chuẩn - di chuyển được sang Azure Database for PostgreSQL / Google Cloud SQL; không lock-in cứng (trừ Auth/Storage)"],
    ["Hosting", "Vercel (push master -> production)", "Stateless, scale ngang theo request"],
    ["AI", "Gemini / OpenAI / Anthropic multi-key + Devin fallback", "Không phụ thuộc 1 vendor; quota lỗi tự chuyển"],
    ["Email/Webhook", "Resend + SePay + Vercel cron", "Zalo OA/SMS: hạ tầng sẵn, chờ credentials"],
    ["Microsoft", "Cân nhắc: Entra ID SSO cho Sở GD, Power BI trên read replica, Azure PostgreSQL nếu rời Supabase", "Chưa cần ở quy mô hiện tại - chuẩn bị sẵn đường thoát"],
    ["Google", "Gemini AI (đang dùng), BigQuery cho analytics xuyên trường (Phase C), Google Workspace SSO cho trường", "Analytics tách khỏi OLTP khi >100 trường"],
  ], { fontSize: 10, rowH: 0.56, y: 1.9 });
  note(s, "Khuyến nghị: GIỮ stack hiện tại - chi phí demo ~1 triệu/tháng. Postgres chuẩn nên chuyển Azure/GCP được khi có lý do thật (không migrate sớm vì tốn effort không sinh giá trị).");
}

// ============ PHAN II ============
// ============ S8 Module map overview ============
{
  const s = p.addSlide();
  slideTitle(s, "II. 4 MODULE CHÍNH", "Toàn cảnh - module nào trả lời câu hỏi nào");
  table(s, [
    ["Câu hỏi kinh doanh", "Module trả lời", "Người mua"],
    ["Trường vận hành hành chính ra sao?", "Quản lý trường & hành chính", "Hiệu trưởng, văn thư, kế toán"],
    ["Giữ chân & thu hút PH-HS thế nào?", "Chăm sóc PH & HS", "Hiệu trưởng, phòng tuyển sinh"],
    ["Giáo viên soạn/dạy/đánh giá ra sao?", "Dịch vụ giảng dạy (TVC360)", "Tổ trưởng, giáo viên"],
    ["Lãnh đạo nhìn số liệu thế nào?", "Báo cáo, dashboard & tích hợp", "BGH, Sở GD&ĐT, UBND"],
  ], { fontSize: 11.5, rowH: 0.6, y: 2.1 });
  note(s, "Mỗi module = một dòng doanh thu độc lập - trường có thể mua lẻ, nâng cấp dần");
}

// ============ S9 Module 1 Quan ly truong ============
{
  const s = p.addSlide();
  slideTitle(s, "II. MODULE 1/4", "Quản lý trường & hành chính (12 module con)");
  bullets(s, [
    { t: "Vận hành năm học: tuyển sinh đầu cấp (xét tuyển + thi tuyển khối 6/10), biến động HS (chuyển đến/đi/bảo lưu), xét tốt nghiệp", b: true },
    { t: "Sổ sách lõi: học bạ số TT22 (HK1/HK2/cả năm, quyết định cuối năm, export DOCX/PDF có watermark), XML QĐ 3016 ký số 2 cấp, sổ chủ nhiệm, chuyên cần", b: true },
    { t: "Tài chính: khoản thu theo kỳ, hóa đơn + biên lai, VietQR thanh toán, SePay webhook đối soát tự động, e-invoice skeleton", b: true },
    { t: "Hành chính - dịch vụ: văn thư & công văn, thư viện (danh mục + ĐKCB + mượn/trả), y tế & BHYT, bữa ăn bán trú, CSVC & sự cố thiết bị, điều động giáo viên", b: true },
    { t: "RBAC 11 vai trò + multi-campus: PHT chỉ thấy cơ sở mình phụ trách - mọi quyền chốt ở DB không chỉ UI", c: C.accent },
  ]);
  note(s, "Bán theo gói trong /dept/modules - trường bật module nào dùng module đó, tắt hẳn cả menu");
}

// ============ S10 Module 2 Cham soc PH-HS ============
{
  const s = p.addSlide();
  slideTitle(s, "II. MODULE 2/4", "Chăm sóc PH & HS - giữ chân + thu hút");
  bullets(s, [
    { t: "Cổng phụ huynh & học sinh: điểm, hạnh kiểm, TKB, thông báo, tin nhắn 2 chiều với GVCN, lịch hẹn, đăng ký hoạt động", b: true },
    { t: "Thông báo đa kênh: email qua Resend (đang chạy) + comm_outbox chuẩn Zalo OA/ZNS + SMS (hạ tầng sẵn, chờ credentials đối tác)", b: true },
    { t: "Digest tuần tự động: parent-digest cron gửi tổng hợp cho PH", b: true },
    { t: "Tuyển sinh = kênh acquisition: cổng /apply public - PH đăng ký + tra cứu online, không cần tài khoản (omnichannel marketing: trường quảng bá, PH vào portal)", b: true, c: C.amber },
    { t: "Tư vấn & an toàn học đường: intake tư vấn, sự cố an toàn, follow-up; thi đua & danh hiệu", b: true },
    { t: "Consent + opt-out theo kênh - tôn trọng dữ liệu PH", c: C.accent },
  ]);
  note(s, "Roadmap: Zalo/SMS bật ngay khi có OA approval + keys; CRM funnel tuyển sinh đã có sẵn nền");
}

// ============ S11 Module 3 Dich vu giang day ============
{
  const s = p.addSlide();
  slideTitle(s, "II. MODULE 3/4", "Dịch vụ giảng dạy - TVC360 Studio + LMS-lite");
  bullets(s, [
    { t: "Ngân hàng câu hỏi: 21k+ câu phủ 81/81 YCCĐ chuẩn Bộ GD, duyệt 2 lớp (tổ -> BGH), public/private scope, media + passage", b: true },
    { t: "Giáo án & KHBĐ: mẫu CV 5512, soạn bài + AI hỗ trợ, duyệt tổ chuyên môn, tài liệu đính kèm", b: true },
    { t: "LMS-lite: HS làm bài trắc nghiệm trực tuyến, chấm tự động, session theo lớp", b: true },
    { t: "Export thật: DOCX/PPTX đề thi + giáo án; TTS audio đa provider (OpenAI/edge/Gemini fallback)", b: true },
    { t: "Kỳ thi & đánh giá: cấu trúc đề, điểm thi, phân tích; tổ chuyên môn (dự giờ, đánh giá NLGV)", b: true },
    { t: "AI thực dụng: multi-key fallback, PII redaction, hedged race cho tài liệu dài - không block nghiệp vụ khi AI lỗi", c: C.accent },
  ]);
}

// ============ S12 Module 4 Bao cao ============
{
  const s = p.addSlide();
  slideTitle(s, "II. MODULE 4/4", "Báo cáo, dashboard & tích hợp");
  bullets(s, [
    { t: "Dashboard theo cấp: GVCN (lớp), BGH (trường), PHT (cơ sở), Sở GD & UBND (địa bàn, read-only)", b: true },
    { t: "Báo cáo nghiệp vụ: tài chính (thu/chi, công nợ), chuyên cần, thi đua, thống kê theo năm học", b: true },
    { t: "Integration framework: int_connectors + int_outbox + int_inbox - chuẩn bị cho QĐ 3016, payment, dịch vụ công", b: true },
    { t: "Đã nối: SePay webhook (đối soát bank txn), VietQR, e-invoice skeleton, học bạ XML export, VNeID prep (cột sẵn)", b: true },
    { t: "AI advisor: dept brief, radar cảnh báo, phân tích điểm - hỗ trợ ra quyết định không thay quyết định", c: C.accent },
  ]);
  note(s, "Data warehouse BigQuery cho analytics xuyên trường - roadmap Phase C, không dội vào DB vận hành");
}

// ============ PHAN III ============
// ============ S13 Live features ============
{
  const s = p.addSlide();
  slideTitle(s, "III. ĐANG LIVE", "Chạy production hôm nay - sochunhiem.vieschool.com",
    "Không phải roadmap - tất cả đều demo được ngay với tài khoản demo");
  table(s, [
    ["Nhóm", "Đang live"],
    ["Nền tảng", "Multi-tenant 3 trường, 11 vai trò + kiêm nhiệm, RLS ~350 policies, module flags per trường, audit log + notifications, self-service onboarding"],
    ["Chủ nhiệm & học tập", "Điểm danh ngày + tiết, sổ đầu bài, sổ điểm TT22 (HK1/HK2/CN), hạnh kiểm, NLPC, học bạ số + quyết định cuối năm + lock/sign-off, export DOCX/PDF"],
    ["Sắp xếp & nhân sự", "TKB editor + copy + view theo GV + CSV export, điều động, phân công, tổ chuyên môn, hồ sơ cán bộ"],
    ["Tài chính", "Khoản thu, hóa đơn, biên lai, VietQR, SePay webhook, báo cáo tài chính"],
    ["Tuyển sinh & comms", "Cổng apply public + tra cứu, thông báo email, comm outbox (Zalo/SMS ready), parent digest"],
    ["Giảng dạy (TVC360)", "Ngân hàng 21k+ CH, KHBĐ CV 5512, giáo án, LMS bài trắc nghiệm chấm tự động, TTS, export DOCX/PPTX"],
    ["Dịch vụ trường", "Thư viện, y tế & BHYT, văn thư, bữa ăn bán trú, CSVC/sự cố, học bạ XML ký số"],
    ["Cấp trên", "Dashboard Sở GD + UBND read-only, dept modules, báo cáo địa bàn"],
  ], { fontSize: 10, rowH: 0.52, y: 1.9 });
}

// ============ S14 So lieu chung minh ============
{
  const s = p.addSlide();
  slideTitle(s, "III. ĐANG LIVE", "Con số minh chứng chất lượng");
  const stats = [
    ["148", "routes production", C.accent],
    ["~450", "automated tests (446/446 pass)", C.blue],
    ["~350", "RLS policies enforce tenant", C.accent],
    ["21k+", "câu hỏi ngân hàng chuẩn YCCĐ", C.amber],
    ["11", "vai trò + kiêm nhiệm", C.blue],
    ["3", "trường demo chạy thật", C.green],
    ["95+", "ACs có test coverage (RTM)", C.accent],
    ["82", "CRs đã merge (CR-001..081)", C.blue],
  ];
  stats.forEach(([n, t, c], i) => {
    const x = 0.7 + (i % 4) * 3.05, y = 2.1 + Math.floor(i / 4) * 2.1;
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.85, h: 1.85, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, width: 1 } });
    s.addText(n, { x, y: y + 0.15, w: 2.85, h: 0.9, align: "center", fontFace: FONT, fontSize: 34, bold: true, color: c });
    s.addText(t, { x: x + 0.15, y: y + 1.1, w: 2.55, h: 0.65, align: "center", fontFace: FONT, fontSize: 10.5, color: C.muted });
  });
  note(s, "Chuỗi quality gates chạy mỗi commit: typecheck, lint, build, 446 tests, consistency, reliability, RTM, repo-laws, UIUX, spec, Vercel config");
}

// ============ PHAN IV ============
// ============ S15 Diem manh ============
{
  const s = p.addSlide();
  slideTitle(s, "IV. KIẾN TRÚC", "Điểm mạnh - những gì đang đúng");
  bullets(s, [
    { t: "Multi-tenant đúng nghĩa: school_id trên mọi bảng + RLS ~350 policies - tenant isolation ở DB, không trông cậy vào code cẩn thận", b: true },
    { t: "Packaging thành sản phẩm sẵn: module flags per trường + 4 suite bán được - go-to-market không cần code thêm", b: true },
    { t: "RBAC 3 tầng đồng nhất: UI nav <-> server action <-> RLS; kiểm chứng tự động bằng checker (nav-access, consistency)", b: true },
    { t: "AI async có fallback: ai_jobs + Devin callback - nghiệp vụ không đứng khi AI hết quota/lỗi", b: true },
    { t: "Nghiệp vụ nguyên tử: RPC security-definer cho tiền (fee_record_transfer), CAS cho status transitions - không race", b: true },
    { t: "Quality gates tự động: 446 tests + RTM 95+ ACs + scanners (reliability, raw-error echo, unbounded read) mỗi commit", b: true },
    { t: "Chi phí vận hành thấp: ~1 triệu/tháng ở demo scale - margin tốt khi bán", b: true, c: C.accent },
    { t: "Deploy đơn giản: push master -> Vercel production < 5 phút; migrations idempotent, replay-safe", b: true },
  ]);
}

// ============ S16 Diem yeu ============
{
  const s = p.addSlide();
  slideTitle(s, "IV. KIẾN TRÚC", "Điểm yếu - đánh giá thẳng (kèm mức độ nghiêm trọng)");
  table(s, [
    ["Điểm yếu", "Ảnh hưởng", "Mức độ"],
    ["Supabase compute Micro (free/small tier)", "Statement timeout khi load cao - đã thấy trong QA", "Cao - chặn trường thật"],
    ["Single Postgres project", "Row growth (attendance ~180M/năm), RLS cost, connection limit", "Trung-cao - nút thắt thật ở scale"],
    ["Monolith 1 codebase/1 deploy", "Blast radius khi bug; public surface (/apply) chung với app nhân viên", "Trung"],
    ["Export/AI job dài trên Vercel function", "Function duration limit - job nặng nên qua queue worker", "Trung"],
    ["Credentials ngoài chưa có (SePay, Zalo OA, e-invoice, CA ký số)", "Feature sẵn sàng nhưng chưa chạy thật", "Chặn go-live các module đó"],
    ["Secrets/ops thủ công, chưa có IaC đầy đủ", "Onboard trường mới còn tay", "Thấp-trung"],
    ["Chưa có observability chuẩn (Sentry/metrics)", "Khó debug production khi scale", "Trung - làm sớm"],
  ], { fontSize: 10, rowH: 0.55, y: 1.9 });
  note(s, "Kết luận Tech Lead: nút thắt là Postgres (row volume + RLS + connections), KHÔNG phải Next.js - microservice theo domain không chạm nút thắt này");
}

// ============ S17 Roadmap khac phuc ============
{
  const s = p.addSlide();
  slideTitle(s, "IV. KIẾN TRÚC", "Roadmap khắc phục - theo ngưỡng trường (trả tiền khi cần, không trả trước)");
  table(s, [
    ["Ngưỡng", "Làm gì", "Khi nào"],
    ["Nay -> ~15 trường", "Supabase Pro + compute Small->Large; PITR backup; partition attendance/audit/notifications theo tháng; Supavisor pooling; Sentry + metrics; monorepo restructure (pnpm/turbo, ~2-3 ngày, không đổi deploy)", "NGAY khi trường pilot vào - bắt buộc"],
    ["15 -> 100 trường", "Tách apps/public (cổng tuyển sinh deploy riêng, cách ly burst + attack surface); read replica cho báo cáo; worker export/notify thành service riêng (queue); cache module-flags/profile edge KV", "Khi có ~15 trường trả phí"],
    ["100 -> 1,000 trường (~1M users)", "TENANT SHARDING: nhiều Supabase project theo cụm trường (~100-200 trường/cụm) + control-plane map school->cluster; compute nặng ra container (Fly/ECS); data warehouse BigQuery cho analytics; archive năm cũ", "Khi ~100 trường / ~200k users"],
    [">1M hoặc team >15 dev", "Mới tách microservice theo domain - lúc đó monorepo + packages/domain đã sẵn sàng", "Chỉ khi chứng minh cần - không trả tiền trước"],
  ], { fontSize: 10, rowH: 0.95, y: 1.95 });
  note(s, "Chi tiết: docs/project/ARCH-1M-USERS.md - 'modular monolith + worker theo tải + shard theo cụm trường' = 80% lợi ích microservice với 20% chi phí");
}

// ============ S18 Khong lam / Khuyen nghi ============
{
  const s = p.addSlide();
  slideTitle(s, "IV. KIẾN TRÚC", "Sẽ KHÔNG làm - và khuyến nghị hành động");
  s.addText("KHÔNG LÀM (tránh lãng phí)", { x: 0.7, y: 1.9, w: 5.8, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.red });
  bullets(s, [
    "Microservice theo domain sớm - DB vẫn nghẽn, thêm distributed txn",
    "Kubernetes - độ phức tạp vượt quy mô team",
    "Schema-per-school - phá migration sync",
    "Migrate sang Azure/GCP ngay - Postgres chuẩn nên thoát được khi cần, không cần trả tiền sớm",
    "Event sourcing / multi-master - overkill cho nghiệp vụ trường học",
  ], { x: 0.7, y: 2.3, w: 5.8, h: 4.4, fontSize: 11 });
  s.addText("CẦN QUYẾT ĐỊNH (đề xuất phê duyệt)", { x: 6.8, y: 1.9, w: 5.8, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.green });
  bullets(s, [
    { t: "Nâng Supabase Pro + compute Small ngay khi trường pilot vào (~2.5 triệu/tháng) - bắt buộc", c: C.green },
    "Monorepo restructure làm CR riêng (~2-3 ngày effort)",
    "Tách apps/public khi mở tuyển sinh cho trường thật (~15 trường)",
    "Credentials: SePay key, Zalo OA approval, CA ký số, e-invoice vendor - cần để go-live module thanh toán/thông báo",
    "Observability: Sentry + metrics + alert queue depth - làm trong Phase A",
  ], { x: 6.8, y: 2.3, w: 5.8, h: 4.4, fontSize: 11 });
}

// ============ S19 Close ============
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addText("Sản phẩm đã chạy - demo ngay hôm nay", {
    x: 0.8, y: 2.3, w: 11.7, h: 0.9, fontFace: FONT, fontSize: 30, bold: true, color: C.white });
  s.addText("sochunhiem.vieschool.com · tài khoản demo đầy đủ vai trò (demo1234)", {
    x: 0.8, y: 3.3, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 15, color: "5eead4" });
  s.addText("Tài liệu kèm: PROPOSAL-tong-dau-tu-2ty8 (deal) · ARCH-1M-USERS (kiến trúc) · MO-TA-CHUC-NANG (tính năng) · HUONG-DAN-SU-DUNG (user guide)", {
    x: 0.8, y: 4.0, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 12, color: "94a3b8" });
}

mkdirSync("docs/handover", { recursive: true });
await p.writeFile({ fileName: "docs/handover/VIESCHOOL-INTRO.pptx" });
console.log("wrote docs/handover/VIESCHOOL-INTRO.pptx -", p._slides.length, "slides");
