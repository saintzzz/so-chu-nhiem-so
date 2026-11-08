/**
 * Deck chien luoc 6 dau muc cho investor - tong hop tu:
 *   docs/positioning/CHIEN-LUOC-6-DAU-MUC.md + GIA-TRI-GIA-TANG.md
 * node scripts/gen-strategy-investor-pptx.mjs -> docs/positioning/CHIEN-LUOC-6-DAU-MUC.pptx
 */
import PptxGenJS from "pptxgenjs";

const p = new PptxGenJS();
p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
p.layout = "W";
p.title = "So Chu Nhiem So - Chien luoc 6 dau muc";

const C = {
  ink: "0f172a", muted: "475569", accent: "0f766e", accentL: "ccfbf1",
  amber: "b45309", white: "ffffff", bg: "f8fafc", line: "e2e8f0",
  red: "b91c1c", dark: "0c4a45",
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
          fontFace: FONT, fontSize: opts.fontSize ?? 11, bold: i === 0 || (opts.boldLast && i === rows.length - 1),
          color: i === 0 ? C.white : C.ink,
          fill: { color: i === 0 ? C.accent : i === rows.length - 1 && opts.boldLast ? C.accentL : i % 2 ? C.white : C.bg },
          valign: "middle", margin: 0.06,
        },
      })),
    ),
    { x: opts.x ?? 0.7, y: opts.y ?? 1.9, w: opts.w ?? 12, border: { pt: 0.75, color: C.line }, rowH: opts.rowH ?? 0.42, colW: opts.colW },
  );
}
function note(s, txt, y = 7.0) {
  s.addText(txt, { x: 0.7, y, w: 12, h: 0.4, fontFace: FONT, fontSize: 10.5, italic: true, color: C.accent });
}
function footer(s, n) {
  s.addText(`Sổ Chủ Nhiệm Số - Chiến lược 6 đầu mục | ${n}`, { x: 0.7, y: 7.18, w: 12, h: 0.25, fontFace: FONT, fontSize: 8.5, color: C.muted });
}

// ---------- S1 Cover ----------
{
  const s = p.addSlide();
  s.background = { color: C.dark };
  s.addText("SỔ CHỦ NHIỆM SỐ - VIESCHOOL", { x: 0.9, y: 2.0, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 15, color: C.accentL, bold: true });
  s.addText("Chiến lược hệ thống\ntheo 6 đầu mục", { x: 0.9, y: 2.5, w: 11.5, h: 1.9, fontFace: FONT, fontSize: 40, bold: true, color: C.white });
  s.addText(
    "Nền tảng quản trị trường phổ thông theo quy định hiện hành - sẵn sàng triển khai, sẵn sàng tích hợp CSDL ngành.",
    { x: 0.9, y: 4.55, w: 10.5, h: 0.9, fontFace: FONT, fontSize: 15, color: "d1fae5" },
  );
  s.addText("Tài liệu cho nhà đầu tư - 2026-11", { x: 0.9, y: 6.6, w: 10, h: 0.4, fontFace: FONT, fontSize: 12, color: "99f6e4" });
}

// ---------- S2 Tong quan ----------
{
  const s = p.addSlide();
  slideTitle(s, "TỔNG QUAN", "6 đầu mục chiến lược - trạng thái", "Tất cả đều đã có trong code hệ thống, không chỉ trên giấy");
  table(s, [
    ["Đầu mục", "Trạng thái", "Còn lại"],
    ["1. Quy định hiện hành", "ĐẠT - 9 văn bản đã vào code", "Theo dõi dự thảo TT22 mới"],
    ["2. Điều lệ quản trị trường", "ĐẠT - TT 15/2026, 4 loại trường", "Tenant THPT/liên cấp khi pilot"],
    ["3. Giá trị gia tăng", "ĐẠT - định vị rõ", "-"],
    ["4. UX thẻ chức năng hay dùng", "ĐẠT - QuickActions 6 vai trò", "Cá nhân hóa (nếu cần)"],
    ["5. CSDL Bộ + hệ thống cũ", "NỀN TẢNG + 2 chiều đã verify", "Mã trường, mẫu V.EMIS, API khi Bộ mở"],
    ["6. Bảo mật VN + consent", "NỀN TẢNG + lộ trình A/B/C + deploy kit", "Consent theo tuổi; VM VN khi khách yêu cầu"],
  ], { y: 1.95, fontSize: 11.5, rowH: 0.62, colW: [3.4, 4.6, 4.0] });
  note(s, "Nguồn chi tiết: docs/positioning/CHIEN-LUOC-6-DAU-MUC.md + GIA-TRI-GIA-TANG.md");
  footer(s, 2);
}

// ---------- S3 Phan 1 phap ly ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN 1", "Xây dựng trên quy định hiện hành", "9 văn bản đã được đưa vào code - audit từng dòng, không phải trang trí");
  table(s, [
    ["Văn bản", "Áp dụng trong hệ thống"],
    ["TT 15/2026 Điều lệ trường", "Quy trình điều hành, vai trò, duyệt sổ - thay TT 32/2020"],
    ["TT 22/2021 Đánh giá HS", "Cột điểm ĐĐG, ĐTBm HK1/HK2/cả năm, xếp loại - src/lib/tt22.ts"],
    ["QĐ 3016 Học bạ điện tử", "Export học bạ XML chuẩn + ký xác thực hệ thống"],
    ["TT 26/2019 + TT 42/2021", "Mã định danh ngành 20 ký tự cho HS/GV - students/profiles.national_id"],
    ["Luật 91/2025 + NĐ 13/2023", "PDPL: consent_records, data_requests, DPIA, breach 72h"],
    ["NĐ 356/2025", "Hồ sơ đánh giá chuyển dữ liệu ra nước ngoài (7 processor)"],
    ["NĐ 130/2018 + TT 10/2025 + NĐ 53/2022", "Ký xác thực, chính quyền 2 cấp, lưu trữ dữ liệu"],
  ], { y: 1.9, fontSize: 10.5, rowH: 0.58, colW: [3.6, 8.4] });
  footer(s, 3);
}

// ---------- S4 Phan 2 dieu le ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN 2", "Quản trị nhà trường theo TT 15/2026", "Một điều lệ chung - hệ thống hỗ trợ cả 4 loại hình trường");
  bullets(s, [
    { t: "4 loại trường trong cùng codebase", b: true },
    { t: "", sub: ["TH / THCS / THPT / trường phổ thông nhiều cấp học (liên cấp) - field school.level"] },
    { t: "Luồng đánh giá theo cấp", b: true },
    { t: "", sub: ["Tiểu học: nhận xét Đạt/Chưa đạt - THCS/THPT: chấm điểm TT22 - cả hai đang chạy trong demo"] },
    { t: "Cấu trúc tổ chức đúng Điều lệ", b: true },
    { t: "", sub: ["BGH - PHT theo campus, tổ chuyên môn, GVCN, GVBM, ban cán sự, ban CMHS, y tế, kế toán, thư viện, văn thư"] },
    { t: "Cấp quản lý trên trường", b: true },
    { t: "", sub: ["Sở GD&ĐT + UBND xã theo mô hình chính quyền 2 cấp (TT 10/2025) - có dashboard riêng"] },
    { t: "Demo thực tế đang chạy", b: true, c: C.accent },
    { t: "", sub: ["2 trường TH + 1 trường THCS, ~1.275 học sinh, ~140 giáo viên - không phải mockup"] },
  ], { fontSize: 13 });
  footer(s, 4);
}

// ---------- S5 Phan 3 gia tri ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN 3", "Giá trị gia tăng - tại sao trường cần", "Pain thật của giáo viên chủ nhiệm, không phải bài toán giả định");
  bullets(s, [
    { t: "Pain: GVCN mất 3-5 giờ/tuần làm sổ tay", b: true },
    { t: "", sub: ["Điểm danh giấy -> nhập lại sổ điểm -> tổng hợp báo cáo -> trả lời PH qua Zalo cá nhân -> viết sổ chủ nhiệm cuối tuần"] },
    { t: "Dữ liệu rải rác Excel/Zalo/sổ giấy", b: true },
    { t: "", sub: ["Sở/Phòng đòi báo cáo đột xuất -> trường làm lại từ đầu"] },
    { t: "Áp lực pháp lý mới", b: true },
    { t: "", sub: ["Luật 91/2025: dữ liệu trẻ em không thể nằm trên máy cá nhân/Zalo - trường không số hóa = mắc lỗi compliance"] },
    { t: "Giải pháp của hệ thống", b: true, c: C.accent },
    { t: "", sub: ["Điểm danh 1 chạm -> báo cáo ngày BGH tự động -> sổ chủ nhiệm tự sinh từ dữ liệu đã nhập"] },
    { t: "Điều kiện triển khai tối thiểu", b: true, c: C.accent },
    { t: "", sub: ["Chỉ cần trình duyệt + file Excel/file xuất SMAS/vnEdu - không server, không IT, khởi tạo 1 buổi cho ~500 HS"] },
  ], { fontSize: 13 });
  footer(s, 5);
}

// ---------- S6 Doi thu ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN 3", "Khác biệt so với đối thủ", "vnEdu/SMAS mạnh 'báo cáo lên Bộ' - yếu 'việc hằng ngày của GV'. Mình làm ngược lại.");
  table(s, [
    ["Tiêu chí", "SMAS", "vnEdu", "MISA", "Sổ Chủ Nhiệm Số"],
    ["Điểm khởi đầu", "Quản trị trường", "Nền tảng ngành", "Quản trị + KT", "Việc hằng ngày của GVCN/GVBM"],
    ["AI", "Giới hạn", "Một số điểm", "Cơ bản", "Đa tầng + fallback không cần API key"],
    ["Module", "Gói tổng", "Gói cụm", "Phân hệ", "19 module bán lẻ như phụ kiện"],
    ["Chuẩn ngành", "Theo SMAS", "Sớm VEMIS", "Theo MISA", "Mã định danh TT26/42 là trường chính"],
    ["Phục vụ", "Trường Viettel", "Trường VNPT", "Công + tư", "Công + tư + nhóm trường + Sở"],
  ], { y: 1.95, fontSize: 10.5, rowH: 0.72, colW: [2.1, 2.0, 2.0, 1.9, 4.0] });
  note(s, "Lợi thế cốt lõi: dữ liệu sạch từ việc hằng ngày -> báo cáo tự chảy lên, không nhập hai lần.");
  footer(s, 6);
}

// ---------- S7 Phan 4 UX ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN 4", "Trải nghiệm: chức năng hay dùng hiển thị thẻ", "Mỗi vai trò thấy ngay 4-6 việc hay làm nhất khi đăng nhập");
  table(s, [
    ["Vai trò", "Thẻ chức năng hay dùng"],
    ["GVCN", "Điểm danh - Báo cáo ngày BGH - Sổ điểm - Sổ đầu bài - Nhận xét rèn luyện - Tin nhắn PH"],
    ["GVBM", "Lịch dạy - Nhập điểm - Sổ đầu bài - Bài tập trực tuyến - Giáo án - Trao đổi GVCN"],
    ["Tổ trưởng", "Duyệt giáo án - Đánh giá năng lực - Sinh hoạt chuyên môn - GV trong tổ"],
    ["BGH/PHT", "Báo cáo ngày các lớp - Ký duyệt sổ - Phê duyệt - TKB trường - Radar - Nhân sự"],
    ["Kế toán", "Hóa đơn & thu tiền - Đợt thu - Danh mục - Báo cáo thu chi - Tích hợp TT"],
    ["Sở/UBND", "Trường học - Dữ liệu & báo cáo - Xã/phường - Người dùng - Module"],
  ], { y: 1.95, fontSize: 11, rowH: 0.6, colW: [2.2, 9.8] });
  note(s, "PH/HS: portal một trang (điểm, chuyên cần, tin nhắn, học bạ, bài thi) - bản chất đã là 'hay dùng' dựng sẵn.");
  footer(s, 7);
}

// ---------- S8 Phan 5 CSDL ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN 5", "Kết nối CSDL Bộ + chuyển dữ liệu hệ thống cũ", "CSDL ngành = VEMIS (csdl.moet.gov.vn) - cơ chế hiện hành là file chuẩn, không phải API");
  bullets(s, [
    { t: "Chuyển dữ liệu 2 CHIỀU đã chạy thật", b: true, c: C.accent },
    { t: "", sub: [
      "Import: đọc file xuất thật vnEdu/SMAS - Mã học sinh, Mã VEMIS, Họ đệm+Tên, cha/mẹ/SĐT/email -> tạo parents + liên kết tự động",
      "Export: xuất .xlsx đúng mẫu-1 vnEdu (26 cột chuẩn + khối tiêu đề) để hệ thống cũ import ngược lại",
      "Round-trip đã verify trên dữ liệu thật: export lớp 34 HS -> parse lại 0 lỗi",
    ] },
    { t: "Mã định danh ngành là trường dữ liệu chính", b: true },
    { t: "", sub: ["students.national_id + profiles.national_id - 20 ký tự bất biến theo TT 26/2019"] },
    { t: "Sẵn sàng khi Bộ mở API", b: true },
    { t: "", sub: ["Integration framework (connectors + outbox + retry) - chỉ cần cắm connector csdl_nganh khi có spec"] },
    { t: "Chờ dữ liệu thật từ pilot", b: true, c: C.amber },
    { t: "", sub: ["Mã định danh trường (Sở cấp), mẫu V.EMIS năm học hiện hành, credential cổng để đo endpoint thật"] },
  ], { fontSize: 12.5 });
  footer(s, 8);
}

// ---------- S9 Phan 6 bao mat ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHẦN 6", "Bảo mật dữ liệu - lộ trình A/B/C", "Không cần viết lại ứng dụng ở bất kỳ phương án nào - kiến trúc đã thiết kế để đổi chỗ đất");
  table(s, [
    ["Giai đoạn", "Phương án", "Nội dung"],
    ["Hiện tại - pilot/trường tư", "A - Giữ hạ tầng", "Supabase + Vercel + hồ sơ NĐ356 + DPA + PII đã redact trước AI - chi phí $0"],
    ["Trường công yêu cầu dữ liệu VN", "B - Đổi chỗ đất", "Self-host Supabase trên Viettel/VNPT/CMC - code không đổi, deploy kit đã verify E2E"],
    ["Quy mô Sở/toàn quốc", "B + C + A05", "Lưu VN + mã hóa trường nhạy cảm (AES-256-GCM) + đánh giá ATTT A05"],
  ], { y: 1.9, fontSize: 11, rowH: 0.85, colW: [3.0, 2.6, 6.4] });
  bullets(s, [
    { t: "Consent theo tuổi (NĐ 13/2023): <14 bắt buộc PHHS, >=14 HS tự đồng thuận - suy diễn từ ngày sinh", c: C.ink },
    { t: "Deploy kit vn-selfhost đã verify: 192/192 bảng, 423/423 policies, app chạy trên stack tự host", c: C.accent },
  ], { y: 4.85, h: 1.9, fontSize: 12, gap: 6 });
  footer(s, 9);
}

// ---------- S10 Ket ----------
{
  const s = p.addSlide();
  slideTitle(s, "TÓM TẮT", "Điểm mạnh đầu tư", "Điều làm hệ thống này khác các EMIS truyền thống");
  bullets(s, [
    { t: "Compliance thiết kế từ đầu, không vá sau", b: true },
    { t: "", sub: ["9 văn bản pháp lý trong code, PDPL suite đầy đủ, lộ trình lưu trữ VN có deploy kit sẵn"] },
    { t: "Bắt đầu từ giáo viên, không phải từ báo cáo", b: true },
    { t: "", sub: ["vnEdu/SMAS tối ưu 'báo cáo lên Bộ' - hệ này tối ưu '3-5 giờ/tuần của GVCN' -> adoption tự nhiên"] },
    { t: "Chuẩn ngành là dữ liệu chính, không phải lớp dán ngoài", b: true },
    { t: "", sub: ["Mã định danh TT26/42 là field chính -> xuất/nhập V.EMIS, học bạ QĐ3016 native"] },
    { t: "Mô hình module lẻ = doanh thu mở rộng", b: true },
    { t: "", sub: ["19 module bán như phụ kiện - trường mua lõi rẻ, mở rộng dần (học bạ, LMS, tuyển sinh, văn thư...)"] },
    { t: "Mọi tính năng đều đã chạy thật trong demo", b: true, c: C.accent },
    { t: "", sub: ["~1.275 HS, ~140 GV, 3 trường - E2E + Playwright verify, không phải mockup"] },
  ], { fontSize: 12.5 });
  note(s, "Chi tiết: docs/positioning/CHIEN-LUOC-6-DAU-MUC.md - GIA-TRI-GIA-TANG.md", 6.95);
  footer(s, 10);
}

await p.writeFile({ fileName: "docs/positioning/CHIEN-LUOC-6-DAU-MUC.pptx" });
console.log("OK -> docs/positioning/CHIEN-LUOC-6-DAU-MUC.pptx (10 slides)");
