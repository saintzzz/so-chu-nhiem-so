/**
 * CR-HANDOVER: User Guide PPTX cho doi chuyen gia giao duc test he thong.
 * node scripts/gen-user-guide-pptx.mjs -> docs/handover/USER-GUIDE-vieschool.pptx
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
    x: 0.8, y: 2.2, w: 11.7, h: 1.1, fontFace: FONT, fontSize: 32, bold: true, color: C.white,
  });
  s.addText("HƯỚNG DẪN SỬ DỤNG & KIỂM THỬ - BÀN GIAO ĐỘI CHUYÊN GIA GIÁO DỤC", {
    x: 0.8, y: 3.3, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 15, color: "5eead4",
  });
  s.addText([
    { text: "Phiên bản: pilot v1 - 10/2026", options: { breakLine: true } },
    { text: "URL: https://sochunhiem.vieschool.com", options: { breakLine: true } },
    { text: "Phạm vi: chương trình GDPT 2018, TT 22/2021, TT 27/2025; bảo mật theo Luật 91/2025", options: {} },
  ], { x: 0.8, y: 4.1, w: 11.7, h: 1.2, fontFace: FONT, fontSize: 13, color: "94a3b8", paraSpaceAfter: 6 });
}

// ---------- S2 Tong quan ----------
{
  const s = p.addSlide();
  slideTitle(s, "GIỚI THIỆU", "Hệ thống gồm 2 module chính trên một nền tảng");
  bullets(s, [
    { t: "Sổ Chủ Nhiệm Số (SCN) - vận hành lớp học & nhà trường", b: 1 },
    { sub: ["Điểm danh, hạnh kiểm, sổ liên lạc phụ huynh, thời khóa biểu, sự cố an toàn, báo cáo BGH/Sở", "Phân quyền theo vai trò: GVCN, GVBM, Tổ trưởng, PHT, BGH, Kế toán, Phụ huynh, Học sinh"] },
    { t: "TVC360 Studio - công cụ soạn thảo giáo viên", b: 1 },
    { sub: ["KHBĐ (DC-01), ma trận đề (DC-02), đề kiểm tra theo ma trận (DC-03), bộ câu hỏi (DC-04), phiếu học tập (DC-05), bài trình chiếu PPTX (DC-06)", "Ngân hàng câu hỏi chung của trường gắn YCCĐ CTGDPT 2018, duyệt 2 lớp, xuất DOCX/PDF/PPTX"] },
    { t: "Dữ liệu theo trường (multi-tenant): mọi bảng đều scope school_id + RLS", b: 1 },
  ]);
  note(s, "Mục tiêu test: chuyên gia rà nội dung chuyên môn + quy trình nghiệp vụ trường học.");
}

// ---------- S3 Accounts ----------
{
  const s = p.addSlide();
  slideTitle(s, "TÀI KHOẢN TEST", "Đăng nhập tại https://sochunhiem.vieschool.com/login");
  table(s, [
    ["Vai trò", "Email", "Mật khẩu", "Dùng để test"],
    ["Hiệu trưởng / BGH", "bgh@demo.scn", "demo1234", "Quản trị trường, phân quyền, duyệt cuối"],
    ["Tổ trưởng chuyên môn", "totruong@demo.scn", "demo1234", "Duyệt câu hỏi/học liệu (lớp 1), lọc theo môn tổ"],
    ["Giáo viên chủ nhiệm", "gvcn@demo.scn", "demo1234", "Sổ CN, điểm danh, hạnh kiểm, đóng góp câu hỏi"],
    ["Giáo viên bộ môn", "gvbm@demo.scn", "demo1234", "Studio, ngân hàng câu hỏi (không duyệt được)"],
    ["Phụ huynh", "phuhuynh@demo.scn", "demo1234", "Portal PH, sổ liên lạc"],
    ["Học sinh", "hocsinh@demo.scn", "demo1234", "Portal HS, học bạ"],
    ["Sở GD&ĐT (demo)", "sogd@demo.scn", "demo1234", "Tạo trường + admin trường, dashboard usage xuyên trường"],
  ]);
  note(s, "Test multi-trường: gv001-gv100@{nd|cva|kd}.test / demo1234 - 3 trường, mỗi trường 100 GV (gv001-002: tổ trưởng, gv003: BGH).");
}

// ---------- S4 Role matrix ----------
{
  const s = p.addSlide();
  slideTitle(s, "PHÂN QUYỀN", "Ai được làm gì - ma trận tóm tắt");
  table(s, [
    ["Chức năng", "GVBM/GVCN", "Tổ trưởng", "BGH/Admin"],
    ["Studio (soạn KHBĐ/đề/bài giảng)", "Có", "Có", "Có"],
    ["Ngân hàng câu hỏi - xem/đóng góp", "Có", "Có", "Có"],
    ["Duyệt câu hỏi / học liệu", "Không", "Lớp tổ", "Lớp BGH (cuối)"],
    ["Xuất file (DOCX/PDF/PPTX)", "Có*", "Có*", "Có"],
    ["Quản trị user/quyền/ACL dữ liệu", "Không", "Không", "Có"],
    ["Sổ chủ nhiệm (điểm danh, HK, SLĐ)", "Chỉ GVCN lớp mình", "Xem", "Có"],
  ]);
  bullets(s, [
    { t: "Phân quyền 3 lớp (CR-030): mặc định theo vai trò → cấu hình theo trường → ghi đè theo từng GV", y: 5.0 },
    { t: "Sở GD&ĐT / admin hệ thống: quản trị trường (/dept/schools) + giám sát usage (/dept/usage) - không vào nghiệp vụ lớp", y: 5.0 },
  ], { y: 5.0, fontSize: 12.5 });
  note(s, "* Admin có thể tắt xuất file cho từng vai trò/GV trong Ma trận quyền tại /school/users.");
}

// ---------- S5 Workflow GVCN ----------
{
  const s = p.addSlide();
  slideTitle(s, "WORKFLOW 1", "Giáo viên chủ nhiệm - ngày làm việc điển hình");
  bullets(s, [
    { t: "Sáng: Điểm danh (/attendance/daily) - chọn lớp, tích vắng/có phép, lưu" },
    { sub: ["Đồng bộ tự động với sổ trực tiết (period log); cảnh báo vắng nhiều ngày"] },
    { t: "Trong ngày: sự cố/an toàn (/safety/report), nhận xét hạnh kiểm (/conduct/records)" },
    { t: "Liên lạc PH: /parents/compose - soạn + gửi email cho CMHS (Resend), thông báo toàn lớp" },
    { t: "Phụ huynh: /register/roster - liên kết PH - HS và cấp tài khoản đăng nhập cổng PH (tick 'Cấp tài khoản', nhập email + mật khẩu)" },
    { sub: ["PH login vào /portal/parent chỉ thấy đúng con mình (RLS parent_students)"] },
    { t: "Cuối tuần/tháng: báo cáo chuyên cần, hạnh kiểm theo TT22 (HK1/HK2/cả năm tách biệt)" },
    { t: "Sổ CN số: /register/* - sổ theo dõi, ký duyệt, xuất file" },
  ]);
  note(s, "Test chuyên gia: điểm danh → kiểm tra DB đồng bộ period_log; gửi thông báo → PH nhận email + in-app.");
}

// ---------- S6 Workflow Studio ----------
{
  const s = p.addSlide();
  slideTitle(s, "WORKFLOW 2", "Giáo viên bộ môn - biên soạn trên Studio");
  bullets(s, [
    { t: "Vào /studio → chọn công cụ DC-01..DC-06 → điền môn/khối/bài → Sinh (AI hoặc fallback rule-based)" },
    { sub: ["Môn học tự preselect theo môn phụ trách của GV (admin gán ở /school/users)", "Công thức toán viết LaTeX $...$, render KaTeX, xuất DOCX thành Word Equation native"] },
    { t: "Chỉnh sửa trực tiếp trên tài liệu → Lưu vào Thư viện của tôi" },
    { t: "Gửi duyệt (nút Gửi duyệt) → tổ trưởng nhận notification → BGH duyệt cuối → published" },
    { t: "Xuất: DOCX (đề/KHBĐ/phiếu), PDF (trang in), PPTX (DC-06)" },
  ]);
  note(s, "AI sinh nội dung theo YCCĐ thật; nếu LLM hết quota → engine fallback bất đồng bộ qua ai_jobs.");
}

// ---------- S7 DC-01 ----------
{
  const s = p.addSlide();
  slideTitle(s, "CÔNG CỤ DC-01", "Kế hoạch bài dạy (KHBĐ)");
  bullets(s, [
    { t: "Input: Môn / Khối / Bài học (chọn YCCĐ từ chương trình) / Số tiết / Mẫu KHBĐ" },
    { sub: ["Mẫu: hệ thống (khung 4 HĐ theo CV 5512) hoặc mẫu riêng của trường (/studio/mau-khbd - admin tạo mẫu, đặt mặc định)"] },
    { t: "Output: KHBĐ đầy đủ - mục tiêu (phẩm chất/năng lực/YCCĐ), đồ dùng, hoạt động, điều chỉnh" },
    { t: "Xuất DOCX - in để ký duyệt" },
    { t: "Test point cho chuyên gia: hoạt động có đúng logic sư phạm tiểu học? YCCĐ gán có khớp bài?" },
  ]);
}

// ---------- S8 DC-02/03 ----------
{
  const s = p.addSlide();
  slideTitle(s, "CÔNG CỤ DC-02 + DC-03", "Ma trận đề và sinh đề kiểm tra");
  bullets(s, [
    { t: "DC-02: chọn môn/khối/đợt KT (thường xuyên, giữa kì, cuối kì) → ma trận theo phân bố YCCĐ × mức độ (Nhận biết/Hiểu/Vận dụng)" },
    { sub: ["Đợt giữa kì cho lớp 1-3 sẽ cảnh báo TT22 (không bắt buộc KT giấy)"] },
    { t: "DC-03: chọn ma trận → rút câu từ NGÂN HÀNG CỦA TRƯỜNG → đề chính thức + đề dự phòng + bảng đáp án phân biệt" },
    { sub: ["Ô ma trận thiếu câu → báo THIẾU trung thực, không lấy câu sai YCCĐ", "Tick \"Chỉ câu đã duyệt\" → chỉ rút câu approved"] },
    { t: "Xuất DOCX gồm 3 tab/phần: Đề + Đề dự phòng + Đáp án/HDC" },
  ]);
  note(s, "Test: tạo ma trận GK1 Toán lớp 4 → sinh đề → kiểm tra đúng ma trận, đúng thang điểm, đáp án khớp.");
}

// ---------- S9 DC-04..06 ----------
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
    { t: "Mọi công cụ: lưu thư viện → gửi duyệt → xuất file; AI sinh có kiểm chứng (schema + YCCĐ gate)", y: 4.6 },
  ], { y: 4.6, fontSize: 12.5 });
}

// ---------- S10 Question bank ----------
{
  const s = p.addSlide();
  slideTitle(s, "NGÂN HÀNG CÂU HỎI", "Ngân hàng chung của trường (/studio/questions)");
  bullets(s, [
    { t: "GV cùng trường đóng góp chung - không còn bank cá nhân; filter: Cả trường / Của tôi / Môn của tổ tôi" },
    { t: "Thêm tay hoặc import ảnh/PDF (AI đọc) hoặc template Excel; validate tự động: đúng qtype, mức độ TT22, YCCĐ, stem tham chiếu hình phải kèm media/context" },
    { t: "Duyệt: checkbox từng câu hoặc bulk duyệt cả trang; trạng thái: chưa duyệt → đã duyệt / đánh dấu lỗi" },
    { t: "Hình ảnh trong câu hỏi (CR-031): upload ảnh HOẶC hình vẽ tham số (SVG) cho Toán - tam giác, HCN, tròn, đoạn thẳng, góc, đồng hồ; render trong đề DOCX/PPTX" },
    { t: "Câu nghe Tiếng Anh: transcript ở Ngữ cảnh + nút Nghe thử (TTS trình duyệt)" },
  ]);
  note(s, "Hiện có ~1 400 câu/trường test, 100% đã duyệt trong bank demo; đủ coverage YCCĐ tiểu học (Toán/TV/Anh).");
}

// ---------- S11 Media ----------
{
  const s = p.addSlide();
  slideTitle(s, "HÌNH ẢNH TRONG CÂU HỎI", "2 cơ chế - quyết định quan trọng về chất lượng");
  bullets(s, [
    { t: "Hình học Toán: SVG tham số (deterministic) - KHÔNG dùng AI sinh ảnh", b: 1 },
    { sub: ["Đề thi Toán đòi chính xác góc/tỉ lệ; AI sinh ảnh sẽ sai. Figure spec → SVG → PNG trong DOCX", "Thêm hình: select '+ Hình vẽ' → chọn loại → sửa tham số JSON (nhãn đỉnh, độ dài, góc, giờ)"] },
    { t: "Ảnh minh họa TV/Anh: upload ảnh lên (lưu storage theo trường) + alt text", b: 1 },
    { sub: ["Giới hạn 4 media/câu; ảnh resize ≤480px khi xuất DOCX"] },
    { t: "Trong đề DOCX: hình chèn ngay sau stem câu; PPTX: ảnh trên slide", b: 1 },
  ]);
}

// ---------- S12 Review ----------
{
  const s = p.addSlide();
  slideTitle(s, "QUY TRÌNH DUYỆT 2 LỚP", "Tác giả → Tổ trưởng → BGH → published");
  bullets(s, [
    { t: "Lớp 1 - Tổ trưởng chuyên môn:", b: 1 },
    { sub: ["Ngân hàng: filter 'Môn của tổ tôi' mặc định - chỉ thấy môn tổ mình phụ trách", "Thư viện: 'Chờ duyệt - môn của tổ tôi' xếp trên, môn khác xếp dưới", "Duyệt / trả về kèm nhận xét → tác giả nhận notification"] },
    { t: "Lớp 2 - BGH/admin:", b: 1 },
    { sub: ["Thấy tất cả, duyệt cuối → status published; có thể sửa câu của GV (audit)"] },
    { t: "Mọi thao tác ghi audit trail (ai, làm gì, lúc nào)", b: 1 },
  ]);
  note(s, "Test: GV tạo câu → gửi → tổ trưởng thấy đúng môn mình → duyệt → BGH duyệt → kiểm tra notification.");
}

// ---------- S13 Admin ----------
{
  const s = p.addSlide();
  slideTitle(s, "QUẢN TRỊ TRƯỜNG", "Trang /school/users - BGH/admin của từng trường");
  bullets(s, [
    { t: "Thêm giáo viên: email + mật khẩu + vai trò + cơ sở + tổ + mã cán bộ + loại hợp đồng + trình độ" },
    { t: "Gán môn phụ trách (chip multi-select → teacher_subjects) - Studio tự preselect môn cho GV" },
    { t: "Tổ chuyên môn - môn học: gán môn cho tổ; hệ thống cảnh báo vàng khi GV dạy môn khác tổ" },
    { t: "Ma trận quyền chức năng: 6 chức năng × 6 vai trò, 3 trạng thái (mặc định/cấm/cho) + quyền riêng từng GV" },
    { t: "ACL dữ liệu: ẩn một câu hỏi/học liệu cụ thể với một GV - GV khác vẫn thấy (RLS level)" },
    { t: "Thống kê nhanh: số GV theo vai trò + loại hợp đồng (đếm cả 'chưa khai báo')" },
  ]);
}

// ---------- S13b Onboarding truong (CR-034) ----------
{
  const s = p.addSlide();
  slideTitle(s, "ONBOARDING TRƯỜNG MỚI", "Tự phục vụ: Sở GD tạo trường → admin trường tự vận hành");
  bullets(s, [
    { t: "Bước 1 - Sở GD/admin hệ thống: /dept/schools → 'Tạo trường'", b: 1 },
    { sub: ["Nhập tên, mã, cấp học (Tiểu học/THCS/THPT), email + mật khẩu admin trường (vai trò BGH)", "Tick 'Seed dữ liệu mẫu' → hệ thống tự tạo năm học 2026-2027, 2 tổ CM, bộ môn theo cấp, lớp mẫu + HS mẫu", "Lỗi giữa chừng → hệ thống rollback và báo rõ phần chưa dọn - không trường 'nửa vời'"] },
    { t: "Bước 2 - Admin trường (BGH): đăng nhập → /school/users → '+ Thêm giáo viên'", b: 1 },
    { sub: ["Tự tạo tài khoản GV/GVCN/tổ trưởng/kế toán trong phạm vi trường mình - không cần đội kỹ thuật", "Import danh sách HS qua Excel tại /records/upload (mã HS, CCCD, họ tên, ngày sinh, giới tính)"] },
    { t: "Bước 3 - GVCN: /register/roster liên kết PH - HS và cấp tài khoản cổng PH", b: 1 },
    { t: "Giám sát - Sở GD: /dept/usage", b: 1 },
    { sub: ["Bảng theo trường: tổng user, active 24h, active 7d, lần đăng nhập gần nhất", "Bảng user: tên, vai trò, trường, last sign-in - đo mức độ dùng của từng trường pilot"] },
  ]);
  note(s, "Demo gate 15/10: trường tự đăng nhập dùng thử - quy trình trên là toàn bộ onboarding.");
}

// ---------- S14 Highlights ----------
{
  const s = p.addSlide();
  slideTitle(s, "ĐIỂM NỔI BẬT", "Khác biệt so với nền tảng thông thường");
  bullets(s, [
    { t: "Bám quy định thật: YCCĐ CTGDPT 2018 chi tiết đến strand; TT22/2021 (HK1/HK2/năm tách, không KT giấy lớp 1-3 giữa kì); TT27/2025", c: C.accent },
    { t: "Ngân hàng trường + duyệt 2 lớp + audit trail - kiểm soát chất lượng đề như trường thật vận hành", c: C.accent },
    { t: "Hình học deterministic (không AI ảo) + xuất Word Equation native - in thi thật dùng được ngay", c: C.accent },
    { t: "Phân quyền chức năng + dữ liệu tới item-level ACL - admin trường tự quản, không cần IT", c: C.accent },
    { t: "Multi-tenant RLS nghiêm ngặt + DPIA theo Luật 91/2025 - sẵn sàng pilot liên trường", c: C.accent },
    { t: "AI provider linh hoạt (Gemini/OpenAI/Anthropic qua env) + fallback engine + rule-based - không chết khi hết quota", c: C.accent },
  ]);
}

// ---------- S15 Test checklist ----------
{
  const s = p.addSlide();
  slideTitle(s, "CHECKLIST TEST CHUYÊN GIA", "Các kịch bản ưu tiên rà soát");
  bullets(s, [
    { t: "NỘI DUNG: đọc kỹ câu hỏi bank (đáp án đúng? phù hợp lứa tuổi? ngôn ngữ tiểu học?); KHBĐ có đúng flow sư phạm? YCCĐ gán khớp?", b: 1 },
    { t: "ĐỀ THI: sinh đề GK1 Toán 4-5 + TV 4-5 → check ma trận, điểm, đáp án, hình vẽ, định dạng in", b: 1 },
    { t: "WORKFLOW: đóng góp → duyệt tổ → duyệt BGH → notification đúng người", b: 1 },
    { t: "PHÂN QUYỀN: gvbm không duyệt được; tổ trưởng chỉ thấy môn tổ; phụ huynh không vào được bank", b: 1 },
    { t: "EDGE CASES: câu nói 'như hình' không hình → bị chặn; import Excel sai format → báo lỗi rõ; câu trùng stem → cảnh báo dedupe", b: 1 },
  ]);
}

// ---------- S16 Feedback ----------
{
  const s = p.addSlide();
  slideTitle(s, "BÁO LỖI & FEEDBACK", "Cách ghi nhận kết quả test");
  bullets(s, [
    { t: "Format bug report: [Vai trò] + [Trang/thao tác] + [Kết quả thực tế] vs [Kết quả mong đợi] + [Ảnh chụp nếu có]" },
    { t: "Lỗi nội dung chuyên môn (đáp án sai, YCCĐ sai, ngôn ngữ): dùng nút 'Đánh dấu lỗi' ngay trên câu hỏi - hệ thống giữ trạng thái flagged để rà lại" },
    { t: "Mức độ: Blocker (sai đáp án/mất dữ liệu/lộ dữ liệu trường khác) | Major (sai workflow, sai phân quyền) | Minor (UI/copy)" },
    { t: "Môi trường test data thoải mái - mọi thứ trường test (nd/cva/kd.test) là dữ liệu giả, không sợ phá" },
  ]);
  note(s, "Cảm ơn đội chuyên gia! Mọi góp ý nội dung sẽ được đội phát triển xử lý theo CR.");
}

mkdirSync("docs/handover", { recursive: true });
await p.writeFile({ fileName: "docs/handover/USER-GUIDE-vieschool.pptx" });
console.log("Written docs/handover/USER-GUIDE-vieschool.pptx");
