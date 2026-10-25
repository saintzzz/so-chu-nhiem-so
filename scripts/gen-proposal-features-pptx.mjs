/**
 * PROPOSAL gioi thieu tinh nang - So Chu Nhiem So + Studio TVC360.
 * Deck ban hang cho truong/doi tac: nghiep vu that, so lieu that, khong
 * mockup. Nguon: docs/user-guide/MO-TA-CHUC-NANG.md (v2.1, 23/10/2026).
 * Style: cung design tokens voi gen-proposal-investment-pptx.mjs.
 * node scripts/gen-proposal-features-pptx.mjs -> docs/handover/PROPOSAL-gioi-thieu-tinh-nang.pptx
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
      { text: String(it.t ?? it), options: { bullet: { code: "2022", indent: 14 }, breakLine: true, bold: !!it.b, color: it.c ?? C.ink } },
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
  s.addText("SỔ CHỦ NHIỆM SỐ", {
    x: 0.8, y: 1.9, w: 11.7, h: 1, fontFace: FONT, fontSize: 40, bold: true, color: C.white,
  });
  s.addText("Nền tảng số hóa công tác chủ nhiệm và quản lý trường học - kèm Studio TVC360 soạn học liệu", {
    x: 0.8, y: 2.95, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 16, color: "5eead4",
  });
  s.addText("Thay thế sổ chủ nhiệm giấy bằng quy trình nghiệp vụ số đồng bộ thời gian thực - Tiểu học, THCS, THPT, kể cả mô hình nhiều cơ sở", {
    x: 0.8, y: 3.65, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 13, color: "94a3b8" });
  s.addText("Live production: sochunhiem.vieschool.com - sản phẩm đang chạy, không phải bản demo tĩnh", {
    x: 0.8, y: 4.25, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 11.5, italic: true, color: "64748b" });
  s.addText("VieSchool · 24/10/2026", {
    x: 0.8, y: 6.6, w: 11.7, h: 0.4, fontFace: FONT, fontSize: 11, color: "64748b" });
}

// ---------- S2 Bai toan ----------
{
  const s = p.addSlide();
  slideTitle(s, "BÀI TOÁN", "Công tác chủ nhiệm đang nằm trên giấy - rời rạc, chậm, khó kiểm soát");
  table(s, [
    ["Hiện trạng phổ biến", "Hệ quả"],
    ["Sổ chủ nhiệm, sổ đầu bài, sổ điểm giấy", "Mất sổ, sai lệch, cuối năm ngồi tổng hợp học bạ thủ công"],
    ["Điểm danh / vắng học ghi rời từng cuốn", "BGH và phụ huynh không nắm được tình hình kịp thời"],
    ["Liên lạc phụ huynh qua giấy mời / điện thoại", "Không lưu vết, không đo được, PH không chủ động"],
    ["Báo cáo Sở/Phòng tổng hợp Excel tay", "Số liệu trễ, dễ sai, tốn nhân lực mỗi đợt"],
    ["Soạn giáo án, ma trận, đề thi làm tay", "GV mất hàng giờ mỗi tuần cho việc không phải dạy"],
  ], { fontSize: 12, rowH: 0.6 });
  bullets(s, [
    { t: "Một sự thật nghiệp vụ chỉ ghi một nơi - đồng bộ sang mọi màn hình liên quan (vắng trong sổ đầu bài tự cập nhật điểm danh ngày, báo cáo, thông báo PH)", c: C.accent, b: true },
  ], { y: 5.6, fontSize: 12.5 });
}

// ---------- S3 Tong quan nen tang ----------
{
  const s = p.addSlide();
  slideTitle(s, "TỔNG QUAN", "2 hệ thống trong 1 nền tảng - dữ liệu chung, phân quyền sâu");
  table(s, [
    ["Thành phần", "Phạm vi"],
    ["Sổ Chủ Nhiệm Số", "Chuyên cần - sổ đầu bài - sổ điểm TT22 - rèn luyện - tư vấn - liên lạc PH - hoạt động giáo dục - an toàn HS - thi đua - học bạ số - báo cáo cấp trên"],
    ["Studio TVC360", "Soạn học liệu theo CTGDPT 2018: KHBĐ CV 5512, ma trận, đề kiểm tra, bộ câu hỏi, phiếu học tập, bài trình chiếu - gắn ngân hàng câu hỏi YCCĐ của trường"],
    ["Portal phụ huynh", "Thông báo lớp, tin nhắn GVCN 2 chiều, đặt lịch hẹn, đăng ký hoạt động, xem điểm/chuyên cần của con"],
    ["Portal học sinh", "TKB, điểm, hạnh kiểm, thông báo, học bạ bản thân"],
    ["Cấp Sở/Phòng/UBND", "Dashboard tổng hợp các trường, bản tin AI, kiểm tra toàn vẹn dữ liệu"],
  ], { fontSize: 11.5, rowH: 0.62 });
  note(s, "Một tài khoản - một nguồn dữ liệu - phân quyền đến từng hàng dữ liệu (Row-Level Security)");
}

// ---------- S4 Vai tro ----------
{
  const s = p.addSlide();
  slideTitle(s, "VAI TRÒ", "11 vai trò đúng mô hình trường Việt Nam - kể cả kiêm nhiệm");
  table(s, [
    ["Vai trò", "Phạm vi dữ liệu"],
    ["GVCN", "Lớp chủ nhiệm: đủ nghiệp vụ chủ nhiệm + môn mình dạy"],
    ["GVBM", "Điểm lớp được phân công, lịch cá nhân, giáo án"],
    ["Tổ trưởng chuyên môn", "Duyệt giáo án/câu hỏi, đánh giá năng lực trong tổ"],
    ["BGH / PHT", "Toàn trường / cơ sở phụ trách: duyệt, TKB, radar, AI"],
    ["Kế toán", "Nhân sự, đánh giá cơ sở vật chất TT15"],
    ["Sở GD&ĐT / UBND", "Tổng hợp đơn vị, quản trị người dùng (read-only)"],
    ["Phụ huynh / Học sinh", "Chỉ con mình / chỉ bản thân"],
  ], { fontSize: 10.5, rowH: 0.42 });
  bullets(s, [
    { t: "Kiêm nhiệm thật: GVCN kiêm dạy môn, tổ trưởng đứng lớp - quyền = hợp vai trò, deny thắng xung đột", c: C.accent },
    { t: "Enforce 3 tầng: giao diện (menu theo quyền) - server action (checkActionRole) - database (RLS my_roles())" },
  ], { y: 5.85, fontSize: 11.5 });
}

// ---------- S5 Nghiep vu GVCN ----------
{
  const s = p.addSlide();
  slideTitle(s, "NGHIỆP VỤ GVCN", "Chu trình chủ nhiệm đầy đủ - từ điểm danh sáng đến học bạ cuối năm");
  table(s, [
    ["Module", "Điểm nổi bật"],
    ["Chuyên cần", "Điểm danh 4 trạng thái, chọn ngày bất kỳ sửa lại; sổ vắng/muộn theo khoảng ngày; thông báo PH tự động; ma trận HS × ngày phát hiện vắng liên tục"],
    ["Sổ điểm TT22/2021", "Cột động Miệng/15p/1 tiết (HS1), ĐĐGgk (HS2), ĐĐGck (HS3); ĐTBm tự tính đúng công thức; riêng HK1/HK2/cả năm; môn nhận xét hiện Đạt/Chưa đạt; import/export Excel"],
    ["Sổ đầu bài", "3 trường riêng (bài học/nội dung/nhận xét), đánh dấu vắng từng em, +/− điểm rèn luyện ngay trong form; lưu đồng bộ attendance_records; AI tóm tắt tuần"],
    ["Rèn luyện", "Nhận xét/khen thưởng/vi phạm cộng trừ điểm từng em; xếp loại hạnh kiểm học kỳ; kênh chat riêng với HS"],
    ["Tư vấn học sinh", "Quy trình Tiếp nhận → Đánh giá (AI gợi ý mức) → Chuyển tuyến; trạng thái ca đầy đủ"],
    ["Phụ huynh", "Thông báo lớp/từng em (in-app + email), hộp thư 2 chiều, lịch hẹn xác nhận/từ chối, ban đại diện CMHS"],
  ], { fontSize: 10.5, rowH: 0.72 });
}

// ---------- S6 So chu nhiem + hoc ba ----------
{
  const s = p.addSlide();
  slideTitle(s, "SỔ CHỦ NHIỆM SỐ & HỌC BẠ", "Kết quả cuối cùng của công tác chủ nhiệm - số hóa hết");
  bullets(s, [
    { t: "Roster thông minh", b: true, sub: ["Chia tổ tự động, gán Ban cán sự 4 chức danh, tạo + liên kết phụ huynh"] },
    { t: "Sơ đồ lớp kéo-thả", b: true, sub: ["Thêm/bớt hàng (2-10) cột (2-12) giữ vị trí HS khi resize; lưu + khôi phục nhiều phiên bản"] },
    { t: "Kế hoạch & chỉ tiêu", b: true, sub: ["Lịch năm học (tay/CSV), AI gợi ý công việc theo tuần/tháng, checklist tháng, sơ kết tuần, đăng ký KPI lớp"] },
    { t: "Học bạ số", b: true, sub: ["Điểm HK1/HK2/CN, hạnh kiểm, NLPC, chuyên cần buổi; quyết định cuối năm gợi ý tự động theo TT22 (override bắt buộc căn cứ Điều 9.3)"] },
    { t: "Workflow duyệt 2 lớp", b: true, sub: ["GVCN lưu nháp/trình → BGH duyệt/trả lại kèm lý do → khóa qua đợt duyệt sổ; xuất DOCX/PDF từng HS hoặc cả lớp, watermark BẢN NHÁP khi chưa duyệt"] },
    { t: "Audit & xuất", b: true, sub: ["Audit log actor/action/entity/payload mọi thao tác; export CSV toàn bộ dữ liệu sổ"] },
  ], { fontSize: 13, gap: 6 });
}

// ---------- S7 Quan tri truong ----------
{
  const s = p.addSlide();
  slideTitle(s, "QUẢN TRỊ TRƯỜNG (BGH/PHT)", "Điều hành trên số liệu thật - không chờ báo cáo cuối tuần");
  table(s, [
    ["Chức năng", "Mô tả"],
    ["Dashboard cấp trường", "Chuyên cần/học tập/sự cố/cảnh báo toàn trường theo ngày gần nhất có dữ liệu"],
    ["Radar cảnh báo sớm", "Chấm điểm rủi ro HS/lớp (học tập, chuyên cần, tâm lý, an toàn, bỏ học); AI đề xuất can thiệp; workflow tiếp nhận - đóng"],
    ["Trung tâm phê duyệt", "Hàng chờ hoạt động giáo dục, đơn từ các bộ phận - duyệt/từ chối một nơi"],
    ["Trợ lý điều hành (AI)", "Chat hỏi-đáp trên số liệu thật: phê duyệt, sự cố, chuyên cần, cảnh báo"],
    ["Điều động dạy thay", "Phân công GV dạy thay khi GV vắng"],
    ["TKB toàn trường", "Import Excel/template, phân công năm học, điều động; PHT chỉ thấy campus mình"],
    ["Đánh giá TT15", "Cơ sở vật chất theo 5 nhóm tiêu chuẩn, /100, mức 1-4; quản lý phân hiệu"],
    ["Nhân sự", "Danh sách GV + phân công; gán vai trò kiêm nhiệm"],
  ], { fontSize: 11, rowH: 0.55 });
}

// ---------- S8 Studio TVC360 ----------
{
  const s = p.addSlide();
  slideTitle(s, "STUDIO TVC360 - SOẠN HỌC LIỆU", "6 công cụ theo CTGDPT 2018 - nội dung qua gate chất lượng");
  table(s, [
    ["Mã", "Công cụ", "Đầu ra"],
    ["DC-01", "Kế hoạch bài dạy", "KHBĐ khung CV 5512 đủ 4 phần; hỗ trợ mẫu riêng của trường"],
    ["DC-02", "Ma trận đề", "YCCĐ × mức độ đúng tỷ lệ; cảnh báo TT22 cho lớp 1-3"],
    ["DC-03", "Đề kiểm tra", "Rút từ ngân hàng: đề chính + dự phòng + đáp án + biên bản phản biện; báo THIẾU khi bank thiếu câu"],
    ["DC-04", "Bộ câu hỏi", "Bộ luyện tập theo YCCĐ + đáp án"],
    ["DC-05", "Phiếu học tập", "Phiếu bài tập theo bài học"],
    ["DC-06", "Bài trình chiếu", "Slide theo tiến trình KHBĐ - 4 theme, tương tác, nhúng audio"],
  ], { fontSize: 10.5, rowH: 0.5 });
  bullets(s, [
    { t: "Ngân hàng câu hỏi của trường: 21k+ câu gắn 81/81 YCCĐ - import tay/ảnh-PDF (AI đọc)/Excel - duyệt 2 lớp", c: C.accent },
    { t: "Thư viện cá nhân + duyệt - nhận xét - published; kho ngữ liệu ngoài SGK; tra cứu YCCĐ theo môn/khối" },
  ], { y: 5.75, fontSize: 11.5, gap: 4 });
}

// ---------- S9 Audio + export ----------
{
  const s = p.addSlide();
  slideTitle(s, "HỌC LIỆU CÓ TIẾNG", "Audio thật nhúng thẳng vào tài liệu và slide - không phải demo");
  table(s, [
    ["Tính năng", "Chi tiết đã verify trên production"],
    ["Audio bài đọc (A-01)", "Đọc toàn bộ passage tiếng Anh - giọng neural, lặp theo câu"],
    ["Audio từ vựng (A-02)", "Đọc danh sách từ để HS nghe và lặp lại"],
    ["Audio hội thoại (A-03)", "2 giọng khác nhau cho 2 nhân vật - hội thoại nghe được thật"],
    ["Audio tiếng Việt (V-02)", "Đọc văn bản tiếng Việt bằng giọng vi-VN thật"],
    ["PPTX nhúng audio", "File WAV/MP3 thật trong ppt/media - PowerPoint phát trực tiếp"],
    ["Slide tương tác", "Đáp án ẩn - click vào câu hỏi mới hiện - chuẩn PowerPoint"],
    ["4 theme slide", "Navy - Emerald - Plum - Light, đổi bằng 1 chọn"],
  ], { fontSize: 10.5, rowH: 0.45 });
  bullets(s, [
    { t: "Pipeline TTS độc lập budget riêng: nội dung luôn có kể cả khi audio lỗi; provider OpenAI → edge-tts → Gemini chọn được bằng env", c: C.accent },
  ], { y: 5.75, fontSize: 11.5 });
}

// ---------- S10 AI ----------
{
  const s = p.addSlide();
  slideTitle(s, "AI TRONG HỆ THỐNG", "12 điểm dùng AI thật - provider linh hoạt, có fallback, có bảo mật");
  table(s, [
    ["Điểm dùng AI", "Đầu ra"],
    ["Trợ lý điều hành (BGH)", "Hỏi-đáp trên số liệu thật: phê duyệt, sự cố, chuyên cần"],
    ["Bản tin Sở/Phòng", "Tổng hợp số liệu các trường thành bản tin"],
    ["Radar - gợi ý can thiệp", "Bước/người/thời hạn cho từng cảnh báo"],
    ["Sinh câu hỏi theo YCCĐ", "Câu hỏi + lời giải gắn mức nhận thức"],
    ["Viết lại mô tả sự cố", "Mô tả chuẩn chuyên nghiệp + gợi ý xử lý"],
    ["Đánh giá ca tư vấn", "Gợi ý mức độ + hướng xử lý"],
    ["Gợi ý công việc tháng", "Phân tích lịch năm học → việc đề xuất"],
    ["Tóm tắt sổ đầu bài tuần", "Chuyên cần + nội dung dạy trong tuần"],
    ["Nhận xét giáo án", "Review chuyên môn khi duyệt"],
    ["Phân tích lớp / nhận xét / bản tin / thư nháp", "Theo dữ liệu lớp thật"],
  ], { fontSize: 11, rowH: 0.42, w: 7.4 });
  bullets(s, [
    { t: "Provider cấu hình bằng env - không hard-code", b: true, sub: ["GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY; AI_PROVIDER + AI_MODEL chọn được", "Multi-key fallback: *_API_KEY_2..9 + comma list; model chain tự đổi khi quota/404"] },
    { t: "Fallback 3 tầng", b: true, sub: ["LLM lỗi/quota → engine async (kết quả về qua callback) → rule-based - tính năng không bao giờ chết"] },
    { t: "Bảo mật PII", b: true, sub: ["Tên HS/GV được ẩn danh (pseudonymize) trước khi gửi provider ngoài; roster lỗi = không gửi (fail-closed)"] },
  ], { x: 8.3, y: 1.9, w: 4.6, fontSize: 11.5, gap: 6 });
}

// ---------- S11 Bao cao cap tren ----------
{
  const s = p.addSlide();
  slideTitle(s, "CẤP TRÊN & BÁO CÁO", "Sở/Phòng/UBND nhìn tổng thể - trường không phải làm báo cáo tay");
  bullets(s, [
    { t: "Dashboard Sở/Phòng/UBND", b: true, sub: ["Tổng hợp các trường thuộc đơn vị: quy mô, chuyên cần, cảnh báo; AI bản tin dept-brief"] },
    { t: "Quản trị người dùng (Sở)", b: true, sub: ["Danh sách tài khoản các trường trong đơn vị"] },
    { t: "Kiểm tra toàn vẹn dữ liệu (Sở)", b: true, sub: ["Lớp thiếu GVCN, HS chưa có tổ/phụ huynh, liên kết mồ côi"] },
    { t: "Xuất dữ liệu đầy đủ", b: true, sub: ["CSV toàn bộ sổ chủ nhiệm; học bạ DOCX/PDF; học liệu DOCX/PDF/PPTX; Excel mọi nơi có nút Tải template"] },
  ], { fontSize: 13.5, gap: 12 });
  note(s, "Tổ chức phân cấp thật: Sở → UBND/Phòng → Trường → Cơ sở - mỗi cấp chỉ thấy phạm vi mình");
}

// ---------- S12 Bao mat & kien truc ----------
{
  const s = p.addSlide();
  slideTitle(s, "KIẾN TRÚC & BẢO MẬT", "Multi-tenant thật - cách ly dữ liệu ở tầng database");
  table(s, [
    ["Lớp", "Cơ chế"],
    ["Phân quyền", "requireRoles từng route (default-deny) - checkActionRole ở server action - không dựa vào layout guard"],
    ["Cách ly tenant", "Row-Level Security Postgres theo school_id/campus_id: PH chỉ con mình, PHT chỉ campus mình, GV chỉ ghi lớp được phân công"],
    ["Audit", "Audit log mọi mutation quan trọng; check-consistency kiểm tra toàn vẹn trước mỗi release"],
    ["Anti leo thang", "Trigger chặn tự gán vai trò kiêm nhiệm; grant xung đột deny thắng"],
    ["AI outbound", "PII pseudonymize trước khi gửi; AI_ALLOWED_PROVIDERS/ENDPOINTS gate từng provider và host đích"],
    ["Chất lượng", "49+ CR merge, ~30 vòng external review độc lập (Codex + Gemini web), full regression trước mỗi deploy"],
  ], { fontSize: 11.5, rowH: 0.62 });
}

// ---------- S13 So lieu chung minh ----------
{
  const s = p.addSlide();
  slideTitle(s, "BẰNG CHỨNG", "Số liệu đo được trên production - không phải slide quảng cáo");
  table(s, [
    ["Chỉ số", "Giá trị"],
    ["Trạng thái", "Live production - sochunhiem.vieschool.com"],
    ["Môi trường demo", "3 trường cơ cấu sát thực tế: THCS Nguyễn Du (2 cơ sở), TH Chu Văn An, TH Kim Đồng - ~1.265 HS, 86 cán bộ"],
    ["Ngân hàng câu hỏi", "21k+ câu phủ 81/81 YCCĐ, duyệt 2 lớp"],
    ["Audio TTS production", "A-01/A-02/A-03/V-02 sinh file WAV/MP3 thật; PPTX 361KB chứa media nhúng mở được trong PowerPoint"],
    ["Test coverage", "Suite regression chạy mỗi deploy: RBAC, security edge, onboarding, lifecycle, consistency"],
    ["Review độc lập", "~30 vòng external review (Codex web + Gemini web) - mọi finding có triage, fix và test kèm"],
  ], { fontSize: 11.5, rowH: 0.62 });
  note(s, "Đăng nhập demo: anhptl@nd.scn (GVCN) / hainv@nd.scn (BGH) / minhtv@nd.scn (GVBM) - mật khẩu demo1234");
}

// ---------- S14 Luong nghiep vu ----------
{
  const s = p.addSlide();
  slideTitle(s, "LUỒNG NGHIỆP VỤ XUYÊN MODULE", "Dữ liệu chảy liền mạch - không nhập lại");
  bullets(s, [
    { t: "Vắng trong tiết học: Sổ đầu bài đánh dấu → attendance_records cập nhật → dashboard + tracking thống kê → PH nhận thông báo" },
    { t: "Hoạt động giáo dục: GVCN lập kế hoạch → BGH duyệt → công bố → PH đăng ký → GVCN điểm danh + đánh giá" },
    { t: "Giáo án: GV soạn (AI) → tổ trưởng duyệt/trả lại kèm nhận xét (AI gợi ý) → GV sửa nộp lại" },
    { t: "Kỳ thi: tạo kỳ thi + buổi thi (tay/Excel) → công bố → đề soạn từ Ngân hàng Studio (AI → YCCĐ → duyệt → DC-03 rút đề)" },
    { t: "Sự cố an toàn: GVCN ghi nhận (AI viết lại) → xử lý → mức Cao báo BGH → lưu trữ tra cứu" },
    { t: "Cảnh báo sớm: chấm điểm rủi ro từ chuyên cần/điểm/sự cố → radar BGH → AI đề xuất → tiếp nhận → đóng" },
    { t: "Học bạ cuối năm: điểm + hạnh kiểm + NLPC + chuyên cần → gợi ý xếp loại TT22 → GVCN trình → BGH duyệt → khóa sổ → xuất DOCX/PDF" },
  ], { fontSize: 12.5, gap: 10 });
}

// ---------- S15 Closing ----------
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addText("Sẵn sàng trình diễn trên dữ liệu thật", {
    x: 0.8, y: 2.3, w: 11.7, h: 0.9, fontFace: FONT, fontSize: 30, bold: true, color: C.white,
  });
  s.addText("Mọi màn hình trong deck này đều đang chạy tại sochunhiem.vieschool.com - đăng nhập vai trò bất kỳ để xem trực tiếp", {
    x: 0.8, y: 3.3, w: 11.7, h: 0.6, fontFace: FONT, fontSize: 14, color: "5eead4" });
  s.addText("Demo: anhptl@nd.scn (GVCN) · hainv@nd.scn (BGH) · annv@nd.scn (phụ huynh) · baong@nd.scn (học sinh) - mật khẩu demo1234", {
    x: 0.8, y: 4.1, w: 11.7, h: 0.6, fontFace: FONT, fontSize: 12.5, color: "94a3b8" });
  s.addText("VieSchool - Sổ Chủ Nhiệm Số + Studio TVC360", {
    x: 0.8, y: 6.6, w: 11.7, h: 0.4, fontFace: FONT, fontSize: 11, color: "64748b" });
}

mkdirSync("docs/handover", { recursive: true });
await p.writeFile({ fileName: "docs/handover/PROPOSAL-gioi-thieu-tinh-nang.pptx" });
console.log("Written docs/handover/PROPOSAL-gioi-thieu-tinh-nang.pptx");
