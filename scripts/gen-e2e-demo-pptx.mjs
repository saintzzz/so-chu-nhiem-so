/**
 * Kich ban demo E2E - luong van hanh truong moi (bam ket qua lifecycle E2E
 * 23/23 PASS ngay 10/10/2026). Moi step kem screenshot that + file dinh kem.
 * node scripts/gen-e2e-demo-pptx.mjs -> docs/user-guide/KICH-BAN-DEMO-E2E.pptx
 * Assets: docs/demo/e2e-assets/ (screenshot + CSV mau).
 */
import PptxGenJS from "pptxgenjs";
import { mkdirSync, existsSync } from "node:fs";

const A = "docs/demo/e2e-assets";
const p = new PptxGenJS();
p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
p.layout = "W";

const C = {
  ink: "0f172a", muted: "475569", accent: "0f766e", accentL: "ccfbf1",
  white: "ffffff", bg: "f8fafc", line: "e2e8f0", code: "1e293b",
  amber: "b45309", red: "b91c1c", green: "15803d",
};
const FONT = "Segoe UI";
const shot = (f) => `${A}/${f}`;

function head(s, step, title, desc) {
  s.addText(step, { x: 0.55, y: 0.26, w: 12, h: 0.3, fontFace: FONT, fontSize: 11, color: C.accent, bold: true });
  s.addText(title, { x: 0.55, y: 0.52, w: 12.2, h: 0.6, fontFace: FONT, fontSize: 23, bold: true, color: C.ink });
  if (desc) s.addText(desc, { x: 0.55, y: 1.12, w: 12.2, h: 0.4, fontFace: FONT, fontSize: 12, color: C.muted });
  s.addShape(p.shapes.LINE, { x: 0.55, y: 1.55, w: 12.2, h: 0, line: { color: C.line, width: 1 } });
}

function steps(s, items, { x = 0.6, y = 1.75, w = 5.7, fontSize = 12 } = {}) {
  s.addText(
    items.flatMap((it) =>
      typeof it === "string"
        ? [{ text: it, options: { bullet: { indent: 14 }, breakLine: true } }]
        : it.h
          ? [{ text: it.h, options: { breakLine: true, bold: true, color: C.accent } }]
          : [
              { text: it.t, options: { bullet: { code: "2022", indent: 14 }, breakLine: true, color: it.c ?? C.ink, bold: !!it.b } },
              ...(it.sub ?? []).map((t) => ({ text: t, options: { bullet: { code: "2013", indent: 30 }, breakLine: true, color: C.muted, fontSize: fontSize - 1.5 } })),
            ],
    ),
    { x, y, w, h: 5.3, fontFace: FONT, fontSize, color: C.ink, paraSpaceAfter: 7, valign: "top" },
  );
}

function img(s, file, { x = 6.5, y = 1.75, w = 6.4, h = 4.6 } = {}) {
  if (!existsSync(shot(file))) return;
  s.addImage({ path: shot(file), x, y, w, h, sizing: { type: "contain", w, h }, border: { color: C.line, pt: 1 } });
  s.addText(file, { x, y: y + h + 0.05, w, h: 0.25, fontFace: FONT, fontSize: 9, color: C.muted, italic: true });
}

function attach(s, files, y = 6.55) {
  s.addText(
    [
      { text: "File đính kèm: ", options: { bold: true, color: C.accent } },
      { text: files.join("  |  "), options: { color: C.muted } },
    ],
    { x: 0.6, y, w: 12.3, h: 0.35, fontFace: FONT, fontSize: 10.5 },
  );
}

function note(s, txt, y = 6.95) {
  s.addText(txt, { x: 0.6, y, w: 12.3, h: 0.45, fontFace: FONT, fontSize: 10, italic: true, color: C.muted });
}

function table(s, rows, opts = {}) {
  s.addTable(
    rows.map((r, i) =>
      r.map((c) => ({
        text: String(c),
        options: {
          fontFace: FONT, fontSize: i === 0 ? 10.5 : 10, bold: i === 0,
          color: i === 0 ? C.white : (c.ok ? C.green : C.ink),
          fill: { color: i === 0 ? C.accent : i % 2 ? C.white : C.bg },
          valign: "middle", margin: 0.06,
        },
      })),
    ),
    { x: opts.x ?? 0.6, y: opts.y ?? 1.75, w: opts.w ?? 12.1, border: { pt: 0.75, color: C.line }, rowH: opts.rowH ?? 0.32, colW: opts.colW },
  );
}

/* ===================== SLIDES ===================== */

// S1 - Cover
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addText("KỊCH BẢN DEMO E2E\nLUỒNG VẬN HÀNH TRƯỜNG MỚI", {
    x: 0.8, y: 1.6, w: 11.7, h: 1.7, fontFace: FONT, fontSize: 32, bold: true, color: C.white,
  });
  s.addText("Từ khi Sở GD tạo trường đến khi phụ huynh xem được con em mình - chạy thật trên production, verify bằng database", {
    x: 0.8, y: 3.35, w: 11.7, h: 0.5, fontFace: FONT, fontSize: 15, color: "5eead4",
  });
  s.addText([
    { text: "URL: https://sochunhiem.vieschool.com", options: { breakLine: true } },
    { text: "Bám quy trình đầu năm học thật của trường THCS Việt Nam", options: { breakLine: true } },
    { text: "Đã chạy E2E tự động: 23/23 bước PASS (10/10/2026) - scripts/qa-lifecycle-e2e.mjs", options: { breakLine: true } },
    { text: "File đính kèm trong: docs/demo/e2e-assets/", options: {} },
  ], { x: 0.8, y: 4.15, w: 11.7, h: 1.6, fontFace: FONT, fontSize: 13, color: "94a3b8", paraSpaceAfter: 6 });
}

// S2 - Tong quan luong
{
  const s = p.addSlide();
  head(s, "TỔNG QUAN", "Luồng E2E: 6 stage, 23 bước kiểm", "Mỗi hành động trên UI đều được kiểm chứng lại bằng dữ liệu trong database");
  table(s, [
    ["Stage", "Vai trò", "Nội dung", "Kết quả E2E"],
    ["A", "Sở GD&ĐT (so_gd)", "Tạo trường mới: auto-seed năm học, 2 tổ chuyên môn, 14 môn học, tài khoản BGH", "5/5 PASS"],
    ["B", "Hiệu trưởng (bgh)", "Login lần đầu - tạo GVCN + GVBM - tạo lớp 6A1 - import CSV 6 HS - phân công GVCN - xem danh sách", "6/6 PASS"],
    ["C", "GVCN", "Điểm danh ngày (1 vắng KP) - liên kết PH + cấp tài khoản - deny-path - Studio AI generate", "5/5 PASS"],
    ["D", "GVBM", "Login - truy cập route cấm bị chặn + redirect về home riêng", "3/3 PASS"],
    ["E", "Phụ huynh", "Portal thấy đúng con em đã liên kết - audit log ghi đủ hành động", "3/3 PASS"],
    ["F", "Hệ thống", "Cleanup: xóa sạch trường test + auth users", "1/1 PASS"],
  ], { colW: [0.9, 1.9, 7.3, 2.0], y: 1.8, rowH: 0.52 });
  note(s, "Luồng này map 1-1 quy trình thật: Sở/Phòng cấp chỉ tiêu -> trường lập lớp -> phân công GVCN/GVBM -> GVCN nhận danh sách, điểm danh, liên kết phụ huynh.");
}

// S3 - Chuan bi
{
  const s = p.addSlide();
  head(s, "CHUẨN BỊ", "Tài khoản demo và file đính kèm", "Dữ liệu demo có sẵn trên production - mật khẩu chung: demo1234");
  table(s, [
    ["Vai trò", "Tài khoản", "Dùng cho stage"],
    ["Sở GD&ĐT", "sovqt@demo.scn", "A - tạo trường mới"],
    ["Hiệu trưởng", "hainv@nd.scn", "B - setup trường (demo thay cho BGH trường mới)"],
    ["GVCN", "anhptl@nd.scn", "C - điểm danh, liên kết PH"],
    ["GVBM", "minhtv@nd.scn", "D - kiểm tra phân quyền"],
    ["Phụ huynh", "annv@nd.scn", "E - cổng phụ huynh"],
  ], { colW: [2.2, 3.4, 6.5], y: 1.8, rowH: 0.45 });
  attach(s, ["docs/demo/e2e-assets/danh-sach-hoc-sinh-mau.csv (6 dòng HS mẫu)", "docs/qa/lifecycle-e2e-2026-10-10.json (kết quả 23 checks)"], 6.3);
  note(s, "Lưu ý trình diễn: khi demo trường mới tạo thật, dùng email BGH mới do Sở GD nhập ở stage A - account đó login được ngay (đã verify E2E).");
}

// S4 - Stage A
{
  const s = p.addSlide();
  head(s, "STAGE A - SỞ GD&ĐT", "Tạo trường mới (1 thao tác, hệ thống tự seed)", "Vai trò: sovqt@demo.scn - menu Điều hành / Trường học");
  steps(s, [
    { h: "Thao tác" },
    "Vào /dept/schools - bấm cấp trường (THCS)",
    "Nhập: tên trường, mã trường (in hoa), họ tên + email + mật khẩu BGH",
    "Bỏ tick 'Tạo dữ liệu demo' nếu muốn trường trống - bấm Tạo trường",
    { h: "Hệ thống tự tạo" },
    "1 năm học hiện tại - 2 tổ chuyên môn (Tự nhiên, Xã hội)",
    "14 môn học theo cấp - tài khoản BGH (login được ngay)",
    { h: "Kết quả E2E" },
    { t: "schools + academic_years + departments + subjects + profiles đều có row - audit 'school.provision'", c: C.green },
  ]);
  img(s, "a1-dept-schools.png");
  attach(s, ["(không cần file - thao tác trực tiếp trên UI)"], 6.45);
  note(s, "Thời gian đo được: ~5.5s cho toàn bộ tạo trường + seed.");
}

// S5 - Stage B1
{
  const s = p.addSlide();
  head(s, "STAGE B - HIỆU TRƯỞNG (1/4)", "Tạo tài khoản giáo viên", "Vai trò: BGH trường mới (demo: hainv@nd.scn) - menu Quản trị / Tài khoản giáo viên");
  steps(s, [
    { h: "Thao tác" },
    "Vào /school/users - bấm '+ Thêm giáo viên'",
    "Nhập họ tên - email tự đề xuất theo tên (có thể sửa) - mật khẩu - vai trò",
    "Tạo 2 tài khoản: 1 GVCN + 1 GVBM - form giữ mở để nhập tiếp",
    "Có thể gán cơ sở, tổ chuyên môn, mã cán bộ, loại hợp đồng",
    { h: "Kết quả E2E" },
    { t: "profiles có 2 row role gvcn + gvbm, đúng school_id - auth users login được", c: C.green },
    { h: "Điểm nói" },
    "Ma trận quyền chức năng ngay dưới: BGH bật/tắt feature theo vai trò hoặc từng GV",
  ]);
  img(s, "b1-school-users.png");
  note(s, "Thời gian: ~1.5s/tài khoản.");
}

// S6 - Stage B2
{
  const s = p.addSlide();
  head(s, "STAGE B - HIỆU TRƯỞNG (2/4)", "Tiếp nhận lớp mới 6A1", "Menu Hồ sơ lớp học / Tiếp nhận");
  steps(s, [
    { h: "Thao tác" },
    "Vào /records/intake - bấm 'Tiếp nhận lớp mới'",
    "Nhập tên lớp 6A1 - chọn khối 6 - Tạo lớp",
    { h: "Kết quả E2E" },
    { t: "classes row: school_id + academic_year_id đúng, status=active", c: C.green },
    { h: "Bám quy trình thật" },
    "Tương đương bước 'trường lập danh sách lớp' sau khi Sở/Phòng cấp chỉ tiêu",
    "Phần bốc thăm lớp công khai (lớp đầu cấp) là thủ tục ngoài app - kết quả nhập vào đây",
  ]);
  img(s, "b2-records-intake.png");
  note(s, "Thời gian: ~3.6s (bao gồm render danh sách lớp).");
}

// S7 - Stage B3
{
  const s = p.addSlide();
  head(s, "STAGE B - HIỆU TRƯỞNG (3/4)", "Import danh sách học sinh bằng CSV", "Menu Hồ sơ lớp học / Upload danh sách");
  steps(s, [
    { h: "Thao tác" },
    "Vào /records/upload - kéo thả hoặc chọn file CSV đính kèm",
    "Hệ thống parse + validate từng dòng: '6 dòng hợp lệ' + preview bảng",
    "Chọn 'Nhập vào lớp' = 6A1 - bấm 'Nhập 6 học sinh'",
    "Dòng lỗi (thiếu tên, sai ngày sinh/giới tính) bị chặn, không vào DB",
    { h: "Kết quả E2E" },
    { t: "students = 6 row đúng class_id - mã HS tự sinh HS000xxx", c: C.green },
    { h: "Điểm nói" },
    "Nhận header Việt (ma_hs, ho_ten...) lẫn Anh (code, full_name...)",
    "Có 'Tải template' .xlsx chuẩn - hoặc AI trích xuất từ văn bản dán",
  ]);
  img(s, "b3-upload-csv.png");
  attach(s, ["docs/demo/e2e-assets/danh-sach-hoc-sinh-mau.csv"], 6.45);
  note(s, "Thời gian: ~1.8s cho 6 HS.");
}

// S8 - Stage B4
{
  const s = p.addSlide();
  head(s, "STAGE B - HIỆU TRƯỞNG (4/5)", "Phân công GVCN cho lớp 6A1", "Menu Quản trị / Phân công năm học");
  steps(s, [
    { h: "Thao tác" },
    "Vào /school/assignments - bảng '1. Phân công GVCN': chọn GV cho 6A1 - 'Lưu phân công CN'",
    "Mục 2-3 cùng trang: gán môn phụ trách cho GVBM + xếp thời khóa biểu",
    { h: "Kết quả E2E" },
    { t: "classes.gvcn_id = profile GVCN (verify trực tiếp trong DB)", c: C.green },
    { h: "Bám quy trình thật" },
    "Tương đương bước 'phân công GVCN + GVBM theo phương án của trường'",
    "Trọn luôn bước 'phê duyệt TKB' đầu năm trên cùng màn",
  ]);
  img(s, "b4-assignments.png");
}

// S9 - Stage B5
{
  const s = p.addSlide();
  head(s, "STAGE B - HIỆU TRƯỞNG (5/5)", "Kiểm tra danh sách học sinh toàn trường", "Menu Học sinh & chất lượng / Danh sách học sinh");
  steps(s, [
    { h: "Thao tác" },
    "Vào /school/students - lọc theo lớp 6A1",
    "Đối chiếu đủ 6 em vừa import từ CSV",
    { h: "Kết quả E2E" },
    { t: "6/6 tên HS hiển thị - sort theo tên riêng (chuẩn Việt Nam)", c: C.green },
    { h: "Điểm nói" },
    "BGH thấy toàn bộ HS trường; GVCN chỉ thấy lớp mình chủ nhiệm",
    "Tìm kiếm + phân trang sẵn cho trường lớn (1.000+ HS)",
  ]);
  img(s, "b5-students.png");
}

// S10 - Stage C1
{
  const s = p.addSlide();
  head(s, "STAGE C - GVCN (1/2)", "Điểm danh hằng ngày", "Vai trò: GVCN vừa được phân công (demo: anhptl@nd.scn)");
  steps(s, [
    { h: "Thao tác /attendance/daily" },
    "Chọn ngày - lớp 6A1 hiện đủ 6 HS",
    "Chọn trạng thái từng em (chip: Có mặt / Vắng có phép / Không phép / Đi muộn) + ghi chú",
    "Bấm 'Xác nhận chuyên cần'",
    { h: "Kết quả E2E" },
    { t: "attendance_records: 6 rows đúng ngày, 1 unexcused + note 'QA vắng không phép'", c: C.green },
    { h: "Điểm nói" },
    "Mặc định 'Có mặt' - chỉ chạm vào em vắng/muộn: 1 lớp 45 em xong trong 30 giây",
    "Đồng bộ với sổ tiết (period log) - không lệch dữ liệu giữa 2 màn",
  ]);
  img(s, "c1-attendance.png");
  note(s, "Thời gian lưu: ~1.7s.");
}

// S11 - Stage C2
{
  const s = p.addSlide();
  head(s, "STAGE C - GVCN (2/2)", "Liên kết phụ huynh + cấp tài khoản cổng PH", "Menu Sổ chủ nhiệm / Danh sách HS & Tổ");
  steps(s, [
    { h: "Thao tác /register/roster" },
    "Mục 'Liên kết phụ huynh - học sinh': chọn HS",
    "Nhập họ tên / SĐT / email PH (hoặc chọn PH có sẵn)",
    "Tick 'Cấp tài khoản đăng nhập cổng PH' + đặt mật khẩu - bấm Liên kết",
    { h: "Kết quả E2E" },
    { t: "parents + parent_students + auth user PH đều tạo - audit: 'Tạo + liên kết phụ huynh', 'parent.grant_access'", c: C.green },
    { h: "Điểm nói" },
    "PH login được ngay - đúng thực tế đầu năm: GVCN thu thông tin PH tại buổi họp đầu tiên",
  ]);
  img(s, "c2-roster.png");
  note(s, "Thời gian: ~3s cho cả tạo PH + cấp account.");
}

// S10 - Stage C2 + D (deny paths)
{
  const s = p.addSlide();
  head(s, "STAGE C-D - PHÂN QUYỀN", "Deny-path: vai trò nào chỉ thấy việc của vai trò đó", "Mỗi route có guard riêng - truy cập cấm bị redirect về trang chủ riêng, không leak data");
  steps(s, [
    { h: "Kiểm chứng trên E2E" },
    "GVCN vào /school/users -> bị đẩy về /dashboard",
    "GVBM vào /records/students -> bị đẩy về /academics/grades (ảnh bên)",
    "GVBM vào /school/users -> cũng về /academics/grades",
    { h: "Cơ chế" },
    "requireRoles([...]) trên từng route - default-deny",
    "Server action kiểm role lần nữa (không chỉ UI)",
    "RLS trên DB là lớp cuối - 158 policies",
    { h: "Studio AI (C4)" },
    { t: "GVCN gọi Studio A-01 generate -> 200 trong 7.4s qua chuỗi fallback 7 Gemini key x nhiều model -> OpenAI -> Anthropic", c: C.green },
  ]);
  img(s, "d1-gvbm-denied.png");
  note(s, "Đây là điểm kiểm chứng bảo mật quan trọng: GV bộ môn không đụng được hồ sơ chủ nhiệm và quản trị nhân sự.");
}

// S11 - Stage E
{
  const s = p.addSlide();
  head(s, "STAGE E - PHỤ HUYNH", "Cổng phụ huynh thấy đúng con em mình", "Vai trò: annv@nd.scn (trong E2E là PH vừa cấp account ở stage C)");
  steps(s, [
    { h: "Thao tác" },
    "Login bằng email + mật khẩu PH đã cấp",
    "Vào /portal/parent",
    { h: "Kết quả E2E" },
    { t: "Thấy đúng tên HS đã liên kết ('Nguyễn Văn QA Một') - không thấy HS lớp khác", c: C.green },
    { h: "Điểm nói" },
    "Kênh liên lạc = email (Resend): thông báo vắng, thông báo trường gửi tới parents.email",
    "Tài khoản PH do GVCN cấp ngay trong lúc liên kết - đúng thực tế đầu năm",
  ]);
  img(s, "e1-parent-portal.png");
  note(s, "Thời gian: ~3.4s load portal.");
}

// S12 - Ket qua E2E + audit
{
  const s = p.addSlide();
  head(s, "KẾT QUẢ KIỂM CHỨNG", "23/23 bước PASS - mọi mutation đều verify trong DB", "Chạy lại bất cứ lúc nào: node scripts/qa-lifecycle-e2e.mjs");
  table(s, [
    ["Kiểm chứng", "Cách verify", "Kết quả"],
    ["Trường + seed", "schools / academic_years / departments / subjects rows", "year=1 dept=2 subj=14"],
    ["2 tài khoản GV", "profiles role gvcn+gvbm đúng school_id", "PASS"],
    ["Import CSV", "students count theo class_id", "students=6"],
    ["Phân công GVCN", "classes.gvcn_id sau khi lưu", "PASS"],
    ["Điểm danh", "attendance_records theo ngày", "rows=6, unexcused=1"],
    ["Liên kết PH", "parents + parent_students + auth profile_id", "PASS"],
    ["Deny-path x3", "URL redirect sau khi vào route cấm", "PASS x3"],
    ["PH portal", "tên HS xuất hiện trong body", "PASS"],
    ["Audit trail", "audit_logs theo actor_id", "3 actions"],
    ["Profiles cuối", "bgh+gvcn+gvbm+phu_huynh", "=4"],
  ], { colW: [3.2, 6.2, 2.7], y: 1.8, rowH: 0.38 });
  attach(s, ["docs/qa/lifecycle-e2e-2026-10-10.json", "docs/qa/QA-LIFECYCLE-E2E-2026-10-10.md", "docs/demo/e2e-assets/ (10 ảnh + CSV)"], 6.5);
  note(s, "Sau test, script tự xóa sạch trường QAE* (students, profiles, auth users, audit...) - không rác trong production.");
}

mkdirSync("docs/user-guide", { recursive: true });
await p.writeFile({ fileName: "docs/user-guide/KICH-BAN-DEMO-E2E.pptx" });
console.log("done -> docs/user-guide/KICH-BAN-DEMO-E2E.pptx");
