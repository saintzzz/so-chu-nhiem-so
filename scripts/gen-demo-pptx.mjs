/**
 * CR-039: Kich ban demo dang slide cho doi ban hang / chuyen gia giao duc.
 * node scripts/gen-demo-pptx.mjs -> docs/user-guide/KICH-BAN-DEMO.pptx
 * Dong bo noi dung voi docs/user-guide/KICH-BAN-DEMO.md (CR-036 + CR-038).
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
            ...(it.t
              ? [{ text: String(it.t), options: { bullet: { code: "2022", indent: 14 }, breakLine: true, bold: !!it.b, color: it.c ?? C.ink } }]
              : []),
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
          fontFace: FONT, fontSize: i === 0 ? 11 : 10.5, bold: i === 0,
          color: i === 0 ? C.white : C.ink,
          fill: { color: i === 0 ? C.accent : i % 2 ? C.white : C.bg },
          valign: "middle", margin: 0.08,
        },
      })),
    ),
    { x: opts.x ?? 0.7, y: opts.y ?? 1.95, w: opts.w ?? 12, border: { pt: 0.75, color: C.line }, rowH: opts.rowH ?? 0.4, colW: opts.colW },
  );
}

function note(s, txt, y = 6.9) {
  s.addText(txt, { x: 0.7, y, w: 12, h: 0.5, fontFace: FONT, fontSize: 10.5, italic: true, color: C.accent });
}

/* ===================== SLIDES ===================== */

// S1 - Cover
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addText("KỊCH BẢN DEMO - SỔ CHỦ NHIỆM SỐ & CÔNG CỤ SỐ GIÁO VIÊN", {
    x: 0.8, y: 2.0, w: 11.7, h: 1.0, fontFace: FONT, fontSize: 32, bold: true, color: C.white,
  });
  s.addText("Một nền tảng: số hóa công tác chủ nhiệm + Studio TVC360 tích hợp - VieSchool", {
    x: 0.8, y: 3.0, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 15, color: "5eead4",
  });
  s.addText([
    { text: "URL demo: https://sochunhiem.vieschool.com", options: { breakLine: true } },
    { text: "Mật khẩu demo chung: demo1234", options: { breakLine: true } },
    { text: "Phiên bản: demo 15/10/2026 - data thật + vai trò kiêm nhiệm + Studio (A-03 audio, ngân hàng đã dọn trùng)", options: {} },
  ], { x: 0.8, y: 3.9, w: 11.7, h: 1.3, fontFace: FONT, fontSize: 13, color: "94a3b8", paraSpaceAfter: 6 });
}

// S2 - Muc tieu
{
  const s = p.addSlide();
  slideTitle(s, "GIỚI THIỆU", "Mục tiêu buổi demo", "30-40 phút - theo luồng công việc thật của trường");
  bullets(s, [
    { t: "Chứng minh hệ thống gánh được công việc thật", b: true, sub: [
      "Không phải màn hình mẫu - dữ liệu liên thông điểm danh, điểm, sổ đầu bài, phụ huynh",
      "Quy trình đủ vòng: GVCN ghi nhận -> tổ trưởng duyệt -> BGH phê duyệt -> phụ huynh nhận",
    ] },
    { t: "Chứng minh phân quyền đúng thực tế trường VN", b: true, sub: [
      "Vai trò kiêm nhiệm: GVCN vẫn dạy môn, tổ trưởng vẫn đứng lớp, PHT/HT vẫn có tiết",
      "Phạm vi dữ liệu: trường - cơ sở - tổ - lớp chủ nhiệm - con mình",
      "Mỗi vai trò chỉ nhìn thấy chức năng mình được cấp (menu + route + database)",
    ] },
    { t: "Chứng minh bám quy định Bộ GD&ĐT", b: true, sub: [
      "TT 22/2021 đánh giá (điểm số THCS, mức độ tiểu học); TT 15/2026 Điều lệ trường",
      "Kế hoạch bài dạy theo biểu mẫu CV 5512; NQ 37 định mức biên chế",
    ] },
  ]);
}

// S3 - Boi canh du lieu
{
  const s = p.addSlide();
  slideTitle(s, "DỮ LIỆU DEMO", "3 trường - quy mô như trường thật", "Seed theo cơ cấu tổ chức chuẩn: tổ chuyên môn, phân môn, TKB đầy đủ");
  table(s, [
    ["Trường", "Lớp", "Học sinh", "Cán bộ", "Đặc điểm demo"],
    ["THCS Nguyễn Du", "12 lớp (6A1-9A3)", "~435", "34", "2 cơ sở - demo giới hạn PHT; 4 tổ chuyên môn"],
    ["TH Chu Văn An", "15 lớp (1A1-5A3)", "~500", "30", "4 tổ theo khối; đánh giá mức độ TT 22"],
    ["TH Kim Đồng", "10 lớp (1A1-5A2)", "~340", "22", "3 tổ; trường nhỏ"],
  ], { colW: [3.2, 2.6, 1.6, 1.4, 4.2] });
  bullets(s, [
    { t: "Mỗi trường có đủ nhân sự thực tế:", b: true, sub: [
      "Hiệu trưởng + Phó hiệu trưởng, kế toán, tổ trưởng, GVCN từng lớp, GVBM phân tổ + phân môn",
      "Mã nhân viên, loại hợp đồng, trình độ, cơ sở công tác - như hồ sơ nhân sự thật",
    ] },
    { t: "Dữ liệu nghiệp vụ đã chạy sẵn:", sub: [
      "TKB 985/985 tiết có giáo viên; điểm, chuyên cần, hạnh kiểm, hoạt động, sự cố, cảnh báo sớm",
      "Ngân hàng câu hỏi TVC360: 360 câu/trường gán đúng giáo viên bộ môn",
    ] },
  ], { y: 4.0 });
}

// S4 - Tai khoan
{
  const s = p.addSlide();
  slideTitle(s, "TÀI KHOẢN DEMO", "Đăng nhập theo vai trò - mật khẩu chung demo1234", "Tài khoản chính của THCS Nguyễn Du (trường khác: @cva.scn / @kd.scn)");
  table(s, [
    ["Vai trò", "Tài khoản", "Nhân sự & kiêm nhiệm"],
    ["Hiệu trưởng", "hainv@nd.scn", "Nguyễn Văn Hải - kiêm dạy (bgh + gvbm)"],
    ["PHT cơ sở 2", "duclm@nd.scn", "Lê Minh Đức - chỉ lớp A3, kiêm dạy (pht + gvbm)"],
    ["Tổ trưởng", "hanhlth@nd.scn", "Lê Thị Hồng Hạnh - Tổ Toán-TN (to_truong + gvbm)"],
    ["GVCN 8A2", "anhptl@nd.scn", "Phạm Thị Lan Anh - GVCN + dạy Toán + Tổ trưởng (3 vai trò)"],
    ["GVBM Vật lý", "minhtv@nd.scn", "Trần Văn Minh - đơn vai trò (đối chứng)"],
    ["Kế toán", "trangpt@nd.scn", "Phạm Thu Trang"],
    ["Phụ huynh", "annv@nd.scn", "Nguyễn Văn An - bố em Nguyễn Gia Bảo (8A2)"],
    ["Học sinh", "baong@nd.scn", "Nguyễn Gia Bảo - lớp 8A2"],
    ["Sở GD&ĐT", "sovqt@demo.scn", "Vũ Quản Trị Sở - giám sát cả 3 trường"],
    ["UBND", "daonvl@demo.scn", "Ngô Văn Lãnh Đạo - dashboard địa bàn, chỉ đọc"],
    ["Quản trị", "admin@demo.scn", "Toàn hệ thống"],
  ], { colW: [2.4, 3.0, 6.8], rowH: 0.34 });
}

// S5 - Diem nhan multi-role
{
  const s = p.addSlide();
  slideTitle(s, "ĐIỂM NHẤN", "Vai trò kiêm nhiệm - đúng thực tế trường học", "CR-038: vai trò chính + vai trò kiêm nhiệm, tính quyền ở mọi tầng");
  bullets(s, [
    { t: "Bài toán thật:", b: true, sub: [
      "GVCN luôn kiêm dạy bộ môn; tổ trưởng vẫn đứng lớp; PHT/Hiệu trưởng vẫn có tiết dạy",
      "Hệ thống một vai trò duy nhất bóp méo thực tế - người dùng phải đăng xuất đổi tài khoản",
    ] },
    { t: "Cách hệ thống xử lý:", b: true, sub: [
      "profiles.role = vai trò chính; concurrent_roles = vai trò kiêm nhiệm (gvcn, gvbm, to_truong, bgh, pht)",
      "Menu gộp tất cả chức năng của mọi vai trò, tự loại trùng; topbar hiển thị đủ nhãn",
      "Quyền = vai trò chính + kiêm nhiệm, kiểm soát ở UI + server action + chính sách database (RLS)",
    ] },
    { t: "An toàn:", b: true, sub: [
      "Phạm vi dữ liệu vẫn tách vai trò: GVCN chỉ lớp mình, PHT chỉ cơ sở mình, tổ trưởng chỉ tổ mình",
      "Không thể tự gán vai trò kiêm nhiệm quyền cao - trigger database chặn leo quyền",
      "BGH phân vai trò kiêm nhiệm tại trang Tài khoản giáo viên (/school/users)",
    ] },
  ]);
}

// S6 - Luong A1
{
  const s = p.addSlide();
  slideTitle(s, "LUỒNG A - GVCN MỘT NGÀY (1/2)", "anhptl@nd.scn - cô Phạm Thị Lan Anh, lớp 8A2", "~5 phút - mở đầu bằng điểm nhấn 3 vai trò trên topbar và menu gộp");
  bullets(s, [
    { t: "1. Dashboard lớp chủ nhiệm", b: true, sub: [
      "Sĩ số 8A2, tỷ lệ chuyên cần, cảnh báo sớm, việc cần xử lý trong ngày",
      "Kèm các lớp cô đang dạy Toán - vì cô kiêm GVBM",
    ] },
    { t: "2. Điểm danh hàng ngày (/attendance/daily)", b: true, sub: [
      "Đánh vắng 1 em -> kiểm chứng: sổ đầu bài đồng bộ + phụ huynh nhận thông báo",
      "Đây là tính năng 'cross-module': một ghi nhận, ba nơi cập nhật",
    ] },
    { t: "3. Sổ điểm (/academics/grades)", b: true, sub: [
      "Lớp 8A2 đã có điểm miệng/15'/giữa kỳ các môn",
      "Nhập thêm điểm Toán (cô dạy Toán 8A2) - hệ thống chỉ cho nhập môn mình dạy",
    ] },
    { t: "4. Sổ đầu bài + sơ đồ chỗ ngồi", sub: [
      "TKB đã xếp sẵn; ghi nhật ký tiết dạy; sơ đồ lớp có sẵn từ đầu năm",
    ] },
  ]);
  note(s, "Nói với khán giả: 'Cô Lan Anh chỉ cần 1 tài khoản cho cả 3 công việc - đây là thực tế của 90% giáo viên chủ nhiệm.'");
}

// S7 - Luong A2
{
  const s = p.addSlide();
  slideTitle(s, "LUỒNG A - GVCN MỘT NGÀY (2/2)", "Soạn giáo án, liên lạc phụ huynh, hồ sơ lớp", "~5 phút");
  bullets(s, [
    { t: "5. Kế hoạch bài dạy (/academics/lesson-plans)", b: true, sub: [
      "Soạn KHBD theo biểu mẫu cấu trúc CV 5512: mục tiêu - thiết bị - 4 hoạt động đủ a,b,c,d,đ",
      "Nộp giáo án -> chuyển hàng chờ cho tổ trưởng (luồng B)",
      "Có thể soạn nhanh bằng Studio DC-01 (AI/rule-based cùng khung 5512)",
    ] },
    { t: "6. Liên lạc phụ huynh (/parents/compose)", b: true, sub: [
      "Gửi thông báo cho PH lớp -> sang luồng D kiểm chứng PH nhận được",
      "Kênh email thật (Resend); hộp thư phản hồi hai chiều",
    ] },
    { t: "7. Hồ sơ lớp (/register/roster)", b: true, sub: [
      "Danh sách HS sắp theo tên gọi Việt Nam, ban cán sự, tổ/nhóm, liên kết PH sẵn",
      "Upload danh sách HS bằng Excel/CSV khi đầu năm (/records/upload)",
    ] },
  ]);
}

// S8 - Luong B
{
  const s = p.addSlide();
  slideTitle(s, "LUỒNG B - PHÊ DUYỆT 2 CẤP", "hanhlth@nd.scn rồi hainv@nd.scn", "~5 phút - chứng minh quy trình quản trị chuyên môn");
  bullets(s, [
    { t: "1. Tổ trưởng duyệt (cô Hạnh - Tổ Toán-Tự nhiên)", b: true, sub: [
      "Menu 'Tổ chuyên môn' -> Duyệt giáo án: thấy giáo án của GV trong tổ mình",
      "Xem bản cấu trúc CV 5512 -> Duyệt (hoặc trả về kèm nhận xét)",
      "Cô Lan Anh (đang là GVCN) cũng mở được trang này vì kiêm tổ trưởng",
    ] },
    { t: "2. BGH phê duyệt (thầy Hải)", b: true, sub: [
      "Trung tâm phê duyệt (/school/approvals): giáo án 'team_approved' trong hàng chờ",
      "Duyệt -> trạng thái 'approved', giáo viên nhận thông báo tự động",
    ] },
    { t: "3. Điểm nhấn", b: true, sub: [
      "Phạm vi tổ: tổ trưởng chỉ thấy giáo án của tổ mình",
      "Phạm vi trường: BGH thấy toàn trường; trạng thái ghi nhận từng cấp trong database",
    ] },
  ]);
}

// S9 - Luong C
{
  const s = p.addSlide();
  slideTitle(s, "LUỒNG C - ĐIỀU HÀNH TRƯỜNG", "hainv@nd.scn + đối chứng duclm@nd.scn", "~8 phút");
  bullets(s, [
    { t: "1. Dashboard BGH (/school/dashboard)", b: true, sub: [
      "KPI toàn trường: chuyên cần, sự cố, radar cảnh báo sớm, tình hình phê duyệt",
    ] },
    { t: "2. TKB + phân công + nhân sự", b: true, sub: [
      "TKB toàn trường: 360 tiết/tuần của 12 lớp, không tiết trống (import Excel được)",
      "Phân công năm học: GVCN từng lớp + GVBM phân môn",
      "Nhân sự: 34 cán bộ có mã NV, hợp đồng, trình độ, tổ chuyên môn",
    ] },
    { t: "3. Đối chứng PHT (đổi tài khoản duclm@nd.scn)", b: true, sub: [
      "Cùng màn hình nhưng chỉ thấy 4 lớp A3 của Cơ sở 2 - giới hạn phạm vi thật",
      "PHT không thấy mục 'Học sinh toàn trường' (hồ sơ chi tiết chỉ dành BGH - TT15)",
    ] },
    { t: "4. Báo cáo cấp trên (/dept từ sogd)", sub: [
      "Sở GD&ĐT tổng hợp cả 3 trường trên cùng dashboard",
    ] },
  ]);
}

// S10 - Luong D
{
  const s = p.addSlide();
  slideTitle(s, "LUỒNG D - PHỤ HUYNH & HỌC SINH", "annv@nd.scn, baong@nd.scn", "~5 phút - cổng thông tin hai chiều");
  bullets(s, [
    { t: "1. Cổng phụ huynh (/portal/parent)", b: true, sub: [
      "Chỉ thấy con mình: Nguyễn Gia Bảo - 8A2",
      "Điểm, chuyên cần, hạnh kiểm, thông báo từ GVCN gửi ở luồng A (và email thật)",
    ] },
    { t: "2. Trao đổi hai chiều", b: true, sub: [
      "Nhắn tin cho GVCN, đặt lịch hẹn -> cô Lan Anh nhận thông báo",
    ] },
    { t: "3. Cổng học sinh (/portal/student)", b: true, sub: [
      "TKB của 8A2, điểm, hạnh kiểm, thông báo - giao diện riêng cho HS",
    ] },
  ]);
  note(s, "Điểm nhấn riêng tư: phụ huynh chỉ truy cập hồ sơ con mình - không xem được học sinh khác kể cả cùng lớp.");
}

// S11 - Luong E+F
{
  const s = p.addSlide();
  slideTitle(s, "LUỒNG E+F - CẤP TRÊN & TRƯỜNG TIỂU HỌC", "sovqt, daonvl, oanhdtk", "~6 phút");
  bullets(s, [
    { t: "E1. Sở GD&ĐT (sovqt@demo.scn)", b: true, sub: [
      "Tổng hợp 3 trường trên một dashboard; /dept/schools tạo trường mới",
      "/dept/usage giám sát mức độ sử dụng từng trường",
    ] },
    { t: "E2. UBND (daonvl@demo.scn)", b: true, sub: [
      "Dashboard địa bàn - chỉ đọc, không có nút ghi",
    ] },
    { t: "F1. Tiểu học Chu Văn An (oanhdtk@cva.scn)", b: true, sub: [
      "Đánh giá theo MỨC ĐỘ (không phải điểm số) - đúng TT 22/2021 cho tiểu học",
      "Cô Oanh GVCN 3A2 cũng là tổ trưởng Tổ Khối 3 - kiêm nhiệm như THCS",
    ] },
    { t: "F2. Đa trường, một hệ thống", b: true, sub: [
      "Cùng một nền tảng phục vụ TH và THCS - cấu hình theo cấp học",
      "Dữ liệu cô lập tuyệt đối: BGH trường này không thấy trường kia",
    ] },
  ]);
}

// S11b - Luong H Studio
{
  const s = p.addSlide();
  slideTitle(s, "LUỒNG H - STUDIO CÔNG CỤ SỐ (TVC360)", "minhtv@nd.scn hoặc anhptl@nd.scn - /studio trong cùng app", "~5 phút - chứng minh 2 module trên một nền tảng");
  bullets(s, [
    { t: "1. Tất cả công cụ (/studio)", b: true, sub: [
      "Nhóm DC-01..06: KHBĐ CV 5512, ma trận đề, đề kiểm tra, bộ câu hỏi, phiếu học tập, bài trình chiếu",
      "Nhóm chuyên môn: Toán (T-01/02), Văn (V-01/02), Anh (A-01..03) - môn tự preselect theo phân công",
    ] },
    { t: "2. DC-02 -> DC-03: ma trận -> đề kiểm tra", b: true, sub: [
      "Ma trận YCCĐ x mức độ đúng tỷ lệ; đề rút câu từ ngân hàng CỦA TRƯỜNG + đáp án + biên bản phản biện",
    ] },
    { t: "3. Ngân hàng câu hỏi (/studio/questions)", b: true, sub: [
      "Đã dọn trùng: mỗi câu gộp đủ YCCĐ, không còn bản lặp; Ngữ văn chỉ khối 6-12 (Tiếng Việt 1-5)",
      "Duyệt 2 lớp: tổ trưởng -> BGH; filter 'Môn của tổ tôi' cho tổ trưởng kiêm nhiệm",
    ] },
    { t: "4. A-03: hội thoại + bài nghe có AUDIO THẬT", b: true, sub: [
      "Sinh hội thoại -> audio giọng neural phát ngay (material mẫu 'At the Market' lớp 5, login anhhd@cva.scn)",
    ] },
    { t: "5. Xuất DOCX/PDF/PPTX - học liệu published cả trường xem, nháp chỉ tác giả + người duyệt", sub: [
      "AI có kiểm chứng 2 lớp + fallback rule-based khi hết quota - demo không đứng",
    ] },
  ]);
  note(s, "Thông điệp: giáo viên không cần app thứ hai - soạn, duyệt, xuất ngay trong sổ chủ nhiệm.");
}

// S12 - Security smoke
{
  const s = p.addSlide();
  slideTitle(s, "KIỂM CHỨNG PHÂN QUYỀN", "Security smoke - 6 phép thử nhanh", "Chạy trực tiếp trong buổi demo nếu khán giả yêu cầu");
  table(s, [
    ["Kiểm tra", "Cách demo", "Kỳ vọng"],
    ["Cô lập trường", "phuongttm@cva.scn mở URL chức năng trường ND", "Chỉ thấy dữ liệu Chu Văn An"],
    ["Giới hạn PHT", "duclm@nd.scn xem danh sách lớp", "Chỉ 4 lớp A3 - Cơ sở 2"],
    ["GVBM không quyền CN", "minhtv@nd.scn vào route chủ nhiệm", "Redirect về trang chủ GVBM"],
    ["PH chỉ thấy con mình", "annv@nd.scn", "Chỉ hồ sơ em Nguyễn Gia Bảo"],
    ["UBND chỉ đọc", "daonvl@demo.scn", "Không có nút ghi nào"],
    ["Menu theo quyền", "Soi menu từng tài khoản", "Mỗi vai trò chỉ thấy chức năng được cấp"],
  ], { colW: [3.0, 4.8, 4.4], rowH: 0.42 });
  note(s, "Kiểm chứng tự động: node scripts/check-nav-access.mjs - 158 mục menu đối chiếu quyền từng route.");
}

// S13 - He thong phong thu
{
  const s = p.addSlide();
  slideTitle(s, "KIẾN TRÚC PHÂN QUYỀN", "3 lớp phòng thủ - không chỉ là ẩn menu", "Ẩn menu chỉ là bề nổi; quyền được ép ở mọi tầng");
  bullets(s, [
    { t: "Lớp 1 - Giao diện", b: true, sub: [
      "Menu gộp theo vai trò hiệu lực; mục nào không có quyền thì không hiện",
      "Nút ghi (duyệt, xóa, sửa) ẩn theo vai trò - UBND không thấy nút nào",
    ] },
    { t: "Lớp 2 - Route + Server action", b: true, sub: [
      "Mỗi trang gọi requireRoles - gõ URL trực tiếp cũng bị đẩy về trang chủ của vai trò",
      "Mỗi action gọi checkActionRole - không tin layout guard",
    ] },
    { t: "Lớp 3 - Database (RLS)", b: true, sub: [
      "158 chính sách row-level theo vai trò hiệu lực + phạm vi trường/cơ sở/tổ/lớp",
      "Leo quyền bị trigger chặn ngay trong database - kể cả gọi API trực tiếp",
    ] },
  ]);
}

// S14 - Ket thuc
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addText("HỎI ĐÁP & BƯỚC TIẾP THEO", {
    x: 0.8, y: 1.8, w: 11.7, h: 0.9, fontFace: FONT, fontSize: 30, bold: true, color: C.white,
  });
  s.addText([
    { text: "Sau buổi demo có thể:", options: { breakLine: true } },
    { text: "- Bàn giao tài khoản pilot cho trường tự trải nghiệm", options: { breakLine: true } },
    { text: "- Khởi tạo trường mới từ đầu theo docs/user-guide/KHOI-TAO-TRUONG-MOI.md", options: { breakLine: true } },
    { text: "  (file Excel mẫu kèm theo - nhập cán bộ, lớp, học sinh, phụ huynh, TKB một lần)", options: { breakLine: true } },
    { text: "- Re-seed lại dữ liệu demo bất cứ lúc nào: node scripts/seed-real-demo.mjs", options: {} },
  ], { x: 0.8, y: 2.9, w: 11.7, h: 2.6, fontFace: FONT, fontSize: 14, color: "94a3b8", paraSpaceAfter: 10 });
  s.addText("VieSchool - hệ sinh thái số cho trường học Việt Nam", {
    x: 0.8, y: 6.3, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 13, color: "5eead4",
  });
}

mkdirSync("docs/user-guide", { recursive: true });
await p.writeFile({ fileName: "docs/user-guide/KICH-BAN-DEMO.pptx" });
console.log("Wrote docs/user-guide/KICH-BAN-DEMO.pptx (15 slides)");
