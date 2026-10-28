/**
 * Architecture PPTX - phan tich sau kien truc he thong Sổ Chủ Nhiệm Số.
 * node scripts/gen-architecture-pptx.mjs -> docs/handover/KIEN-TRUC-HE-THONG.pptx
 * Nguon: docs/project/ARCHITECTURE.md, AGENTS.md, package.json, src/, vercel.json.
 * Style dong bo voi gen-user-guide-pptx.mjs (cung palette + transitions).
 */
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

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
          fontFace: FONT, fontSize: i === 0 ? 11 : 10.5, bold: i === 0,
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
  s.addText("Kiến trúc hệ thống", { x: 0.9, y: 1.9, w: 11.5, h: 1.2, fontFace: FONT, fontSize: 44, bold: true, color: C.white });
  s.addText("Sổ Chủ Nhiệm Số - nền tảng số hóa công tác chủ nhiệm và quản lý trường học", { x: 0.9, y: 3.1, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 16, color: "94a3b8" });
  s.addText("Modular monolith - Microservices analysis - Repo topology - Data architecture - Async model - Scaling path", { x: 0.9, y: 3.8, w: 11.5, h: 0.5, fontFace: FONT, fontSize: 12.5, color: C.teal2 });
  s.addText("Nguồn: docs/project/ARCHITECTURE.md - AGENTS.md - cấu hình production thật", { x: 0.9, y: 6.6, w: 11.5, h: 0.4, fontFace: FONT, fontSize: 10.5, color: "64748b" });
}

// 2 - Bai toan
{
  const s = p.addSlide();
  slideTitle(s, "BỐI CẢNH", "Bài toán đặt ra - ràng buộc quyết định kiến trúc");
  bullets(s, [
    { t: "Số hóa toàn bộ công tác chủ nhiệm và điều hành trường học", b: true },
    { t: "10 vai trò nghiệp vụ + admin", sub: ["GVCN, GVBM, Tổ trưởng, BGH, PHT cơ sở, Kế toán, Sở GD&ĐT, UBND, Phụ huynh, Học sinh"] },
    { t: "Miền dữ liệu rộng và liên kết chặt", sub: ["86 bảng trong schema public: điểm danh chéo sổ đầu bài, điểm số liên kết hạnh kiểm, học bạ, tuyển sinh -> nhập học -> học phí - cùng một học sinh xuyên suốt"] },
    { t: "Bán theo gói tính năng", sub: ["Trường mua module nào dùng module đó - yêu cầu kiến trúc: gating ở nav + route + RPC + RLS, không chỉ ẩn menu"] },
    { t: "Yêu cầu phi chức năng", sub: ["Tiếng Việt chuẩn, mobile-first, demo nhiều vai trò, phân quyền tuyệt đối - không rò rỉ chéo"] },
    { t: "Ràng buộc vận hành", b: true, sub: ["Đội ngũ rất nhỏ (1-2 dev + agent), zero-ops, không phát sinh chi phí ngoài quota"] },
  ]);
  note(s, "Đặc điểm then chốt của bài toán: domain RỘNG nhưng dữ liệu LIÊN KẾT CHẶT - điểm danh, điểm số, hạnh kiểm cùng một học sinh.");
}

// 3 - So do tong quan
{
  const s = p.addSlide();
  slideTitle(s, "KIẾN TRÚC", "Sơ đồ triển khai - một đơn vị deploy duy nhất");
  box(s, { x: 0.6, y: 2.1, w: 2.3, h: 1.7, title: "Browser", sub: "10 vai trò\nmobile-first" });
  arrow(s, 3.0, 2.75);
  box(s, { x: 3.6, y: 1.9, w: 2.9, h: 2.1, title: "Vercel - Next.js 16", sub: "1 deployable duy nhất\nRSC + Server Actions\nRoute Handlers: ai, auth,\ncron, records, studio,\nwebhooks", fill: "dbeafe", line: "2563eb" });
  arrow(s, 6.65, 2.75);
  box(s, { x: 7.25, y: 1.9, w: 2.8, h: 2.1, title: "Supabase (1 project)", sub: "public: 86 bảng SCN\n+ 3 schema app khác\nRLS mọi bảng tenant\nRPC + SQL views", fill: "d1fae5", line: "059669" });
  arrow(s, 10.2, 2.75);
  box(s, { x: 10.8, y: 2.1, w: 2.0, h: 1.7, title: "Ngoài", sub: "Resend\nAI providers\nTurnstile", fill: "fef3c7", line: C.amber });
  bullets(s, [
    { t: "Đây là MODULAR MONOLITH, không phải microservices - một codebase, một deploy, một DB", b: true },
    { t: "Async có nhưng không có broker: Vercel cron + ai_jobs table + webhook callback (Resend) + async fallback" },
    { t: "Cùng Supabase project có 3 schema của các app nội bộ khác - cô lập bằng schema + RLS; SCN chiếm schema public (86 bảng)" },
    { t: "Surface public duy nhất: /apply (tuyển sinh, không cần login) - Turnstile + revoke anon + RPC security-definer" },
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
    ["Export", "docx, pptxgenjs, xlsx (SheetJS CDN), KaTeX, print CSS", "Sổ/đề/báo cáo ra file thật - nghiệp vụ hành chính"],
    ["Infra", "Vercel Pro region sin1 (Singapore), *.vieschool.com", "Gần user VN, WAF + budgets sẵn có"],
  ], { rowH: 0.52 });
}

// 5 - Bao mat 3 lop
{
  const s = p.addSlide();
  slideTitle(s, "BẢO MẬT", "Phân quyền 3 lớp - default-deny");
  box(s, { x: 0.7, y: 1.95, w: 3.7, h: 1.9, title: "Lớp 1 - proxy.ts", sub: "Redirect lạc quan:\nchưa login - /login\nđã login - role home\nCHỈ là UX, không phải authz", fill: "dbeafe", line: "2563eb" });
  box(s, { x: 4.8, y: 1.95, w: 3.7, h: 1.9, title: "Lớp 2 - Server checks", sub: "requireRole([...]) đầu page\ncheckActionRole trong actions\ngetProfile() React cache()\ndefault-deny nếu role lạ", fill: "d1fae5", line: "059669" });
  box(s, { x: 8.9, y: 1.95, w: 3.7, h: 1.9, title: "Lớp 3 - Postgres RLS", sub: "Policy theo vai trò mọi bảng\nmy_role(), my_school_id(),\nmy_class_ids()...\nseed mới dùng service_role", fill: "fef3c7", line: C.amber });
  bullets(s, [
    { t: "Vai trò vào route của người khác - redirect về home của chính họ, không bao giờ leak data" },
    { t: "Lớp 2.5 - schoolFeature(module): trường tắt module thì nav mất + route redirect + RPC trả module_disabled + RLS chặn (CR-060)" },
    { t: "WAF Vercel: rate limit /api + /login, bypass-health cho uptime monitor; headers CSP/HSTS/nosniff/X-Frame đầy đủ" },
    { t: "Anti-scraping (CR-054): robots.txt chặn AI crawler, noindex route authed, export cap 20/h/uid; Turnstile login + /apply public" },
    { t: "252 RLS policies đã wrap (select auth.uid()) - evaluate 1 lần/statement thay vì per-row (CR-057)" },
    { t: "Secrets chỉ ở env/dashboard - không commit; audit_logs ghi mọi thao tác nhạy cảm" },
  ], { y: 4.1, fontSize: 11.5 });
}

divider("PHẦN II", "Kiến trúc tổng thể", "Modular monolith - vì sao KHÔNG phải microservices");

// 6 - Monolith la gi o day
{
  const s = p.addSlide();
  slideTitle(s, "PHÂN TÍCH", "SCN là modular monolith - cấu trúc bên trong");
  table(s, [
    ["Bounded context (module)", "Đường route", "Dữ liệu riêng"],
    ["Chủ nhiệm (GVCN)", "records/, attendance/, academics/", "hồ sơ, điểm danh, điểm số"],
    ["Sổ chủ nhiệm", "register/", "seating, KPI, signoff, events"],
    ["Hạnh kiểm - cố vấn", "conduct/, counseling/", "conduct_records, cases"],
    ["Truyền thông PH", "parents/, announcements", "messages, appointments"],
    ["Hoạt động - an toàn", "activities/, safety/", "activities, incidents"],
    ["Thi đua - năng lực", "emulation/, competency/", "scores, evidence"],
    ["Tuyển sinh", "school/admissions/, apply/ (public)", "admission_campaigns, applications"],
    ["Khoản thu", "finance/", "fee_items, periods, receipts"],
    ["LMS-lite", "lms/ + portal/student/bai-thi", "exam_sessions, submissions"],
    ["Thư viện", "library/", "catalog, dang_ky_ca_biet, loans"],
    ["Biến động HS", "movements/", "movement_requests (RPC-only writes)"],
    ["Quản trị (BGH/Sở/Tổ)", "school/, dept/, team/", "views aggregate, school_features"],
    ["Shared kernel", "lib/auth, rbac, supabase, utils", "profiles, schools, notifications"],
  ], { rowH: 0.42 });
  note(s, "15 bounded contexts. Module = route group + bảng riêng + policy riêng + module flag - tắt flag là tắt cả 4 lớp (nav/route/RPC/RLS), không chỉ ẩn menu.");
}

// 7 - Microservices analysis
{
  const s = p.addSlide();
  slideTitle(s, "PHÂN TÍCH", "Vì sao KHÔNG microservices - phân tích theo bài toán");
  table(s, [
    ["Tiêu chí", "Modular monolith (đã chọn)", "Microservices"],
    ["Team vận hành", "1-2 dev + agent - 1 service duy nhất", "Mỗi service cần owner, monitoring, on-call riêng"],
    ["Nhất quán dữ liệu", "ACID trong 1 Postgres - period_absences upsert attendance_records trong 1 transaction", "Saga/eventual consistency cho cùng thao tác - phức tạp hơn nhiều"],
    ["Độ trễ trong domain", "Function call trong process - join trực tiếp 86 bảng", "Network call giữa services, join qua API - dashboard aggregate rất đắt"],
    ["Phân quyền", "RLS dùng chung my_role()/my_school_id() - một lần định nghĩa", "Phải tái tạo policy ở từng service hoặc thêm service mesh/authz layer"],
    ["Deploy/rollback", "1 deploy, 1 rollback - atomic", "Version matrix N services - contract testing bắt buộc"],
    ["Chi phí", "1 Vercel project + 1 Supabase - ~$45/tháng cap", "N projects + N DB + broker + observability - gấp nhiều lần"],
  ], { rowH: 0.62 });
}

// 8 - Khi nao can microservices
{
  const s = p.addSlide();
  slideTitle(s, "PHÂN TÍCH", "Microservices có bao giờ đúng cho SCN không");
  bullets(s, [
    { t: "Dấu hiệu cần tách service - và thực tế SCN", b: true },
    { t: "Team >10 dev dẫm chân nhau", sub: ["SCN: đội rất nhỏ, conflict giải quyết bằng module boundaries + code review"] },
    { t: "Một module có load profile khác hẳn", sub: ["SCN: mọi module đều CRUD dashboard - không có hot path cần scale riêng"] },
    { t: "Cần ngôn ngữ/stack khác cho một phần", sub: ["SCN: chỉ phần xuất file nặng compute - đã xử lý phía client (pptxgenjs/docx chạy trong browser)"] },
    { t: "Domain tách được không cần join", sub: ["SCN: ngược lại - điểm danh chéo sổ đầu bài, KPI tổng hợp nhiều nguồn - chống tách"] },
    { t: "Kết luận", b: true, sub: ["Microservices ở quy mô này = distributed monolith tệ hơn monolith tốt. Sau wave CR-060..067 (5 module mới) kết luận càng đúng: tuyển sinh -> nhập học -> khoản thu -> học bạ là 1 chuỗi transaction - chống tách tuyệt đối. Điểm tách hợp lý duy nhất: AI jobs - đã tách thành async pattern (ai_jobs + callback)."] },
  ], { fontSize: 13 });
}

// 9 - Repo topology
{
  const s = p.addSlide();
  slideTitle(s, "PHÂN TÍCH", "Repo topology: một repo một sản phẩm, không phải monorepo");
  table(s, [
    ["Tiêu chí", "Repo riêng hiện tại (đã chọn)", "Monorepo (turborepo/Nx)"],
    ["Thực tế", "SCN là 1 repo độc lập, single-package (không workspaces), push master - deploy đúng project", "Một repo chứa nhiều apps + packages chung"],
    ["Deploy boundary", "Push master repo nào - deploy đúng project đó, đơn giản tuyệt đối", "Cần affected-graph để không deploy lại cả ứng dụng khi sửa shared lib"],
    ["Code chia sẻ", "Chia sẻ qua harness scripts/skills vendored vào repo - không phải packages", "Shared packages import trực tiếp - tiện nhưng couple phiên bản"],
    ["Blast radius", "Lỗi/secret/bug giới hạn trong 1 repo", "Một commit xấu có thể phá nhiều app cùng lúc"],
    ["Quyền truy cập", "Repo-level - dễ cấp quyền từng sản phẩm", "Cần CODEOWNERS phức tạp để chặn chéo"],
    ["Phù hợp bài toán", "SCN độc lập lifecycle/khách hàng - không share domain model với ai", "Chỉ đúng nếu nhiều app chia sẻ domain model chung - SCN không có nhu cầu đó"],
  ], { rowH: 0.62 });
  note(s, "SCN là bounded context hoàn chỉnh - repo riêng phản ánh đúng ranh giới deploy và ranh giới domain.");
}

divider("PHẦN III", "Kiến trúc dữ liệu", "1 Postgres - multi-tenant bằng RLS - schema-per-app bằng naming");

// 11 - Data topology
{
  const s = p.addSlide();
  slideTitle(s, "PHÂN TÍCH", "Topology dữ liệu - 3 cấp độ chia sẻ");
  table(s, [
    ["Cấp", "Thực tế SCN", "Phương án thay thế", "Đánh giá"],
    ["Giữa các sản phẩm", "Chung 1 Supabase project với một app nội bộ khác - tách bằng table naming + RLS", "DB riêng cho SCN", "Chung = rẻ + ít ops; rủi ro: nhiễu resource, tách bằng naming + RLS chứ không mạnh bằng DB riêng"],
    ["Giữa các trường (tenant)", "Shared tables + school_id + RLS policy", "Schema-per-school / DB-per-school", "Shared+RLS = query/migration đơn giản, onboard trường mới = insert rows; schema-per-school chỉ đúng khi compliance bắt buộc cô lập cứng"],
    ["Bên trong 1 app", "86 bảng public quan hệ chặt + views + RPC (SCN dùng schema public; app khác ở schema riêng)", "Nhiều schema/DB theo bounded context", "Join chéo là yêu cầu cốt lõi (attendance_daily gộp 2 nguồn, học bạ kéo điểm + HK + chuyên cần) - 1 DB là điều kiện cần"],
  ], { rowH: 0.85 });
  note(s, "Ưu tiên đơn giản vận hành: 1 project, RLS làm việc nặng phân tách ở mọi cấp. Schema-per-app đã có sẵn như seam tách project sau này.");
}

// 12 - Consistency & integrity
{
  const s = p.addSlide();
  slideTitle(s, "PHÂN TÍCH", "Nhất quán dữ liệu - lý do số 1 chọn monolith");
  bullets(s, [
    { t: "Cross-module consistency bằng transaction, không bằng event", b: true },
    { t: "Điểm danh hai nguồn hợp nhất", sub: ["Ghi period_absences - upsert attendance_records (source='period_log') - view attendance_daily gộp: hai màn hình không bao giờ mâu thuẫn. Microservices sẽ cần saga + eventual consistency cho cùng việc này."] },
    { t: "Dashboard = SQL views, không phải cache", sub: ["dashboard_gvcn aggregate trực tiếp - luôn đúng, không có cache invalidation problem; count ở DB thay vì fetchAllRows"] },
    { t: "Invariant tại DB", sub: ["check constraints cho enum mở rộng được, triggers sinh notifications - quy tắc nghiệp vụ sống ở tầng không thể bypass"] },
    { t: "Atomic ở nghiệp vụ nhạy cảm", sub: ["Số biên lai + số ĐKCB đánh atomic theo trường trong RPC (không race khi 2 kế toán thu cùng lúc); mượn/trả sách check tồn trong 1 transaction"] },
    { t: "Movement qua security-definer RPC", sub: ["Biến động HS: direct table write bị revoke - duyệt chuyển/bảo lưu chỉ qua RPC, snapshot tên+lớp tại thời điểm yêu cầu (audit-sound)"] },
    { t: "Đánh đổi chấp nhận", sub: ["Lock dài trên bảng nóng (attendance) khi lớp lớn lưu đồng loạt - chưa là vấn đề ở quy mô trường học VN; nếu có sẽ giải bằng upsert batch + ít transaction hơn"] },
  ], { fontSize: 12.5 });
}

// 13 - Async model
{
  const s = p.addSlide();
  slideTitle(s, "PHÂN TÍCH", "Mô hình async - có, nhưng không có broker");
  table(s, [
    ["Nhu cầu async", "Cơ chế hiện tại", "Tại sao đủ", "Khi nào không đủ"],
    ["Cron định kỳ (digest PH, radar sync)", "Vercel cron - /api/cron/*", "2 jobs, tần suất thấp - broker thừa", "Hàng chục jobs tần suất cao"],
    ["AI job dài (TTS, sinh đề)", "Bảng ai_jobs + Devin session async + /api/ai/devin-callback (token per-job)", "Job chạy ngoài request - DB làm queue trạng thái", "Throughput hàng nghìn job/phút cần SQS/Redis thật"],
    ["Webhook nhận (Resend)", "/api/webhooks/resend", "Route Handler xác thực signature - chuẩn", "-"],
    ["Realtime UI", "Client poll qua useAiJob + router.refresh", "Tần suất thấp, độ trễ giây chấp nhận được", "Collaboration thật (nhiều người sửa cùng lúc) sẽ cần Supabase Realtime"],
  ], { rowH: 0.78 });
  note(s, "Nguyên tắc: DB + cron + webhook đáp ứng mọi nhu cầu async hiện tại - thêm broker chỉ khi có số đo chứng minh cần.");
}

// 14 - Caching & perf model
{
  const s = p.addSlide();
  slideTitle(s, "PHÂN TÍCH", "Caching & performance - tối giản có chủ đích");
  bullets(s, [
    { t: "Không Redis/Memcached - và không cần ở quy mô này", b: true },
    { t: "React cache() cho getProfile", sub: ["Dedup auth lookup trong 1 request - layout+page+actions gọi tự do không tốn roundtrip"] },
    { t: "Static shell + RSC streaming", sub: ["Splash '/' prerender - TTFB p95 ~450ms; loading.tsx skeleton mọi route group - paint tức thì trước khi data về"] },
    { t: "Đẩy compute xuống đúng tầng", sub: ["Aggregate ở SQL views (DB gần data); xuất file docx/pptx ở browser (không tốn server CPU); KaTeX render client"] },
    { t: "Cache tầng Vercel CDN", sub: ["Static assets + ISR mặc định của Next - không tự quản cache layer"] },
    { t: "Khi nào cần thêm cache", sub: ["Dashboard aggregate chậm ở hàng nghìn trường - materialized views hoặc Redis; hiện chưa có số đo nào đòi hỏi"] },
  ], { fontSize: 12.5 });
}

divider("PHẦN IV", "So sánh & đánh giá", "Phương án tổng thể - ưu nhược - mức độ phù hợp");

// 16 - So sanh kien truc tong the
{
  const s = p.addSlide();
  slideTitle(s, "SO SÁNH", "4 kiến trúc tổng thể cho cùng bài toán");
  table(s, [
    ["Tiêu chí", "Modular monolith serverless (đã chọn)", "Microservices", "Monolith VPS truyền thống", "Low-code / LMS có sẵn"],
    ["Phức tạp vận hành", "Thấp nhất", "Cao nhất", "Trung bình", "Thấp"],
    ["Nhất quán 10 vai trò x 86 bảng", "ACID + RLS - chặt nhất", "Eventual - khó đảm bảo", "ACID được, RLS tự viết", "Hạn chế customize"],
    ["Time-to-market", "Nhanh nhất", "Chậm nhất", "Trung bình", "Nhanh cho CRUD, kẹt nghiệp vụ VN"],
    ["Chi phí ở quy mô trường", "~$45/tháng cap cứng", ">> gấp nhiều lần", "VPS rẻ + công ops", "Per-seat đắt khi scale"],
    ["Đường thoát khi scale", "Tách module nóng thành service khi có số đo", "Đã phân mảnh sẵn nhưng trả giá từ ngày 1", "Scale-up giới hạn", "Lock-in cứng"],
  ], { rowH: 0.62 });
}

// 17 - Uu diem
{
  const s = p.addSlide();
  slideTitle(s, "ĐÁNH GIÁ", "Ưu điểm của kiến trúc đã chọn");
  bullets(s, [
    { t: "Bảo mật theo thiết kế, không theo kỷ luật", b: true, sub: ["RLS ở DB = lớp cuối bất khả xâm phạm kể cả khi app bug; 10 vai trò phức tạp vẫn default-deny"] },
    { t: "Nhất quán dữ liệu tuyệt đối", sub: ["Một Postgres - cross-module invariants trong transaction; điểm danh hai nguồn không bao giờ lệch"] },
    { t: "Tốc độ phát triển cao", sub: ["Server Actions + generated types + SQL trực tiếp; feature mới không cần plumbing API"] },
    { t: "Zero-ops thật", sub: ["1 deployable, git push = deploy, rollback 1 click; monitoring Upptime + weekly harness tự audit"] },
    { t: "Chi phí dự đoán được", sub: ["Spend cap toàn chuỗi - thiết kế zero-overage từ đầu, không phải vá sau"] },
    { t: "Module boundaries rõ", sub: ["Route groups = bounded contexts; tách được thành service sau này nếu có số đo - không bị khóa"] },
  ], { fontSize: 12.5 });
}

// 18 - Nhuoc diem
{
  const s = p.addSlide();
  slideTitle(s, "ĐÁNH GIÁ", "Nhược điểm & cách giảm thiểu - nói thẳng");
  table(s, [
    ["Nhược điểm / rủi ro", "Mức độ", "Giảm thiểu / đường thoát"],
    ["Single point of failure: 1 app chết - cả hệ thống chết", "Cao về mặt lý thuyết", "Vercel multi-region sin1 + static shell vẫn serve khi function lỗi; blast radius nhỏ vì CRUD"],
    ["Chung Supabase project với app nội bộ khác - nhiễu resource", "Trung bình", "Tách project khi một bên tăng trưởng; naming + RLS đã chuẩn bị sẵn cho việc tách"],
    ["RLS khó test + ~30 bảng phức tạp", "Cao - complexity thật", "Convention: test policy từng vai trò bằng execute_sql trước khi wire UI; complexity này có ở mọi phương án"],
    ["Không có broker - async quy mô lớn sẽ kẹt", "Thấp ở quy mô hiện tại", "ai_jobs pattern đã có; thêm queue khi throughput đòi hỏi"],
    ["Vendor lock-in nhẹ", "Trung bình", "Postgres chuẩn + code tách lib/supabase/* - migrate được"],
    ["Server Actions kém audit hơn REST rõ ràng", "Thấp", "checkActionRole bắt buộc + audit_logs mọi mutation nhạy cảm"],
  ], { rowH: 0.62 });
}

// 19 - Scaling path
{
  const s = p.addSlide();
  slideTitle(s, "ĐÁNH GIÁ", "Đường scale - gãy ở đâu trước, xử lý thế nào");
  table(s, [
    ["Quy mô", "Điểm gãy đầu tiên", "Đường xử lý (đã chuẩn bị trong thiết kế)"],
    ["100-500 trường", "Dashboard aggregate chậm", "Materialized views + index; pattern sẵn - đổi cách đọc không đổi kiến trúc"],
    ["1.000-5.000 trường", "Connection pool + write hotspot attendance", "Supabase pooler + partition attendance_records theo academic_year; tách Supabase project riêng cho SCN"],
    ["AI throughput cao", "ai_jobs poll-based kẹt", "Thay bằng queue thật (Supabase pgmq / SQS) - seam đã có sẵn ở useAiJob + callback"],
    ["Nhiều tenant lớn (Sở toàn tỉnh)", "RLS evaluation cost trên bảng lớn", "Partition theo school_id hoặc schema-per-dept - RLS đã có school_id sẵn"],
    ["Team lớn hơn", "Monolith conflict", "Tách module nóng ra service - route group boundaries đã là bounded context sẵn"],
  ], { rowH: 0.72 });
  note(s, "Nguyên tắc kiến trúc: mọi seam tách (ai_jobs, RLS school_id, route groups) đã được đặt sẵn - scale = đổi bên trong seam, không phải viết lại.");
}

// 19b - Limitations hien tai + do kho xu ly
{
  const s = p.addSlide();
  slideTitle(s, "ĐÁNH GIÁ", "Limitation đang có - xử lý ra sao, dễ hay khó");
  table(s, [
    ["Limitation", "Cách xử lý", "Độ khó / Trạng thái"],
    ["Edge-TTS bị MS chặn IP datacenter Vercel - audio TTS lỗi trên prod", "Fork @andresaya/edge-tts (Sec-MS-GEC v2) + Gemini TTS provider fallback (CR-056)", "Xong - độ khó trung bình; chuỗi fallback provider đã có sẵn"],
    ["Chung Supabase project: 3 schema app khác cùng project - noisy neighbor đụng IO budget", "CR-058: cô lập theo schema đã có; tách hẳn sang project riêng vẫn pending cutover", "Trung bình - cần Pro project mới + cutover có downtime nhỏ; không phải viết lại code"],
    ["Cổng public /apply - surface đầu tiên không cần login", "CR-063 hardening: Turnstile + revoke anon + chỉ RPC security-definer ghi được", "Xong - đã deploy kèm tính năng"],
    ["252 RLS policy bare auth.uid() - evaluate lại mỗi row", "CR-057: wrap (select auth.uid()) toàn bộ - 1 lần/statement; advisors sạch", "Xong - dễ về kỹ thuật, rườm về khối lượng"],
    ["Authed bulk scrape (user hợp lệ script cào)", "Lớp 1 đã deploy (export cap 20/h + captcha); lớp 2: port check_rate_limit per-uid sang public schema", "Dễ-trung bình - pattern có sẵn, migration nhỏ"],
    ["AI jobs poll-based (không queue thật)", "Thêm pgmq/SQS khi throughput đòi hỏi - seam ai_jobs + callback đã đặt", "Trung bình - đổi bên trong seam, giữ API"],
    ["LMS chấm tự động: essay_pending vẫn cần GV chấm tay; gian lận thi cử online chưa có chống chéo nâng cao", "Chấp nhận ở mức bài tập lớp học; nâng cấp: chống tab-switch, giám sát webcam nếu làm thi thật", "Trung bình - tính năng mới, chưa phải lỗi"],
    ["SPOF: 1 deployable + 1 Supabase project", "Chấp nhận một phần: Vercel sin1 + static shell; Supabase backup managed", "Khó khắc phục hoàn toàn ở budget này - multi-region là quyết định chi phí"],
  ], { rowH: 0.72 });
}

// 20 - Phu hop
{
  const s = p.addSlide();
  slideTitle(s, "ĐÁNH GIÁ", "Mức độ phù hợp với bài toán - bảng đối chứng");
  table(s, [
    ["Yêu cầu bài toán", "Kiến trúc đáp ứng thế nào"],
    ["10 vai trò, phân quyền phức tạp", "RLS 3 lớp + requireRole + mergedNav - điểm mạnh số 1 của lựa chọn này"],
    ["Dữ liệu liên kết chặt (điểm danh chéo, KPI tổng hợp)", "1 Postgres + transaction - microservices sẽ phá vỡ đúng chỗ này"],
    ["Nghiệp vụ trường học VN đặc thù", "Schema chuyên biệt (sổ đầu bài, thi đua, HK), không ép vào LMS quốc tế"],
    ["Demo/bán hàng nhiều vai trò", "Demo accounts + role preview mượt, RLS vẫn chặt (ADR-5)"],
    ["Đội nhỏ, không ops", "Zero-ops serverless - monolith VPS hay microservices đều cần người vận hành"],
    ["Không vượt ngân sách", "Spend cap toàn chuỗi enforce bằng công cụ"],
    ["Bán theo gói cho trường", "school_features + gating 4 lớp - feature flags ở tầng kiến trúc, không phải if-else UI"],
    ["Cổng public cho phụ huynh tuyển sinh", "Route /apply ngoài auth + Turnstile + RPC-only writes - public không đồng nghĩa mở toang"],
    ["Xuất tài liệu hành chính", "docx/pptxgenjs/xlsx/print CSS client-side - không tốn server"],
  ], { rowH: 0.56 });
}

// 21 - Ket luan
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addShape(p.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: C.teal2 } });
  s.addText("KẾT LUẬN", { x: 0.9, y: 1.5, w: 4, h: 0.5, fontFace: FONT, fontSize: 15, color: C.teal2, bold: true });
  s.addText("Modular monolith serverless - đúng bài toán, đúng quy mô", { x: 0.9, y: 2.1, w: 11.5, h: 1.1, fontFace: FONT, fontSize: 34, bold: true, color: C.white });
  bullets(s, [
    { t: "Microservices cho bài toán này = trả giá distributed systems cho lợi ích không cần: dữ liệu liên kết chặt chống tách, đội nhỏ chống ops nặng", c: C.white },
    { t: "Repo riêng single-package thay monorepo: SCN là bounded context hoàn chỉnh, deploy boundary = domain boundary", c: C.white },
    { t: "RLS biến yêu cầu khó nhất (phân quyền đa vai trò) thành thế mạnh; 1 Postgres giữ nhất quán mà không cần saga - kể cả chuỗi tuyển sinh -> nhập học -> thu phí -> học bạ", c: C.white },
    { t: "Module flags (school_features) đưa 'bán theo gói' xuống tầng kiến trúc: tắt flag = nav + route + RPC + RLS cùng tắt", c: C.white },
    { t: "Không broker/Redis vì chưa có số đo đòi hỏi - seams (ai_jobs, cron, route groups, schema-per-app) đã đặt sẵn để thêm khi scale chứng minh cần", c: C.white },
    { t: "Đánh đổi lớn nhất chấp nhận: SPOF 1 deployable + shared Supabase - cả hai đều có đường thoát rõ khi quy mô đòi hỏi", c: C.white },
  ], { x: 0.9, y: 3.5, w: 11.5, fontSize: 13.5 });
  s.addText("Tài liệu kèm: USER-GUIDE-vieschool.pptx (43 slides, 10 vai trò + module mở rộng) - docs/project/ARCHITECTURE.md (chi tiết kỹ thuật)", { x: 0.9, y: 6.5, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 11, color: "94a3b8" });
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
  console.log(`Written ${OUT} - ${slideNames.length} slides (transitions injected)`);
}
