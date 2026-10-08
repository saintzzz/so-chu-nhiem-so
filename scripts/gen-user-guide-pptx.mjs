/**
 * User Guide PPTX - cap nhat theo trang thai moi nhat cua he thong.
 * node scripts/gen-user-guide-pptx.mjs -> docs/handover/USER-GUIDE-vieschool.pptx
 * Nguon du lieu: docs/user-guide/KICH-BAN-DEMO.md, HUONG-DAN-SU-DUNG.md,
 * KHOI-TAO-TRUONG-MOI.md, ma tran quyen trong code (src/lib/nav.ts, ROLE-MATRIX).
 */
import PptxGenJS from "pptxgenjs";
import { mkdirSync } from "node:fs";

const p = new PptxGenJS();
p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
p.layout = "W";

const C = {
  ink: "0f172a", muted: "475569", accent: "0f766e", accentL: "ccfbf1",
  amber: "b45309", white: "ffffff", bg: "f8fafc", line: "e2e8f0",
  code: "1e293b",
};
const FONT = "Segoe UI";

function slideTitle(s, section, title, desc) {
  s.addText(section, { x: 0.55, y: 0.28, w: 12, h: 0.3, fontFace: FONT, fontSize: 11, color: C.accent, bold: true });
  s.addText(title, { x: 0.55, y: 0.55, w: 12.2, h: 0.7, fontFace: FONT, fontSize: 26, bold: true, color: C.ink });
  if (desc) s.addText(desc, { x: 0.55, y: 1.28, w: 12.2, h: 0.45, fontFace: FONT, fontSize: 12.5, color: C.muted });
  s.addShape(p.shapes.LINE, { x: 0.55, y: 1.72, w: 12.2, h: 0, line: { color: C.line, width: 1 } });
}

function bullets(s, items, { x = 0.7, y = 1.95, w = 12, h = 5, fontSize = 13.5, gap = 8 } = {}) {
  s.addText(
    items.flatMap((it) =>
      Array.isArray(it)
        ? it.map((t) => ({ text: String(t), options: { bullet: { indent: 14 }, breakLine: true } }))
        : [
            { text: String(it.t ?? it), options: { bullet: { code: "2022", indent: 14 }, breakLine: true, bold: !!it.b, color: it.c ?? C.ink } },
            ...(it.sub ?? []).map((t) => ({ text: t, options: { bullet: { code: "2013", indent: 30 }, breakLine: true, color: C.muted, fontSize: fontSize - 1.5 } })),
          ],
    ),
    { x, y, w, h, fontFace: FONT, fontSize, color: C.ink, paraSpaceAfter: gap, valign: "top" },
  );
}

function table(s, rows, opts = {}) {
  s.addTable(
    rows.map((r, i) =>
      r.map((c) => ({
        text: String(c),
        options: {
          fontFace: FONT, fontSize: i === 0 ? 11.5 : 11, bold: i === 0,
          color: i === 0 ? C.white : C.ink,
          fill: { color: i === 0 ? C.accent : i % 2 ? C.white : C.bg },
          valign: "middle", margin: 0.08,
        },
      })),
    ),
    { x: opts.x ?? 0.7, y: opts.y ?? 1.95, w: opts.w ?? 12, border: { pt: 0.75, color: C.line }, rowH: opts.rowH ?? 0.42 },
  );
}

function note(s, txt, y = 6.85) {
  s.addText(txt, { x: 0.7, y, w: 12, h: 0.5, fontFace: FONT, fontSize: 10.5, italic: true, color: C.accent });
}

// ---------- S1 Cover ----------
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addText("VieSchool - Sổ Chủ Nhiệm Số & Công cụ số Giáo viên", {
    x: 0.8, y: 2.0, w: 11.7, h: 1.1, fontFace: FONT, fontSize: 32, bold: true, color: C.white,
  });
  s.addText("HƯỚNG DẪN SỬ DỤNG & GIỚI THIỆU CHỨC NĂNG", {
    x: 0.8, y: 3.15, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 16, color: "5eead4",
  });
  s.addText([
    { text: "Phiên bản: v2.0 - 10/2026 (gồm vai trò kiêm nhiệm + bộ kit khởi tạo trường)", options: { breakLine: true } },
    { text: "URL: https://sochunhiem.vieschool.com", options: { breakLine: true } },
    { text: "Phạm vi: CTGDPT 2018, TT 22/2021, TT 27/2025, CV 5512; bảo mật theo Luật 91/2025", options: { breakLine: true } },
    { text: "Dữ liệu demo: 3 trường thật quy mô, ~1 275 học sinh, ~86 cán bộ, ngân hàng 1 080+ câu hỏi", options: {} },
  ], { x: 0.8, y: 3.95, w: 11.7, h: 1.6, fontFace: FONT, fontSize: 13, color: "94a3b8", paraSpaceAfter: 6 });
}

// ---------- S2 Tong quan ----------
{
  const s = p.addSlide();
  slideTitle(s, "GIỚI THIỆU", "Hệ thống gồm 2 module chính trên một nền tảng");
  bullets(s, [
    { t: "Sổ Chủ Nhiệm Số (SCN) - vận hành lớp học & nhà trường", b: 1 },
    { sub: ["Điểm danh, sổ điểm, hạnh kiểm, sổ liên lạc phụ huynh, thời khóa biểu, sự cố an toàn, sơ đồ chỗ ngồi, báo cáo BGH/Sở", "Phân quyền theo vai trò: GVCN, GVBM, Tổ trưởng, PHT, BGH, Kế toán, Sở GD&ĐT, UBND, Phụ huynh, Học sinh, Admin"] },
    { t: "TVC360 Studio - công cụ soạn thảo giáo viên", b: 1 },
    { sub: ["KHBĐ theo CV 5512 (DC-01), ma trận đề (DC-02), đề kiểm tra theo ma trận (DC-03), bộ câu hỏi (DC-04), phiếu học tập (DC-05), bài trình chiếu PPTX (DC-06)", "Ngân hàng câu hỏi chung của trường gắn YCCĐ, duyệt 2 lớp, xuất DOCX/PDF/PPTX, LaTeX/KaTeX"] },
    { t: "Dữ liệu theo trường (multi-tenant): mọi bảng scope school_id + RLS nghiêm ngặt", b: 1 },
    { t: "Vai trò kiêm nhiệm (multi-role): một cán bộ giữ nhiều vai trò - menu và quyền gộp từ toàn bộ vai trò", b: 1 },
  ]);
  note(s, "Thiết kế cho quy mô: 100 000 user giai đoạn pilot, lộ trình 1 000 000.");
}

// ---------- S3 Moi truong demo ----------
{
  const s = p.addSlide();
  slideTitle(s, "DỮ LIỆU DEMO", "3 trường thật quy mô - đủ mọi tình huống nghiệp vụ");
  table(s, [
    ["Trường", "Cấp", "Lớp", "Học sinh", "Cán bộ", "Đặc điểm demo"],
    ["THCS Nguyễn Du", "THCS", "12 (6A1-9A3)", "~435", "34", "2 cơ sở, 4 tổ CM - demo giới hạn PHT theo cơ sở"],
    ["Tiểu học Chu Văn An", "TH", "15 (1A1-5A3)", "~500", "30", "Đánh giá mức độ TT 22/2021, 4 tổ"],
    ["Tiểu học Kim Đồng", "TH", "10 (1A1-5A2)", "~340", "22", "3 tổ, đa trường cùng Sở"],
  ]);
  bullets(s, [
    { t: "Mỗi trường: đủ BGH/PHT/kế toán/tổ trưởng/GVCN/GVBM phân môn, TKB đầy đủ, điểm, chuyên cần, hạnh kiểm, hoạt động, sự cố, cảnh báo sớm, kế hoạch hỗ trợ" },
    { t: "Ngân hàng câu hỏi TVC360: 360 câu/trường gán đúng giáo viên của trường đó" },
    { t: "THCS Nguyễn Du có 2 cơ sở - khối A3 thuộc Cơ sở 2 do PHT phụ trách, dùng demo giới hạn phạm vi" },
  ], { y: 4.3, fontSize: 12.5 });
}

// ---------- S4 Accounts ----------
{
  const s = p.addSlide();
  slideTitle(s, "TÀI KHOẢN DEMO", "Đăng nhập https://sochunhiem.vieschool.com/login - mật khẩu chung: demo1234");
  table(s, [
    ["Tài khoản", "Nhân sự", "Vai trò", "Dùng để test"],
    ["hainv@nd.scn", "Nguyễn Văn Hải - HT Nguyễn Du", "bgh + gvbm", "Quản trị trường, duyệt cuối, Studio"],
    ["duclm@nd.scn", "Lê Minh Đức - PHT cơ sở 2", "pht + gvbm", "Chỉ thấy lớp Cơ sở 2, kiêm dạy"],
    ["hanhlth@nd.scn", "Lê Thị Hồng Hạnh - Tổ Toán-TN", "to_truong + gvbm", "Duyệt lớp tổ, giảng dạy"],
    ["anhptl@nd.scn", "Phạm Thị Lan Anh - GVCN 8A2", "gvcn + gvbm + to_truong", "3 vai trò - điểm nhấn kiêm nhiệm"],
    ["minhtv@nd.scn", "Trần Văn Minh - GV Vật lý", "gvbm", "Đơn vai trò - chứng minh quyền giữ nguyên"],
    ["trangpt@nd.scn", "Phạm Thu Trang", "ke_toan", "Nhân sự, thu chi"],
    ["annv@nd.scn", "Nguyễn Văn An", "phu_huynh", "Portal PH - chỉ thấy con (Bảo 8A2)"],
    ["baong@nd.scn", "Nguyễn Gia Bảo - lớp 8A2", "hoc_sinh", "Portal HS - TKB, điểm, học bạ"],
    ["sovqt@demo.scn", "Vũ Quản Trị Sở", "so_gd", "Tạo trường, dashboard 3 trường"],
    ["daonvl@demo.scn", "Ngô Văn Lãnh Đạo", "ubnd", "Dashboard địa bàn - chỉ đọc"],
    ["admin@demo.scn", "Quản trị hệ thống", "admin", "Toàn hệ thống"],
  ], { rowH: 0.34 });
  note(s, "Trường khác: phuongttm / oanhdtk / lienttb / havt @cva.scn và longhd / ngaltt / anhdn @kd.scn. GV còn lại: tenvt@{nd|cva|kd}.scn (ten + viet tat ho dem).", 7.0);
}

// ---------- S5 Multi-role ----------
{
  const s = p.addSlide();
  slideTitle(s, "VAI TRÒ KIÊM NHIỆM", "Đúng thực tế trường Việt Nam - GVCN luôn kiêm dạy, tổ trưởng vẫn đứng lớp");
  bullets(s, [
    { t: "Một cán bộ = 1 vai trò chính + nhiều vai trò kiêm nhiệm (concurrent roles)", b: 1 },
    { sub: ["Ví dụ: GVCN 8A2 đồng thời là GV dạy Toán và Tổ trưởng Toán-Tự nhiên", "PHT/Hiệu trưởng vẫn phân công dạy - kiêm GVBM là mặc định"] },
    { t: "Quyền = hợp của mọi vai trò, tính ở 3 tầng nhất quán", b: 1 },
    { sub: ["UI: menu gộp + topbar hiện đủ nhãn vai trò; trang Hồ sơ hiện badge từng vai trò", "Server action: checkActionRole nhận role kiêm nhiệm", "Database: 158 RLS policies dùng my_roles() - không lách tầng app"] },
    { t: "An toàn:", b: 1 },
    { sub: ["Chỉ BGH/admin gán kiêm nhiệm tại /school/users - user tự sửa bị trigger chặn (chống leo quyền)", "Chỉ vai trò nhân sự được kiêm; admin/phụ huynh/học sinh không thể kiêm", "Người chỉ có 1 vai trò (gvbm thuần) vẫn bị chặn đúng route như trước"] },
  ]);
  note(s, "Cài đặt: /school/users → sửa cán bộ → tick 'Vai trò kiêm nhiệm'. Chỉ chức năng được quyền mới hiện trên menu.");
}

// ---------- S6 Role matrix ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHÂN QUYỀN", "Ma trận tóm tắt - menu chỉ hiện chức năng được cấp");
  table(s, [
    ["Chức năng", "GVBM", "GVCN", "Tổ trưởng", "PHT", "BGH/Admin"],
    ["Studio soạn học liệu DC-01..06", "Có", "Có", "Có", "-", "Có"],
    ["Ngân hàng câu hỏi - xem/đóng góp", "Có", "Có", "Có", "-", "Có"],
    ["Duyệt câu hỏi/học liệu", "-", "-", "Lớp tổ", "-", "Lớp BGH (cuối)"],
    ["Điểm danh, hạnh kiểm, SLĐ lớp", "-", "Lớp CN mình", "Xem", "Cơ sở mình", "Có"],
    ["Nhập điểm môn dạy", "Lớp mình dạy", "Có", "Lớp mình dạy", "Lớp mình dạy", "Có"],
    ["Hồ sơ HS toàn trường", "-", "Lớp CN", "Xem", "-", "Có"],
    ["Quản trị user/quyền/ACL", "-", "-", "-", "-", "Có"],
  ], { rowH: 0.36 });
  bullets(s, [
    { t: "Kiêm nhiệm: quyền = hợp vai trò - GVCN kiêm tổ trưởng được cả 2 cột", y: 5.35 },
    { t: "PHT giới hạn theo cơ sở (campus); không tiếp cận hồ sơ chi tiết HS (ẩn national_id)", y: 5.35 },
    { t: "Phân quyền 3 lớp: mặc định theo vai trò → cấu hình theo trường → ghi đè từng cán bộ (/school/users)", y: 5.35 },
  ], { y: 5.35, fontSize: 12 });
  note(s, "Sở GD&ĐT/UBND: giám sát + tạo trường, không vào nghiệp vụ lớp. Kiểm chứng tự động: node scripts/check-nav-access.mjs (158 hrefs).", 7.05);
}

// ---------- S7 Workflow GVCN ----------
{
  const s = p.addSlide();
  slideTitle(s, "WORKFLOW 1", "Giáo viên chủ nhiệm - ngày làm việc điển hình (anhptl@nd.scn)");
  bullets(s, [
    { t: "Topbar hiện 'Giáo viên chủ nhiệm · Giáo viên bộ môn · Tổ trưởng chuyên môn' - menu gộp đủ 3 vai trò" },
    { t: "Sáng: Điểm danh (/attendance/daily) - chọn lớp 8A2, tích vắng, lưu" },
    { sub: ["Đồng bộ sổ đầu bài (period log); cảnh báo vắng nhiều ngày; PH nhận thông báo"] },
    { t: "Trong ngày: sự cố (/safety/report), nhận xét hạnh kiểm (/conduct/records), sổ điểm Toán (/academics/grades)" },
    { t: "Liên lạc PH: /parents/compose - soạn + gửi email cho CMHS (Resend)" },
    { sub: ["GVCN cấp tài khoản cổng PH tại /register/roster; PH chỉ thấy đúng con mình"] },
    { t: "Kiêm tổ trưởng: mở /team/lesson-plans duyệt giáo án GV trong tổ - menu 'Tổ chuyên môn' chỉ hiện khi có vai trò" },
    { t: "Cuối kỳ: báo cáo chuyên cần, hạnh kiểm TT22 (HK1/HK2/cả năm tách biệt), ký duyệt sổ" },
  ]);
}

// ---------- S8 Workflow Studio ----------
{
  const s = p.addSlide();
  slideTitle(s, "WORKFLOW 2", "Giáo viên bộ môn - biên soạn trên Studio (/studio)");
  bullets(s, [
    { t: "Chọn công cụ DC-01..DC-06 → điền môn/khối/bài → Sinh (AI hoặc fallback rule-based khi hết quota)" },
    { sub: ["Môn tự preselect theo môn phụ trách của GV; công thức LaTeX $...$ render KaTeX, xuất DOCX thành Word Equation native"] },
    { t: "Chỉnh sửa trực tiếp → Lưu vào Thư viện của tôi (/studio/library)" },
    { t: "Gửi duyệt → tổ trưởng nhận notification → BGH duyệt cuối → published" },
    { t: "Xuất: DOCX (đề/KHBĐ/phiếu), PDF (trang in), PPTX (DC-06)" },
    { t: "Các trang con Studio (Thư viện, Ngân hàng, Kho ngữ liệu, YCCĐ, Mẫu KHBĐ) đều có link 'Tất cả công cụ' quay về /studio" },
  ]);
  note(s, "AI sinh có kiểm chứng 2 lớp: prompt ép khung + sanitizer lọc nội dung lạc đề (đáp án/phiếu rời rạc bị cắt).");
}

// ---------- S9 DC-01 ----------
{
  const s = p.addSlide();
  slideTitle(s, "CÔNG CỤ DC-01", "Kế hoạch bài dạy (KHBĐ) - khung Công văn 5512");
  bullets(s, [
    { t: "Input: Môn / Khối / Bài học (chọn YCCĐ) / Số tiết / Mẫu KHBĐ" },
    { sub: ["Mẫu hệ thống theo CV 5512 hoặc mẫu riêng của trường tại /studio/mau-khbd (admin tạo, đặt mặc định)"] },
    { t: "Output đúng biểu mẫu: I. Mục tiêu - II. Thiết bị DH - III. Tiến trình - IV. Điều chỉnh + Ký duyệt", b: 1 },
    { sub: ["Mỗi hoạt động đủ: a) Mục tiêu, b) Nội dung, c) Tổ chức (bảng 2 cột GV-HS | Nội dung), d) Sản phẩm, đ) Đánh giá", "Phụ lục đánh giá theo hoạt động; không còn mục 'ĐÁP ÁN/PHIẾU BÀI TẬP' lạc đề (sanitizer lọc)"] },
    { t: "Xuất DOCX - in ký duyệt; sửa được trực tiếp trước khi lưu/gửi duyệt" },
    { t: "Nếu AI trả sai khung → hệ thống tự loại và dùng bản rule-based đủ cấu trúc" },
  ]);
}

// ---------- S10 DC-02/03 ----------
{
  const s = p.addSlide();
  slideTitle(s, "CÔNG CỤ DC-02 + DC-03", "Ma trận đề và sinh đề kiểm tra");
  bullets(s, [
    { t: "DC-02: chọn môn/khối/đợt KT → ma trận YCCĐ × mức độ (Nhận biết/Hiểu/Vận dụng) đúng tỷ lệ quy định" },
    { sub: ["Đợt giữa kì cho lớp 1-3 cảnh báo TT22 (không bắt buộc KT giấy)"] },
    { t: "DC-03: chọn ma trận → rút câu từ ngân hàng CỦA TRƯỜNG → đề chính + đề dự phòng + bảng đáp án" },
    { sub: ["Ưu tiên không trùng câu giữa 2 đề; trộn đáp án trắc nghiệm tự động", "Ô ma trận thiếu câu → báo THIẾU trung thực, không lấy câu sai YCCĐ", "Tick 'Chỉ câu đã duyệt' → chỉ rút câu approved"] },
    { t: "Cấp tiểu học: tự đổi mẫu - Phần I trắc nghiệm gộp + Phần II tự luận, có chỗ mã phách" },
    { t: "Kèm biên bản phản biện đề (chủ tọa/thư ký/ủy viên) đúng quy trình ra đề của trường" },
  ]);
}

// ---------- S11 DC-04..06 ----------
{
  const s = p.addSlide();
  slideTitle(s, "CÔNG CỤ DC-04 / DC-05 / DC-06", "Bộ câu hỏi, phiếu học tập, bài trình chiếu");
  table(s, [
    ["Công cụ", "Input chính", "Output", "Xuất"],
    ["DC-04 Bộ câu hỏi", "Môn/khối/YCCĐ/số câu/mức độ", "Bộ câu hỏi luyện tập + đáp án", "DOCX"],
    ["DC-05 Phiếu học tập", "Môn/khối/bài + trọng tâm", "Phiếu BT có bài tập + hướng dẫn", "DOCX"],
    ["DC-06 Bài trình chiếu", "Môn/khối/YCCĐ/số slide", "Slide theo tiến trình KHBĐ", "PPTX"],
  ]);
  bullets(s, [
    { t: "Mọi công cụ: lưu thư viện → gửi duyệt → xuất file; AI sinh có kiểm chứng (schema + YCCĐ gate + sanitizer)", y: 4.6 },
  ], { y: 4.6, fontSize: 12.5 });
}

// ---------- S12 Question bank ----------
{
  const s = p.addSlide();
  slideTitle(s, "NGÂN HÀNG CÂU HỎI", "Ngân hàng chung của trường (/studio/questions)");
  bullets(s, [
    { t: "GV cùng trường đóng góp chung; filter: Cả trường / Của tôi / Môn của tổ tôi; phân trang server" },
    { t: "Thêm tay hoặc import ảnh/PDF (AI đọc) hoặc template Excel; validate: đúng qtype, mức độ, YCCĐ, stem tham chiếu hình phải kèm media" },
    { t: "Duyệt: từng câu hoặc bulk (tối đa 200 câu/lần); trạng thái: chưa duyệt → đã duyệt / đánh dấu lỗi" },
    { t: "Hình trong câu hỏi: upload ảnh HOẶC hình vẽ tham số SVG cho Toán (tam giác, HCN, tròn, góc, đồng hồ) - deterministic, không AI sinh ảnh" },
    { t: "Câu nghe Tiếng Anh: transcript ở Ngữ cảnh + nút Nghe thử (TTS trình duyệt)" },
    { t: "Mã câu tự sinh dạng <YCCĐ>-<D|F|S|E><seq> theo quy ước ngành" },
  ]);
  note(s, "Demo: 360 câu/trường; quyền duyệt tính theo role set - tổ trưởng kiêm nhiệm vẫn duyệt được.");
}

// ---------- S13 Review ----------
{
  const s = p.addSlide();
  slideTitle(s, "QUY TRÌNH DUYỆT 2 LỚP", "Tác giả → Tổ trưởng → BGH → published");
  bullets(s, [
    { t: "Lớp 1 - Tổ trưởng chuyên môn:", b: 1 },
    { sub: ["Ngân hàng: filter 'Môn của tổ tôi' - chỉ thấy môn tổ mình; Thư viện: 'Chờ duyệt - môn của tổ' xếp trên", "Duyệt / trả về kèm nhận xét → tác giả nhận notification in-app"] },
    { t: "Lớp 2 - BGH/admin:", b: 1 },
    { sub: ["Thấy tất cả, duyệt cuối → published; mọi thao tác ghi audit trail"] },
    { t: "Vai trò kiêm nhiệm áp dụng thật:", b: 1 },
    { sub: ["GVCN kiêm tổ trưởng (như cô Lan Anh) vẫn vào được queue duyệt của tổ mình", "Hàm DB (scn_review_material, scn_can_write_grade...) kiểm tra trên tập vai trò - không bypass được qua UI"] },
  ]);
}

// ---------- S14 Admin ----------
{
  const s = p.addSlide();
  slideTitle(s, "QUẢN TRỊ TRƯỜNG", "Trang /school/users - BGH/admin của từng trường");
  bullets(s, [
    { t: "Thêm cán bộ: email + mật khẩu + vai trò chính + vai trò kiêm nhiệm (checkbox) + cơ sở + tổ + mã NV + hợp đồng + trình độ" },
    { t: "Gán môn phụ trách (chip multi-select → teacher_subjects) - Studio tự preselect môn" },
    { t: "Tổ chuyên môn - môn học: gán môn cho tổ; cảnh báo vàng khi GV dạy môn khác tổ" },
    { t: "Ma trận quyền chức năng: 6 chức năng × 6 vai trò × 3 trạng thái (mặc định/cấm/cho) + quyền riêng từng người" },
    { sub: ["Có grant xung đột giữa các vai trò kiêm nhiệm → deny thắng (an toàn)"] },
    { t: "ACL dữ liệu tới item: ẩn một câu hỏi/học liệu cụ thể với một GV - GV khác vẫn thấy (RLS level)" },
    { t: "Chống leo quyền: trigger DB chặn user tự sửa vai trò/trường/kiêm nhiệm - chỉ BGH/admin được đổi" },
  ]);
}

// ---------- S15 Onboarding ----------
{
  const s = p.addSlide();
  slideTitle(s, "KHỞI TẠO TRƯỜNG MỚI", "2 đường - giao diện từng bước HOẶC import Excel hàng loạt");
  bullets(s, [
    { t: "Đường 1 - Giao diện:", b: 1 },
    { sub: ["Sở GD/admin: /dept/schools → 'Tạo trường' (tự tạo năm học, 2 tổ, bộ môn theo cấp, tài khoản BGH)", "BGH: /school/campuses khai cơ sở → /school/departments tổ CM → /school/users thêm cán bộ → tạo lớp → GVCN liên kết PH - HS → import TKB"] },
    { t: "Đường 2 - Import Excel hàng loạt (khuyến nghị cho trường lớn):", b: 1 },
    { sub: ["Tải workbook mẫu khoi-tao-truong.xlsx: 8 sheet (cơ sở, tổ, cán bộ, lớp, HS, phụ huynh, TKB + hướng dẫn)", "Chạy: node scripts/bootstrap-school.mjs --file <xlsx> --school <MA> --apply", "Tự tạo: tài khoản + vai trò kiêm nhiệm + môn dạy + trưởng tổ + lớp + GVCN + HS + PH/tài khoản PH + TKB", "Chạy lại nhiều lần an toàn (idempotent); có --cleanup dọn về 0"] },
    { t: "Hướng dẫn chi tiết: docs/user-guide/KHOI-TAO-TRUONG-MOI.md + checklist nghiệm thu", b: 1 },
  ]);
}

// ---------- S16 Highlights ----------
{
  const s = p.addSlide();
  slideTitle(s, "ĐIỂM NỔI BẬT", "Khác biệt so với nền tảng thông thường");
  bullets(s, [
    { t: "Bám quy định thật: YCCĐ CTGDPT 2018 chi tiết đến strand; TT22/2021; CV 5512 cho KHBĐ; TT 15/2026 điều lệ", c: C.accent },
    { t: "Vai trò kiêm nhiệm đúng thực tế trường VN - tính nhất quán UI/action/RLS, audit tự động menu theo quyền", c: C.accent },
    { t: "Ngân hàng trường + duyệt 2 lớp + audit trail - kiểm soát chất lượng đề như trường thật vận hành", c: C.accent },
    { t: "Hình học deterministic (không AI ảo) + xuất Word Equation native - in thi thật dùng được ngay", c: C.accent },
    { t: "AI provider linh hoạt (Gemini/OpenAI/Anthropic qua env) + sanitizer + fallback rule-based - không chết khi hết quota", c: C.accent },
    { t: "Multi-tenant RLS nghiêm + trigger chống leo quyền + DPIA theo Luật 91/2025 - sẵn sàng pilot liên trường", c: C.accent },
  ]);
}

// ---------- S17 Test checklist ----------
{
  const s = p.addSlide();
  slideTitle(s, "CHECKLIST TEST", "Các kịch bản ưu tiên rà soát");
  bullets(s, [
    { t: "KIÊM NHIỆM: anhptl@nd.scn thấy 3 nhãn vai trò + menu gộp + vào /team/* được; minhtv@nd.scn vào /team/* bị chặn", b: 1 },
    { t: "NỘI DUNG: KHBĐ đúng khung CV 5512 (5 phần a-đ); đề đúng ma trận, thang điểm, đáp án; YCCĐ gán khớp", b: 1 },
    { t: "WORKFLOW: đóng góp → duyệt tổ → duyệt BGH → notification đúng người", b: 1 },
    { t: "PHÂN QUYỀN: PHT chỉ thấy Cơ sở 2; PH chỉ thấy con mình; UBND chỉ đọc; trường A không thấy trường B", b: 1 },
    { t: "ONBOARDING: bootstrap workbook lên trường scratch → verify counts → cleanup về 0", b: 1 },
    { t: "EDGE CASES: câu 'như hình' không hình bị chặn; import sai format báo rõ; câu trùng stem cảnh báo", b: 1 },
  ]);
}

// ---------- S18 Docs map ----------
{
  const s = p.addSlide();
  slideTitle(s, "TÀI LIỆU KÈM THEO", "Bộ hồ sơ đầy đủ trong docs/user-guide/");
  table(s, [
    ["Tài liệu", "Nội dung"],
    ["HUONG-DAN-SU-DUNG.md", "Thao tác chi tiết theo từng vai trò (kèm kiêm nhiệm), 31 ảnh màn hình"],
    ["KHOI-TAO-TRUONG-MOI.md", "Đưa trường mới lên từ con số 0 - giao diện hoặc import hàng loạt"],
    ["khoi-tao-truong.xlsx", "Workbook mẫu 8 sheet để khởi tạo trường"],
    ["KICH-BAN-DEMO.md / .pptx", "Kịch bản demo theo luồng vai trò - tài khoản, đường đi, kết quả kỳ vọng"],
    ["MO-TA-CHUC-NANG.md", "Mô tả chi tiết module, ma trận vai trò, luồng nghiệp vụ"],
  ]);
  bullets(s, [
    { t: "Tái sinh file này: node scripts/gen-user-guide-pptx.mjs", y: 4.6 },
    { t: "Tái sinh workbook mẫu: node scripts/gen-init-template.mjs; kịch bản demo: gen-demo-pptx.mjs", y: 4.6 },
  ], { y: 4.6, fontSize: 12.5 });
}

mkdirSync("docs/handover", { recursive: true });
await p.writeFile({ fileName: "docs/handover/USER-GUIDE-vieschool.pptx" });
console.log("Written docs/handover/USER-GUIDE-vieschool.pptx");
