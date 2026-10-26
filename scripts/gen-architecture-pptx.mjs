/**
 * Architecture PPTX - kien truc he thong, tech stack, so sanh phuong an.
 * node scripts/gen-architecture-pptx.mjs -> docs/handover/KIEN-TRUC-HE-THONG.pptx
 * Nguon: docs/project/ARCHITECTURE.md (Phase 4), AGENTS.md, package.json.
 * Style dong bo voi gen-user-guide-pptx.mjs (cung palette + transitions).
 */
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const p = new PptxGenJS();
p.defineLayout({ name: "W", width: 13.33, height: 7.5 });
p.layout = "W";

const C = {
  ink: "0f172a", muted: "475569", accent: "0f766e", accentL: "ccfbf1",
  amber: "b45309", white: "ffffff", bg: "f8fafc", line: "e2e8f0",
  code: "1e293b", teal2: "14b8a6",
};
const FONT = "Segoe UI";
let pageNo = 0;

function footer(s) {
  pageNo += 1;
  s.addText("VieSchool - Sổ Chủ Nhiệm Số", { x: 0.55, y: 7.14, w: 5, h: 0.3, fontFace: FONT, fontSize: 9, color: "94a3b8" });
  s.addText(`${pageNo}`, { x: 12.4, y: 7.14, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 9, color: "94a3b8", align: "right" });
}

function slideTitle(s, section, title, desc) {
  s.addShape(p.shapes.RECTANGLE, { x: 0, y: 0, w: 0.14, h: 1.8, fill: { color: C.accent } });
  s.addText(section, { x: 0.55, y: 0.28, w: 12, h: 0.3, fontFace: FONT, fontSize: 11, color: C.accent, bold: true });
  s.addText(title, { x: 0.55, y: 0.55, w: 12.2, h: 0.7, fontFace: FONT, fontSize: 26, bold: true, color: C.ink });
  if (desc) s.addText(desc, { x: 0.55, y: 1.28, w: 12.2, h: 0.45, fontFace: FONT, fontSize: 12.5, color: C.muted });
  s.addShape(p.shapes.LINE, { x: 0.55, y: 1.72, w: 12.2, h: 0, line: { color: C.line, width: 1 } });
  footer(s);
}

function divider(part, title, desc) {
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addShape(p.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: C.teal2 } });
  s.addShape(p.shapes.RECTANGLE, { x: 10.4, y: 5.6, w: 2.93, h: 1.9, fill: { color: "134e4a" } });
  s.addText(part, { x: 0.8, y: 1.9, w: 4, h: 0.5, fontFace: FONT, fontSize: 15, color: C.teal2, bold: true });
  s.addText(title, { x: 0.8, y: 2.5, w: 11.7, h: 1.6, fontFace: FONT, fontSize: 40, bold: true, color: C.white });
  if (desc) s.addText(desc, { x: 0.8, y: 4.25, w: 10.5, h: 1, fontFace: FONT, fontSize: 14, color: "94a3b8" });
  return s;
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

function box(s, { x, y, w, h, title, sub, fill = C.accentL, line = C.accent, tcolor = C.ink }) {
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: line, width: 1 } });
  s.addText(title, { x, y: y + 0.12, w, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: tcolor, align: "center" });
  if (sub) s.addText(sub, { x, y: y + 0.5, w, h: h - 0.55, fontFace: FONT, fontSize: 10, color: C.muted, align: "center", valign: "top" });
}

function arrow(s, x, y, w = 0.55) {
  s.addShape(p.shapes.RIGHT_ARROW, { x, y, w, h: 0.32, fill: { color: C.teal2 } });
}

// ============================== SLIDES ==============================

// 1 - Cover
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addShape(p.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.14, fill: { color: C.teal2 } });
  s.addText("VieSchool", { x: 0.9, y: 0.6, w: 4, h: 0.4, fontFace: FONT, fontSize: 14, color: C.teal2, bold: true });
  s.addText("Kiến trúc hệ thống", { x: 0.9, y: 2.1, w: 11.5, h: 1.2, fontFace: FONT, fontSize: 44, bold: true, color: C.white });
  s.addText("Sổ Chủ Nhiệm Số - nền tảng số hóa công tác chủ nhiệm và quản lý trường học", { x: 0.9, y: 3.3, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 16, color: "94a3b8" });
  s.addText("Tech stack - Quyết định kiến trúc - So sánh phương án - Mức độ phù hợp", { x: 0.9, y: 4.0, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 13, color: C.teal2 });
  s.addText("Nguồn: docs/project/ARCHITECTURE.md - AGENTS.md - cấu hình production thật", { x: 0.9, y: 6.6, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 10.5, color: "64748b" });
}

// 2 - Bai toan
{
  const s = p.addSlide();
  slideTitle(s, "BỐI CẢNH", "Bài toán đặt ra");
  bullets(s, [
    { t: "Số hóa toàn bộ công tác chủ nhiệm và điều hành trường học", b: true },
    { t: "10 vai trò nghiệp vụ + admin", sub: ["GVCN, GVBM, Tổ trưởng, BGH, PHT cơ sở, Kế toán, Sở GD&ĐT, UBND, Phụ huynh, Học sinh"] },
    { t: "Miền dữ liệu rộng", sub: ["~30 bảng: hồ sơ HS, điểm danh, điểm số, hạnh kiểm, sổ đăng ký chủ nhiệm, thi đua, cố vấn, sự cố an toàn"] },
    { t: "Yêu cầu phi chức năng", sub: ["Tiếng Việt chuẩn, mobile-first, demo nhiều vai trò, bảo mật tuyệt đối theo vai trò - không rò rỉ chéo"] },
    { t: "Ràng buộc vận hành", sub: ["Đội ngũ nhỏ, zero-ops, không phát sinh chi phí ngoài quota (zero-overage)"] },
  ]);
}

// 3 - So do kien truc
{
  const s = p.addSlide();
  slideTitle(s, "KIẾN TRÚC", "Sơ đồ tổng quan");
  box(s, { x: 0.6, y: 2.2, w: 2.3, h: 1.5, title: "Browser", sub: "10 vai trò\nmobile-first\nPWA-ready" });
  arrow(s, 3.0, 2.8);
  box(s, { x: 3.6, y: 2.0, w: 2.7, h: 1.9, title: "Vercel (Next.js 16)", sub: "App Router + RSC\nServer Actions\nproxy.ts auth redirect\nWAF + rate limits", fill: "dbeafe", line: "2563eb" });
  arrow(s, 6.45, 2.8);
  box(s, { x: 7.05, y: 2.0, w: 2.7, h: 1.9, title: "Supabase", sub: "Postgres ~30 bảng\nRow Level Security\nAuth email/password\nRPC + views", fill: "d1fae5", line: "059669" });
  arrow(s, 9.9, 2.8);
  box(s, { x: 10.5, y: 2.2, w: 2.2, h: 1.5, title: "Dịch vụ ngoài", sub: "Resend (email PH)\nAI providers\n(TTS, sinh đề)", fill: "fef3c7", line: C.amber });
  bullets(s, [
    { t: "Bảo mật 3 lớp", b: true, sub: ["proxy.ts redirect lạc quan (UX) - requireRole() trong Server Components - RLS trong Postgres là lớp cuối, không phụ thuộc code app"] },
    { t: "Một deploy duy nhất", sub: ["Git push master - auto-deploy production (git-linked), không server riêng, không CI/CD tự quản"] },
  ], { y: 4.5, fontSize: 12.5 });
}

// 4 - Tech stack
{
  const s = p.addSlide();
  slideTitle(s, "TECH STACK", "Công nghệ sử dụng");
  table(s, [
    ["Tầng", "Lựa chọn", "Lý do"],
    ["Framework", "Next.js 16.4 App Router, React 19, TS strict", "RSC giảm JS client, real routes deep-link được"],
    ["Styling", "Tailwind v4 @theme + CSS-var tokens", "Một design language (Fluent 2) toàn app"],
    ["UI", "Base UI (shadcn) + custom components", "Accessible primitives sẵn, tự do custom"],
    ["Backend", "Supabase: Auth + Postgres + RLS", "Không tự build backend, RLS = chống rò rỉ chéo vai trò"],
    ["Data access", "@supabase/ssr + supabase-js, Server Actions", "Không cần API layer riêng (ADR-6)"],
    ["Charts/Export", "Custom SVG, print CSS, docx/pptxgenjs, xlsx, KaTeX", "Xuất sổ/đề thi ra Word, PPT, Excel - in trực tiếp"],
    ["Infra", "Vercel Pro (git-linked), tên miền *.vieschool.com", "Zero-ops, WAF + rate limit + budgets sẵn có"],
  ], { rowH: 0.52 });
}

divider("PHẦN II", "Quyết định kiến trúc", "6 ADR chính + lý do chọn từng công nghệ nền tảng");

// 6 - ADR table
{
  const s = p.addSlide();
  slideTitle(s, "QUYẾT ĐỊNH", "6 quyết định kiến trúc chính (ADR)");
  table(s, [
    ["ADR", "Quyết định", "Đánh đổi"],
    ["ADR-1", "Real routes (App Router) thay SPA một URL", "Deep-link, RSC streaming - đổi lại phải quản route tree rõ ràng"],
    ["ADR-2", "RLS làm lớp phân quyền cuối, app chỉ UX", "An toàn tuyệt đối - đổi lại test policy từng vai trò trước khi wire UI"],
    ["ADR-3", "JSONB cho sơ đồ chỗ ngồi (layout version)", "Linh hoạt lưới ghế, không đục schema - đổi lại validate ở app"],
    ["ADR-4", "Gợi ý rule-based, ghi nhãn rõ - không LLM cho nghiệp vụ lõi", "Deterministic, audit được - đổi lại ít 'thông minh' hơn"],
    ["ADR-5", "Tài khoản demo + role preview, RLS vẫn authoritative", "Demo 10 vai trò mượt - không làm yếu bảo mật"],
    ["ADR-6", "Server Actions cho mọi write, không API layer", "Ít surface attack, code gọn - Route Handlers chỉ cho upload"],
  ], { rowH: 0.66 });
}

// 7 - Vi sao Next.js
{
  const s = p.addSlide();
  slideTitle(s, "QUYẾT ĐỊNH", "Vì sao Next.js 16 + Vercel, không phải SPA truyền thống");
  table(s, [
    ["Tiêu chí", "Next.js 16 + Vercel (đã chọn)", "SPA + backend riêng (Express/Nest)"],
    ["Render", "RSC + static/SSR - TTFB nhanh, SEO tốt", "CSR thuần - màn trắng chờ JS, SEO yếu"],
    ["Backend", "Server Actions trong cùng repo - 1 codebase", "2 codebase, 2 deploy, contract API tự duy trì"],
    ["Vận hành", "Git push - deploy, rollback 1 click, preview/PR", "Tự quản server/process/CI-CD"],
    ["Bảo mật", "WAF + rate limit + headers cấu hình sẵn", "Tự dựng reverse proxy + middleware"],
    ["Chi phí", "Pro $20/tháng, spend cap $1 - không overage", "VPS rẻ hơn nhưng tốn công vận hành"],
  ], { rowH: 0.56 });
  note(s, "Đo thật: splash '/' TTFB p95 ~450ms (từng ~3s trước khi tối ưu) - ngân sách <1s được gate tự động bằng check-perf.");
}

// 8 - Vi sao Supabase
{
  const s = p.addSlide();
  slideTitle(s, "QUYẾT ĐỊNH", "Vì sao Supabase (Postgres + RLS), không phải tự build backend");
  table(s, [
    ["Tiêu chí", "Supabase (đã chọn)", "Tự build (Postgres + API thủ công)"],
    ["Phân quyền", "RLS trong DB - portal/API không thể rò rỉ chéo vai trò", "Kiểm tra ở app layer - quên 1 chỗ = lộ dữ liệu"],
    ["Auth", "Auth sẵn có, email/password, session cookie SSR", "Tự implement JWT/session - rủi ro bảo mật"],
    ["Tốc độ phát triển", "Migrations SQL + RPC + views - rất nhanh", "ORM + endpoint cho từng thao tác"],
    ["Vận hành", "Managed, backup, Spend Cap chặn vượt quota", "Tự monitor DB, tự backup, tự vá"],
    ["Chi phí", "Pro $25/tháng, cap cứng", "Rẻ về tiền - đắt về công"],
  ], { rowH: 0.56 });
  note(s, "Bài toán 10 vai trò x ~30 bảng = phân quyền là rủi ro lớn nhất - RLS loại bỏ nguyên một lớp bug 'quên check quyền'.");
}

// 9 - Bao mat 3 lop
{
  const s = p.addSlide();
  slideTitle(s, "BẢO MẬT", "Phân quyền 3 lớp - default-deny");
  box(s, { x: 0.7, y: 2.0, w: 3.7, h: 2.2, title: "Lớp 1 - proxy.ts", sub: "Redirect lạc quan:\nchưa login - /login\nđã login - role home\nCHỈ là UX, không phải authz", fill: "dbeafe", line: "2563eb" });
  box(s, { x: 4.8, y: 2.0, w: 3.7, h: 2.2, title: "Lớp 2 - Server checks", sub: "requireRole([...]) đầu page\ncheckActionRole trong actions\ngetProfile() React cache()\ndefault-deny nếu role lạ", fill: "d1fae5", line: "059669" });
  box(s, { x: 8.9, y: 2.0, w: 3.7, h: 2.2, title: "Lớp 3 - Postgres RLS", sub: "Policy theo vai trò trên mọi bảng\nmy_role(), my_school_id(),\nmy_class_ids(), my_student_ids()\nseed mới dùng service_role", fill: "fef3c7", line: C.amber });
  bullets(s, [
    { t: "Vai trò vào route của người khác - redirect về home của chính họ, không bao giờ leak data" },
    { t: "WAF Vercel: rate limit /api + /login, bypass-health cho uptime monitor; headers CSP/HSTS/nosniff/X-Frame đầy đủ" },
    { t: "Secrets chỉ ở env/dashboard - không commit; audit_logs ghi mọi thao tác nhạy cảm" },
  ], { y: 4.6, fontSize: 12.5 });
}

// 10 - Mo hinh du lieu
{
  const s = p.addSlide();
  slideTitle(s, "DỮ LIỆU", "Mô hình dữ liệu - ~30 bảng theo cụm nghiệp vụ");
  table(s, [
    ["Cụm", "Bảng chính"],
    ["Tổ chức & con người", "schools, departments, academic_years, profiles, students, parents, parent_students"],
    ["Lớp học", "classes, student_groups (Tổ), class_roles (BCS), student_record_history"],
    ["Giảng dạy", "subjects (per-school), teacher_subjects, timetable_entries, period_logs, period_absences"],
    ["Điểm danh & học lực", "attendance_records (status+source enum), grades (term/loại KT), support_plans"],
    ["Hạnh kiểm & cố vấn", "conduct_records, conduct_evaluations, counseling_cases"],
    ["Truyền thông & hoạt động", "announcements, messages, appointments, activities (draft-pending-approved-done), notifications"],
    ["Sổ chủ nhiệm & thi đua", "seating_charts (jsonb, version), kpis, register_signoffs, school_year_events, emulation_*"],
    ["Hệ thống", "audit_logs, notifications, export_log"],
  ], { rowH: 0.5 });
  note(s, "Một sự thật = một bảng: period_absences đồng bộ sang attendance_records (source='period_log') - hai màn hình không bao giờ mâu thuẫn.");
}

// 11 - Luong du lieu
{
  const s = p.addSlide();
  slideTitle(s, "DỮ LIỆU", "Các luồng nghiệp vụ then chốt");
  bullets(s, [
    { t: "Điểm danh hai nguồn hợp nhất", b: true, sub: ["Sổ đầu bài (period_absences) upsert sang attendance_records - view attendance_daily gộp một nguồn sự thật"] },
    { t: "Dashboard = SQL views", sub: ["dashboard_gvcn aggregate vắng/muộn/%CC/at-risk trong ngày - count ở DB, không fetchAllRows rồi đếm ở client"] },
    { t: "Sơ đồ chỗ ngồi", sub: ["layout jsonb {cols, rows, seats}, version mỗi lần lưu, export PNG/PDF phía client"] },
    { t: "Thông báo sự kiện", sub: ["Mọi action user khác cần biết - insert notifications cho recipient, feed không bao giờ 'chết'"] },
    { t: "AI có chuỗi fallback", sub: ["GEMINI/OPENAI/ANTHROPIC multi-key - hết quota thì Devin async job callback - cuối cùng rule-based, không bao giờ crash flow"] },
    { t: "Email phụ huynh = Resend", sub: ["sendAnnouncement gửi email PH liên kết; thiếu key vẫn lưu in-app + báo emailSkipped"] },
  ], { fontSize: 12.5 });
}

divider("PHẦN III", "So sánh phương án", "Đã chọn gì - bỏ qua gì - vì sao");

// 13 - So sanh 4 phuong an
{
  const s = p.addSlide();
  slideTitle(s, "SO SÁNH", "4 phương án cạnh tranh");
  table(s, [
    ["Tiêu chí", "Next.js+Supabase (đã chọn)", "VPS + Express + Postgres", "Low-code (Retool/Bubble)", "Open-source (Moodle...)"],
    ["Time-to-market", "Nhanh nhất - 1 codebase", "Chậm - dựng infra trước", "Nhanh cho CRUD đơn giản", "Chậm - customize nặng"],
    ["Phân quyền 10 vai trò", "RLS - chặt tuyệt đối", "Tự code - dễ sót", "Kém kiểm soát fine-grain", "Plugin, khó kiểm chứng"],
    ["UI/UX riêng", "Toàn quyền - Fluent 2 đồng nhất", "Toàn quyền", "Bị giới hạn template", "UI cũ, khó re-skin"],
    ["Vận hành", "Zero-ops", "Tự lo uptime/backup/CVE", "Vendor lo", "Tự lo toàn bộ"],
    ["Chi phí", "~$45/tháng cap cứng", "VPS rẻ + công vận hành", "Per-seat - đắt khi scale", "Miễn phí license, đắt công"],
    ["Lock-in", "Trung bình (Postgres chuẩn)", "Thấp", "Cao - data kẹt trong vendor", "Thấp"],
  ], { rowH: 0.56 });
}

// 14 - Uu diem
{
  const s = p.addSlide();
  slideTitle(s, "ĐÁNH GIÁ", "Ưu điểm của phương án đã chọn");
  bullets(s, [
    { t: "Bảo mật theo thiết kế, không theo kỷ luật", b: true, sub: ["RLS ở DB = lớp cuối bất khả xâm phạm kể cả khi app bug; 10 vai trò phức tạp vẫn default-deny"] },
    { t: "Tốc độ phát triển cao", sub: ["Server Actions + generated types + SQL trực tiếp - feature mới không cần dựng API plumbing"] },
    { t: "Performance đo được, gate được", sub: ["Static shell + RSC; perf budgets trong repo, check-perm fail deploy khi vượt ngưỡng"] },
    { t: "Zero-ops thật", sub: ["Không server, không on-call infra; git push = deploy; rollback 1 click"] },
    { t: "Chi phí dự đoán được", sub: ["Vercel $1 pause + Supabase Spend Cap + AI Gateway $1 - vượt quota thì dừng chứ không bill"] },
    { t: "Hệ sinh thái chuẩn", sub: ["Postgres chuẩn, Next.js mainstream - không kẹt vào framework hiếm, dễ chuyển nếu cần"] },
  ], { fontSize: 12.5 });
}

// 15 - Nhuoc diem
{
  const s = p.addSlide();
  slideTitle(s, "ĐÁNH GIÁ", "Nhược điểm & cách giảm thiểu");
  table(s, [
    ["Nhược điểm / rủi ro", "Mức độ", "Giảm thiểu"],
    ["Vendor lock-in nhẹ (Supabase RPC, Vercel)", "Trung bình", "Postgres chuẩn - migrate được; code tách lib/supabase/*"],
    ["Cold start serverless", "Thấp", "Static shell + splash; perf gate giữ TTFB <1s"],
    ["RLS khó test", "Trung bình", "Convention: test policy từng vai trò bằng execute_sql trước khi wire UI"],
    ["~30 bảng + policy = complexity thật", "Cao", "RLS là lý do chọn Supabase - complexity này không tránh được ở phương án nào"],
    ["Server Actions khó audit hơn REST rõ ràng", "Thấp", "checkActionRole bắt buộc + audit_logs ở mọi mutation nhạy cảm"],
    ["AI phụ thuộc provider ngoài", "Trung bình", "Multi-key multi-provider fallback + rule-based cuối chuỗi - flow không gãy"],
  ], { rowH: 0.62 });
}

// 16 - Phu hop bai toan
{
  const s = p.addSlide();
  slideTitle(s, "ĐÁNH GIÁ", "Mức độ phù hợp với bài toán");
  table(s, [
    ["Yêu cầu bài toán", "Kiến trúc đáp ứng thế nào"],
    ["10 vai trò, phân quyền phức tạp", "RLS 3 lớp + requireRole + mergedNav gộp menu đa vai trò - kiểm chứng bằng gate"],
    ["Nghiệp vụ trường học VN", "Schema chuyên biệt (sổ đầu bài, thi đua, sổ chủ nhiệm HK), không ép vào LMS quốc tế"],
    ["Demo/bán hàng nhiều vai trò", "Demo accounts + role preview mượt, RLS vẫn chặt (ADR-5)"],
    ["Mobile-first cho GV/PH", "Tailwind responsive + instant paint loading.tsx skeleton"],
    ["Vận hành siêu nhẹ", "Zero-ops serverless + monitoring Upptime miễn phí + weekly harness tự audit"],
    ["Không vượt ngân sách", "Spend cap toàn chuỗi - thiết kế zero-overage từ đầu"],
    ["Xuất tài liệu hành chính", "docx/pptxgenjs/xlsx/print CSS - sổ, đề thi, báo cáo ra file thật"],
  ], { rowH: 0.56 });
  note(s, "Kết luận: kiến trúc này tối ưu cho đúng bài toán - nhiều vai trò, nghiệp vụ VN đặc thù, đội nhỏ, cần demo và ship nhanh.");
}

// 17 - Ket luan
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addShape(p.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: C.teal2 } });
  s.addText("KẾT LUẬN", { x: 0.9, y: 1.6, w: 4, h: 0.5, fontFace: FONT, fontSize: 15, color: C.teal2, bold: true });
  s.addText("Serverless + RLS = đúng bài toán", { x: 0.9, y: 2.2, w: 11.5, h: 1.1, fontFace: FONT, fontSize: 36, bold: true, color: C.white });
  bullets(s, [
    { t: "Next.js 16 + Supabase cho phép đội nhỏ ship nền tảng 10 vai trò mà không cần đội vận hành riêng", c: C.white },
    { t: "RLS biến yêu cầu khó nhất (phân quyền đa vai trò) thành thế mạnh kiến trúc", c: C.white },
    { t: "Zero-overage được enforce bằng công cụ (spend caps + WAF + perf gates), không phải cam kết", c: C.white },
    { t: "Đánh đổi chấp nhận được: lock-in nhẹ, cold start - đều đã có mitigation đo được", c: C.white },
  ], { x: 0.9, y: 3.6, w: 11.5, fontSize: 14 });
  s.addText("Tài liệu kèm: USER-GUIDE-vieschool.pptx (38 slides, hướng dẫn 10 vai trò) - docs/project/ARCHITECTURE.md (chi tiết kỹ thuật)", { x: 0.9, y: 6.4, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 11, color: "94a3b8" });
}

// ============================== WRITE ==============================

mkdirSync("docs/handover", { recursive: true });
const OUT = "docs/handover/KIEN-TRUC-HE-THONG.pptx";
await p.writeFile({ fileName: OUT });

// Inject transitions: slide nen toi (cover/divider/closing) = push; con lai = fade
{
  const zip = await JSZip.loadAsync(readFileSync(OUT));
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1]) - parseInt(b.match(/slide(\d+)/)[1]));
  for (const name of slideNames) {
    let xml = await zip.file(name).async("string");
    const dark = xml.includes('val="1E293B"');
    const tr = `<p:transition spd="fast" advClick="1" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">${dark ? '<p:push dir="l"/>' : "<p:fade/>"}</p:transition>`;
    xml = xml.replace("</p:sld>", `${tr}</p:sld>`);
    zip.file(name, xml);
  }
  writeFileSync(OUT, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`Transitions injected on ${slideNames.length} slides`);
}

console.log(`Written ${OUT} - ${pageNo + 2} slides`);
