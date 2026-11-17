/**
 * VIESCHOOL PITCH DECK (English) - for NVIDIA Inception / investor intro.
 * Structure: cover, problem, solution, products (4 suites), traction,
 * market, business model, competition, technology + NVIDIA fit, roadmap,
 * team, ask.
 * node scripts/gen-vieschool-pitchdeck-pptx.mjs
 *   -> docs/handover/VIESCHOOL-PITCH-DECK.pptx
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
  s.addText("VieSchool", { x: 0.8, y: 1.7, w: 11.7, h: 1.1, fontFace: FONT, fontSize: 44, bold: true, color: C.white });
  s.addText("The operating system for Vietnam's K-12 schools", {
    x: 0.8, y: 2.85, w: 11.7, h: 0.55, fontFace: FONT, fontSize: 18, color: "5eead4" });
  s.addText("School management (SCN) + teacher toolkit (TVC360 Studio) - one multi-tenant platform, live in production", {
    x: 0.8, y: 3.5, w: 11.7, h: 0.45, fontFace: FONT, fontSize: 13.5, color: "94a3b8" });
  s.addText("sochunhiem.vieschool.com - November 2026", {
    x: 0.8, y: 4.1, w: 11.7, h: 0.45, fontFace: FONT, fontSize: 11.5, italic: true, color: "64748b" });
}

// ============ S2 Problem ============
{
  const s = p.addSlide();
  slideTitle(s, "PROBLEM", "Vietnamese schools still run on paper and fragmented tools");
  bullets(s, [
    { t: "Homeroom teachers spend hours weekly on manual records: paper class registers, attendance books, grade books, hand-written report cards", b: true },
    { t: "Fragmented systems: separate tools for grades, fees, library, health records - same fact entered multiple times, reports contradict each other", b: true },
    { t: "Compliance burden: Ministry formats (TT22 grading, QD 3016 digital records, BHYT student insurance) exported by hand - error-prone", b: true },
    { t: "Parent communication is ad-hoc (personal Zalo/Facebook) - no consent tracking, no audit trail, no school-wide reach", b: true },
    { t: "Incumbent school-management suites are legacy desktop-era systems: weak UX, no AI, limited parent/student portals, per-school installs", b: true },
    { t: "Result: administrative work eats teaching time, and school leadership has no real-time operational picture", c: C.accent },
  ]);
}

// ============ S3 Solution ============
{
  const s = p.addSlide();
  slideTitle(s, "SOLUTION", "One multi-tenant platform, sold as modular suites");
  bullets(s, [
    { t: "So Chu Nhiem So (SCN) - the school operating system: attendance, gradebooks, digital student records, admissions, finance, health, library, documents, scheduling", b: true },
    { t: "TVC360 Studio - the teacher toolkit embedded in SCN: 21,000+ question bank aligned to Ministry standards, lesson planning (CV 5512), LMS quizzes, DOCX/PPTX export, TTS audio", b: true },
    { t: "One business fact lives in one place and syncs everywhere - period-log absence updates daily attendance; grades flow into report cards automatically", b: true },
    { t: "Regulation-native: TT22/2021 semester/year averages, QD 3016 XML exports with two-level digital signing, BHYT cards, VNeID-ready identity columns", b: true },
    { t: "Self-service onboarding: a school signs up at sochunhiem.vieschool.com and gets its own tenant - no install, no IT staff needed", b: true, c: C.accent },
  ]);
}

// ============ S4 Products - 4 suites ============
{
  const s = p.addSlide();
  slideTitle(s, "PRODUCT", "Four sellable suites (module flags already in the codebase)");
  const mods = [
    ["1", "SCHOOL MANAGEMENT", "Admissions (public apply portal), fee collection with VietQR/SePay reconciliation, student records + signed XML exports, attendance, graduation, health/BHYT, library, official documents, boarding meals, facilities", C.accent],
    ["2", "PARENT & STUDENT CARE", "Parent/student portals, omnichannel announcements (email live; Zalo OA/SMS ready), weekly digests, admissions acquisition funnel, counseling & safety, merit tracking", C.blue],
    ["3", "TEACHING SERVICES (TVC360)", "21k+ question bank covering 81/81 standards, two-level review (department -> principal), KHBD lesson plans, auto-graded online quizzes, DOCX/PPTX export, multi-provider TTS, AI drafting", C.amber],
    ["4", "REPORTS & INTEGRATIONS", "Dashboards per level (teacher / principal / campus / province / ward), finance reports, integration framework (connectors + outbox), payment webhooks, signed XML, VNeID prep, public APIs", C.green],
  ];
  mods.forEach(([n, t, d, c], i) => {
    card(s, { x: 0.7 + (i % 2) * 6.1, y: 1.95 + Math.floor(i / 2) * 2.45, w: 5.85, h: 2.25, title: `${n}. ${t}`, body: d, color: c });
  });
  note(s, "Suites map 1:1 to SUITES in code - schools buy what they need, upgrade over time; pricing is per-school, per-module SaaS");
}

// ============ S5 Traction ============
{
  const s = p.addSlide();
  slideTitle(s, "TRACTION", "Live in production - not a concept deck");
  const stats = [
    ["148", "production routes", C.accent],
    ["~450", "automated tests passing", C.blue],
    ["~350", "RLS policies enforcing tenancy", C.accent],
    ["21k+", "standards-aligned questions", C.amber],
    ["11", "staff roles + multi-role", C.blue],
    ["3", "live demo school tenants", C.green],
    ["82", "change requests shipped", C.accent],
    ["7.5", "months 0 -> production", C.blue],
  ];
  stats.forEach(([n, t, c], i) => {
    const x = 0.7 + (i % 4) * 3.05, y = 2.0 + Math.floor(i / 4) * 2.15;
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.85, h: 1.9, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, width: 1 } });
    s.addText(n, { x, y: y + 0.15, w: 2.85, h: 0.9, align: "center", fontFace: FONT, fontSize: 34, bold: true, color: c });
    s.addText(t, { x: x + 0.15, y: y + 1.15, w: 2.55, h: 0.65, align: "center", fontFace: FONT, fontSize: 10.5, color: C.muted });
  });
  note(s, "Every commit passes: typecheck, lint, build, 446 tests, consistency, reliability, RTM coverage, security scans - production demo at sochunhiem.vieschool.com");
}

// ============ S6 Market ============
{
  const s = p.addSlide();
  slideTitle(s, "MARKET", "Vietnam K-12 - large, regulated, under-digitized");
  bullets(s, [
    { t: "~40,000+ K-12 schools nationwide (primary, lower-secondary, upper-secondary) with ~17-18M students - every school runs the same Ministry workflows we digitize", b: true },
    { t: "Government mandate tailwind: national digital-transformation program for education, mandatory digital student records (QD 3016), standardized grading (TT22/2021)", b: true },
    { t: "Beachhead: private and semi-public schools that self-fund SaaS; expansion into public schools via provincial education departments (So GD&DT) as anchor accounts", b: true },
    { t: "Expansion paths: boarding/meal services, library, health records, teacher toolkit as attach modules - land with core management, expand into suites", b: true },
    { t: "Long-term: 1M+ users (students + teachers + parents) across 500-1,000 schools is ~2-3% of the addressable base", c: C.accent },
  ]);
}

// ============ S7 Business model ============
{
  const s = p.addSlide();
  slideTitle(s, "BUSINESS MODEL", "SaaS per school, per module - land and expand");
  table(s, [
    ["Layer", "Model", "Note"],
    ["Core platform", "Per-school annual SaaS", "Attendance, gradebooks, records, RBAC - the wedge"],
    ["Module suites", "Add-on subscriptions", "Finance, health/BHYT, library, boarding, documents - priced per school"],
    ["Teacher toolkit (TVC360)", "Per-teacher or school bundle", "Question bank + lesson plans + LMS - co-sold with partner channel"],
    ["Value-added services", "Usage-based", "AI generation, document exports, payment reconciliation, SMS/Zalo delivery"],
    ["Public portal", "Acquisition channel", "Free admissions apply portal funnels parents into the platform"],
  ], { fontSize: 11, rowH: 0.62, y: 1.95 });
  note(s, "Pilot strategy: free pilots 3-5 schools -> paid conversion; revenue-share clock starts at first paying customer");
}

// ============ S8 Competition ============
{
  const s = p.addSlide();
  slideTitle(s, "COMPETITION", "Why we win against incumbents");
  table(s, [
    ["", "vnEdu / SMAS / MISA EMIS", "VieSchool"],
    ["Architecture", "Legacy desktop-era, per-school installs, module sales by division", "Multi-tenant cloud SaaS, self-service onboarding"],
    ["Regulation", "Compliance patched in over years", "TT22/QD3016/BHYT designed-in from day one"],
    ["AI", "Add-on announcements", "Deep in workflows: drafting, grading help, insights - multi-provider fallback, no single-vendor risk"],
    ["Parent channel", "Separate apps, extra fees", "Built-in omnichannel: email live, Zalo/SMS-ready, admissions funnel = free acquisition"],
    ["Extensibility", "Closed systems", "Integration framework (connectors + outbox) ready for payment, e-invoice, public-service APIs"],
    ["Price", "Enterprise sales, per-module vendors", "Transparent SaaS per school; buy one suite or all four"],
  ], { fontSize: 10, rowH: 0.62, y: 1.9 });
  note(s, "Defensibility: regulation-native data model + tenant-isolated architecture + question bank content = years to replicate");
}

// ============ S9 Technology ============
{
  const s = p.addSlide();
  slideTitle(s, "TECHNOLOGY", "Modern stack, engineered for scale and auditability");
  bullets(s, [
    { t: "Next.js 16 + React 19 + TypeScript strict - 148 routes, server-rendered, stateless on Vercel", b: true },
    { t: "Supabase Postgres + Auth + RLS (~350 policies): tenant isolation enforced at the database - not at the application layer", b: true },
    { t: "Atomic business logic: security-definer RPCs for money (fee_record_transfer), CAS transitions, idempotent migrations", b: true },
    { t: "Resilient AI: multi-key, multi-model fallback across Gemini/OpenAI/Anthropic plus async job queue - operations never block on AI failure; PII redaction before prompts", b: true },
    { t: "Async outbox pattern for integrations (int_outbox, comm_outbox) - connectors, webhooks, cron drains with backoff + dead-letter", b: true },
    { t: "Automated quality gates: ~450 tests, RTM coverage 95+ acceptance criteria, reliability + raw-error scanners, RLS nav-access checks", b: true, c: C.accent },
  ]);
}

// ============ S10 NVIDIA fit ============
{
  const s = p.addSlide();
  slideTitle(s, "NVIDIA FIT", "Where GPU acceleration enters our roadmap");
  table(s, [
    ["Workload", "Today", "With NVIDIA technology"],
    ["Vietnamese TTS", "Cloud TTS APIs (multi-provider)", "Riva for low-latency Vietnamese speech - offline classroom audio, per-school inference"],
    ["Document digitization", "Manual record entry", "GPU document AI/OCR: paper grade books, handwritten records, administrative forms"],
    ["LLM inference", "Gemini/OpenAI/Anthropic APIs", "NIM self-hosted inference for data-privacy-sensitive schools and provinces - data stays on-premise"],
    ["Edge deployments", "Cloud-only", "Jetson-class edge for school LANs with weak connectivity - local inference + sync"],
    ["Analytics", "Postgres OLTP", "RAPIDS/cuDF for province-scale cross-school analytics on the data warehouse tier"],
  ], { fontSize: 10.5, rowH: 0.68, y: 1.95 });
  note(s, "Privacy driver: student data is sensitive - on-prem/edge GPU inference lets us serve schools and provinces that cannot send data to public AI APIs");
}

// ============ S11 Roadmap ============
{
  const s = p.addSlide();
  slideTitle(s, "ROADMAP", "Scale plan - spend follows traction, not ahead of it");
  table(s, [
    ["Stage", "Milestone", "Engineering focus"],
    ["Now -> ~15 schools", "Paying pilots, SLA-proven", "Supabase Pro + compute tier-up, table partitioning, observability (Sentry + metrics), credentials for payments/Zalo/e-invoice"],
    ["15 -> 100 schools", "Province-level accounts", "Public portal split, read replicas, export/notify worker services, edge caching"],
    ["100 -> 1,000 schools (~1M users)", "Multi-region platform", "Tenant sharding across database clusters, containerized heavy compute, BigQuery-scale analytics, edge AI inference"],
    ["Beyond", "National data layer", "Domain services only where load/team size proves need - modular monolith first, not premature microservices"],
  ], { fontSize: 10.5, rowH: 0.85, y: 1.95 });
  note(s, "Architecture decision: bottleneck is Postgres row-volume and RLS cost, not app code - we shard by tenant (school_id already the natural key)");
}

// ============ S12 Team + Ask ============
{
  const s = p.addSlide();
  slideTitle(s, "TEAM & ASK", "Lean team, proven delivery");
  s.addText("TEAM", { x: 0.7, y: 1.9, w: 5.8, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.ink });
  bullets(s, [
    { t: "Binh - Fullstack lead (100%): architecture, product, all 82 CRs", b: true },
    { t: "Phien - Backend (100%): Postgres/RLS, RPCs, integrations", b: true },
    { t: "Lan - QA (100%): regression, E2E, security edge cases", b: true },
    { t: "PM/BA (30%): requirements, pilots, partner liaison", b: true },
    { t: "Delivery record: 0 -> production in 7.5 months, ~450 tests, 82 CRs through external review loops", c: C.accent },
  ], { x: 0.7, y: 2.3, w: 5.9, h: 4.2, fontSize: 11.5 });
  s.addText("WHAT WE ASK FROM NVIDIA", { x: 6.8, y: 1.9, w: 5.8, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.green });
  bullets(s, [
    "Technical guidance: Riva Vietnamese TTS, NIM deployment patterns for on-prem school/province inference",
    "Go-to-market: introductions to education and public-sector partners in SEA",
    "Hardware path: evaluation hardware/discounts for Jetson edge pilots in low-connectivity schools",
    "Ecosystem: Inception program benefits - training credits, VC visibility, co-marketing",
    { t: "We bring: a production platform with real workflows and a distribution partner for Vietnamese K-12", c: C.green },
  ], { x: 6.8, y: 2.3, w: 5.8, h: 4.2, fontSize: 11.5 });
}

// ============ S13 Close ============
{
  const s = p.addSlide();
  s.background = { color: C.code };
  s.addText("VieSchool", { x: 0.8, y: 2.2, w: 11.7, h: 1, fontFace: FONT, fontSize: 36, bold: true, color: C.white });
  s.addText("Live product. Regulated market. GPU-ready roadmap.", {
    x: 0.8, y: 3.15, w: 11.7, h: 0.55, fontFace: FONT, fontSize: 17, color: "5eead4" });
  s.addText("sochunhiem.vieschool.com - demo accounts on request", {
    x: 0.8, y: 3.85, w: 11.7, h: 0.45, fontFace: FONT, fontSize: 13, color: "94a3b8" });
}

mkdirSync("docs/handover", { recursive: true });
await p.writeFile({ fileName: "docs/handover/VIESCHOOL-PITCH-DECK.pptx" });
console.log("wrote docs/handover/VIESCHOOL-PITCH-DECK.pptx -", p._slides.length, "slides");
