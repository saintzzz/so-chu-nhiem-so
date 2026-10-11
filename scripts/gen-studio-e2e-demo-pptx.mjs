/**
 * Kich ban demo E2E - Cong cu soan hoc lieu (Studio TVC360).
 * Bam ket qua studio E2E 17/17 PASS ngay 11/10/2026 tren prod.
 * Moi step kem screenshot that tu docs/demo/e2e-assets/s*.png.
 * node scripts/gen-studio-e2e-demo-pptx.mjs -> docs/user-guide/KICH-BAN-DEMO-STUDIO-E2E.pptx
 */
import PptxGenJS from "pptxgenjs";
import { mkdirSync, existsSync } from "node:fs";

const A = "docs/demo/e2e-assets";
const OUT = "docs/user-guide";
mkdirSync(OUT, { recursive: true });

const p = new PptxGenJS();
p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
p.layout = "W";

const C = {
  ink: "0f172a", muted: "475569", accent: "0f766e", accentL: "ccfbf1",
  white: "ffffff", bg: "f8fafc", line: "e2e8f0",
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

function table(s, rows, opts = {}) {
  s.addTable(
    rows.map((r, i) =>
      r.map((c) => ({
        text: String(c),
        options: {
          fontFace: FONT, fontSize: i === 0 ? 10.5 : 10, bold: i === 0,
          color: i === 0 ? C.white : C.ink,
          fill: { color: i === 0 ? C.accent : i % 2 ? C.white : C.bg },
          valign: "middle", margin: 0.06,
        },
      })),
    ),
    { x: opts.x ?? 0.6, y: opts.y ?? 1.75, w: opts.w ?? 12.1, border: { pt: 0.75, color: C.line }, rowH: opts.rowH ?? 0.32, colW: opts.colW },
  );
}

function cover(title, sub, meta) {
  const s = p.addSlide();
  s.background = { color: "0f172a" };
  s.addText(title, { x: 0.8, y: 2.5, w: 11.7, h: 1.4, fontFace: FONT, fontSize: 36, bold: true, color: "ffffff" });
  s.addText(sub, { x: 0.8, y: 4.0, w: 11.7, h: 0.9, fontFace: FONT, fontSize: 17, color: "94a3b8" });
  s.addText(meta, { x: 0.8, y: 6.3, w: 11.7, h: 0.8, fontFace: FONT, fontSize: 12, color: "64748b" });
}

// ============ 1. Cover ============
cover(
  "Kịch bản demo E2E\nCông cụ soạn học liệu - Studio TVC360",
  "Luồng đầy đủ: GV soạn theo YCCĐ -> AI/ngân hàng sinh học liệu -> lưu thư viện\n-> gửi duyệt -> Tổ trưởng duyệt -> BGH xuất bản -> xuất Word/PDF/PPTX",
  "Sổ Chủ Nhiệm Số - VieSchool  |  sochunhiem.vieschool.com  |  Kiểm chứng E2E: 17/17 PASS - 11/10/2026",
);

// ============ 2. Tong quan ============
{
  const s = p.addSlide();
  head(s, "TỔNG QUAN", "Luồng kiểm chứng E2E - Studio TVC360", "Business-flow E2E trên production, mọi mutation verify trong DB");
  table(s, [
    ["Stage", "Vai trò", "Nội dung", "Kết quả"],
    ["T1", "GV (gvcn)", "Hub 13 tools - chọn môn/lớp/YCCĐ - sinh DC-01/DC-02/DC-03/A-01 - lưu - gửi duyệt - export DOCX", "PASS"],
    ["T2", "Tổ trưởng", "Mở học liệu in_review - duyệt -> totruong_ok", "PASS"],
    ["T3", "BGH", "Mở học liệu totruong_ok - duyệt -> published", "PASS"],
    ["T4", "Phụ huynh", "Vào /studio -> bị chặn về portal", "PASS"],
    ["DB", "service role", "tvc_materials / tvc_matrices / tvc_reviews / trạng thái từng bước", "PASS"],
  ], { colW: [1.1, 1.6, 7.2, 1.2], rowH: 0.55 });
  steps(s, [
    { h: "Phát hiện & sửa trong đợt QA này" },
    { t: "BUG prod: BGH không duyệt được học liệu", c: C.red, sub: ["scn_review_material insert tvc.reviews.reviewer_id (FK -> tvc.profiles) nhưng reviewer chưa từng soạn -> FK violation -> rollback, status kẹt totruong_ok", "Fix: ensureTvcProfile() trong reviewMaterial (commit 1756635) - đã verify published trên prod"] },
    { t: "Chuỗi fallback AI 7 key Gemini x4 model hoạt động", sub: ["A-01 trả bài đọc thật qua provider=gemini; 5xx transient tự nhảy key"] },
  ], { y: 5.05, w: 12.1, fontSize: 11.5 });
}

// ============ 3. Inventory ============
{
  const s = p.addSlide();
  head(s, "BỐI CẢNH", "13 công cụ soạn học liệu + dữ liệu nền", "Inventory thật trên prod");
  table(s, [
    ["Nhóm", "Tools", "Chức năng"],
    ["Soạn - đánh giá", "DC-01 / DC-02 / DC-03", "Kế hoạch bài dạy - Ma trận + đặc tả - Sinh đề từ ngân hàng"],
    ["Câu hỏi - biên tập", "DC-04 / DC-05 / DC-06", "Ngân hàng câu hỏi - Biên tập học liệu - Bài trình chiếu"],
    ["Toán - ký hiệu", "T-01 / T-02", "Công cụ toán - soạn công thức LaTeX/KaTeX"],
    ["Ngữ liệu", "V-01 / V-02", "Kho ngữ liệu ngoài SGK - câu hỏi đọc hiểu"],
    ["Tiếng Anh (AI)", "A-01 / A-02 / A-03", "Bài đọc theo CEFR - bài tập từ vựng - hội thoại + luyện nghe (TTS)"],
  ], { colW: [2.5, 2.9, 6.7], rowH: 0.42 });
  steps(s, [
    { h: "Dữ liệu nền trên prod" },
    "Ngân hàng: 22.877 câu hỏi (DC-03 rút đề từ đây) - 7 ma trận - 21+ học liệu",
    "YCCĐ đủ cho: toán 1-12, tiếng Anh 3-12, ngữ văn 6-12, tiếng Việt 1-5",
    "Vai trò dùng Studio: gvcn, gvbm, to_truong, bgh, admin - review: to_truong + bgh",
  ], { y: 4.35, w: 12.1, fontSize: 11.5 });
}

// ============ 4-14. Screenshots ============
const SHOTS = [
  ["BƯỚC 1", "Studio hub - 13 công cụ cho giáo viên", "s1-studio-hub.png", [
    "GV đăng nhập -> menu Công cụ soạn học liệu -> Tất cả công cụ",
    "Hub hiển thị đủ 13 tool nhóm theo chức năng",
    "Phụ menu: Ngân hàng câu hỏi - Thư viện của tôi - YCCĐ của trường - Biểu mẫu KHBD",
  ]],
  ["BƯỚC 2", "Chọn công cụ + ngữ cảnh: môn, lớp, YCCĐ", "s2-dc01-form-yccd.png", [
    "Ví dụ DC-01: chọn Môn Toán -> Khối 6 -> checkbox YCCĐ TOAN6.1.x",
    "YCCĐ load từ tvc_curriculum_standards của trường - môn/lớp không có chuẩn thì không hiện checkbox",
    "Trường tuỳ chọn: tiết học, thời lượng, mẫu KHBH của trường",
  ]],
  ["BƯỚC 3", "Sinh học liệu - minh hoạ trên DC-02 (ma trận đề)", "s4-dc02-generated.png", [
    "Nhấn Sinh học liệu -> ma trận CV 7991 render tức thì (rule-based, không cần AI)",
    "Ma trận 19 câu / 10đ: TN nhiều lựa chọn - Đúng/Sai - Trả lời ngắn - Tự luận",
    "Bản đặc tả chi tiết theo từng YCCĐ + mức độ + năng lực",
  ]],
  ["BƯỚC 4", "Lưu học liệu vào thư viện", "s5-saved.png", [
    "Lưu học liệu -> insert tvc_materials (status=personal) + tvc_matrices cho DC-02",
    "Nút đổi thành Đã lưu - Mở trong thư viện - kèm lối tắt Sinh đề từ ma trận này (DC-03)",
  ]],
  ["BƯỚC 5", "Chi tiết học liệu - trạng thái bản nháp cá nhân", "s6-material-personal.png", [
    "Trang chi tiết: nội dung + nút Chỉnh sửa / Xuất Word / Xuất PDF / Gửi duyệt",
    "GV chỉnh sửa được khi còn personal/draft - author_id = chính GV",
  ]],
  ["BƯỚC 6", "GV gửi duyệt -> in_review", "s7-submitted.png", [
    "Gửi duyệt -> RPC scn_submit_material_review -> status in_review",
    "tvc_reviews ghi dòng 'gửi duyệt' - GV không sửa được nữa trong lúc chờ duyệt",
  ]],
  ["BƯỚC 7", "Tổ trưởng kiểm duyệt (lớp 1)", "s8-totruong-review.png", [
    "to_truong cùng trường mở học liệu in_review -> thấy nút Tổ duyệt + Trả về",
    "Có ô ghi chú duyệt (không bắt buộc)",
  ]],
  ["BƯỚC 8", "Tổ duyệt xong -> totruong_ok", "s9-totruong-ok.png", [
    "RPC scn_review_material lớp 1 -> status totruong_ok + tvc_reviews layer=1 approved",
    "Thông báo tự động gửi tác giả: 'Học liệu được duyệt'",
  ]],
  ["BƯỚC 9", "BGH duyệt - xuất bản (lớp 2)", "s10-bgh-publish.png", [
    "BGH mở học liệu totruong_ok -> nút BGH duyệt - xuất bản",
    "Đây là bước trước đây lỗi FK reviewer -> đã fix & verify lại trên prod",
  ]],
  ["BƯỚC 10", "Đã xuất bản - lịch sử kiểm duyệt 3 lớp", "s11-published.png", [
    "Badge Đã xuất bản + box Lịch sử kiểm duyệt: tác giả gửi -> tổ trưởng duyệt -> BGH duyệt",
    "Học liệu published hiển thị trong thư viện trường theo RLS",
  ]],
  ["BƯỚC 11", "Ngân hàng câu hỏi - 22.877 câu", "s12-questions-bank.png", [
    "Lọc theo môn/lớp/mức độ/dạng thức/YCCĐ - tìm kiếm text",
    "DC-03 rút đề trực tiếp từ ngân hàng này theo ma trận đã lưu",
  ]],
  ["BƯỚC 12", "Thư viện của tôi + bản in PDF", "s13-library.png", [
    "Thư viện liệt kê học liệu kèm trạng thái: bản nháp / chờ duyệt / đã xuất bản / trả về",
    "Xuất Word tải DOCX thật (file zip PK) - Xuất PDF mở trang in /studio-print/:id",
  ]],
  ["BƯỚC 12 (tt)", "Trang in /studio-print - xuất PDF", "s14-print-pdf.png", [
    "Layout A4 sạch cho in/tải PDF qua trình duyệt",
    "Cùng nội dung học liệu - không phụ thuộc trạng thái duyệt",
  ]],
];
for (const [step, title, file, bullets] of SHOTS) {
  const s = p.addSlide();
  head(s, step, title);
  steps(s, bullets.map((t) => ({ t })), { w: 5.6 });
  img(s, file);
}

// ============ 15. RBAC + deny ============
{
  const s = p.addSlide();
  head(s, "PHÂN QUYỀN", "Ma trận quyền đã kiểm chứng", "Deny-path verify bằng login thật");
  table(s, [
    ["Hành động", "GV (gvcn/gvbm)", "Tổ trưởng", "BGH", "Phụ huynh/HS"],
    ["Mở /studio + dùng 13 tools", "Cho phép", "Cho phép", "Cho phép", "Chặn -> về portal"],
    ["Sinh + lưu học liệu (own)", "Cho phép", "Cho phép", "Cho phép", "-"],
    ["Gửi duyệt", "Tác giả", "Tác giả", "Tác giả", "-"],
    ["Duyệt lớp 1 (in_review -> totruong_ok)", "Không", "Cho phép", "-", "-"],
    ["Duyệt lớp 2 (-> published)", "Không", "-", "Cho phép", "-"],
    ["Export DOCX/PPTX/PDF", "studio.export", "studio.export", "studio.export", "Chặn"],
    ["Chỉnh sửa sau khi gửi duyệt", "Khoá", "Khoá", "Khoá", "-"],
  ], { colW: [4.4, 2.0, 1.8, 1.7, 2.2], rowH: 0.4 });
  steps(s, [
    { h: "Verify thật" },
    "Phụ huynh login -> vào /studio -> redirect /portal/parent (không leak dữ liệu)",
    "Feature grant có thể siết từng quyền theo trường/role/user qua feature_grants (mặc định như bảng)",
  ], { y: 5.35, w: 12.1, fontSize: 11.5 });
}

// ============ 16. Ket qua ============
{
  const s = p.addSlide();
  head(s, "KẾT QUẢ", "E2E 17/17 PASS - verify DB từng bước", "scripts/qa-studio-e2e.mjs - docs/qa/studio-e2e-2026-10-11.json");
  table(s, [
    ["#", "Check", "Verify"],
    ["1", "Login GV + hub 13 tools", "UI + đủ 13 tool codes"],
    ["2", "DC-01 sinh KHBD + lưu", "tvc_materials status=personal, doc 4-9 sections"],
    ["3", "Gửi duyệt -> in_review", "tvc_materials.status + tvc_reviews 'submitted'"],
    ["4", "Export DOCX", "HTTP 200, file PK-zip 12-14KB (docx thật)"],
    ["5", "DC-02 sinh ma trận + lưu", "tvc_matrices owner_id + cells>0"],
    ["6", "DC-03 rút đề từ ngân hàng", "exam material + preview 'Câu N:' + 'PHẦN'"],
    ["7", "A-01 bài đọc A2 qua AI", "HTTP 200, 3 sections, provider=gemini"],
    ["8", "Ngân hàng + thư viện render", "UI + material QA xuất hiện"],
    ["9", "Tổ trưởng duyệt -> totruong_ok", "DB status + reviews layer=1"],
    ["10", "BGH duyệt -> published", "DB status + reviews layer=2 (sau fix FK)"],
    ["11", "PH vào /studio", "redirect /portal/parent"],
    ["12", "Cleanup", "QA materials/matrices xoá sạch"],
  ], { colW: [0.6, 6.2, 5.3], rowH: 0.34 });
}

// ============ 17. Tai khoan + tai hien ============
{
  const s = p.addSlide();
  head(s, "TÀI KHOẢN DEMO", "Dùng lại cho trình diễn trực tiếp", "Trường demo THCS Nguyễn Du (nd) - mật khẩu nội bộ");
  table(s, [
    ["Vai trò", "Tài khoản", "Dùng cho bước"],
    ["GV chủ nhiệm + tổ trưởng concurrent", "anhptl@nd.scn", "Soạn - lưu - gửi duyệt - export"],
    ["Tổ trưởng chuyên môn", "linhnm@nd.scn / mypt@nd.scn", "Duyệt lớp 1"],
    ["Hiệu trưởng (BGH)", "hainv@nd.scn", "Duyệt lớp 2 - xuất bản"],
    ["Phụ huynh", "portal account của HS", "Minh hoạ deny-path"],
  ], { colW: [3.9, 3.2, 5.0], rowH: 0.42 });
  steps(s, [
    { h: "Tái hiện E2E" },
    "node scripts/qa-studio-e2e.mjs          - full 17 checks trên prod",
    "node scripts/capture-studio-e2e-screens.mjs - chụp lại toàn bộ ảnh",
    "node scripts/gen-studio-e2e-demo-pptx.mjs   - regen deck này",
    { h: "Lưu ý" },
    "Data QA tự cleanup (title QA-%) - không rác trong thư viện",
    "Môn/lớp nên chọn toán 6 hoặc tiếng Anh 6 - đủ YCCĐ + ngân hàng lớn",
    "A-01..A-03 dùng AI thật (7 key Gemini fallback) - có thể chậm 5-70s",
  ], { y: 3.9, w: 12.1, fontSize: 11.5 });
}

await p.writeFile({ fileName: `${OUT}/KICH-BAN-DEMO-STUDIO-E2E.pptx` });
console.log(`-> ${OUT}/KICH-BAN-DEMO-STUDIO-E2E.pptx (${p._slides.length} slides)`);
