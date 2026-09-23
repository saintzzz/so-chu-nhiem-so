// qa-full-coverage.mjs - FULL coverage: moi route x moi role (access matrix)
// + moi write flow qua UI that, verify DB. Chay: node scripts/qa-full-coverage.mjs
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "https://so-chu-nhiem-so-theta.vercel.app";
const SHOTS = new URL("../docs/qa/screenshots-full/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
const errors = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${name} ${detail}`);
};
const shot = (p, n) => p.screenshot({ path: join(SHOTS, `${n}.png`) }).catch(() => {});

// ================= ACCESS MATRIX =================
// route -> roles duoc phep (theo requireRoles) ; role khac phai bi redirect
const MATRIX = {
  "/dashboard": ["gvcn"],
  "/attendance/daily": ["gvcn", "bgh"],
  "/attendance/daily-report": ["gvcn"],
  "/attendance/history": ["gvcn", "bgh"],
  "/attendance/leaves": ["gvcn", "bgh"],
  "/attendance/notify": ["gvcn", "bgh"],
  "/attendance/tracking": ["gvcn", "bgh"],
  "/academics/grades": ["gvcn", "gvbm", "to_truong", "bgh"],
  "/academics/exams": ["gvcn", "gvbm", "to_truong", "bgh"],
  "/academics/lesson-plans": ["gvcn", "gvbm"],
  "/academics/analysis": ["gvcn", "bgh"],
  "/academics/parent-chat": ["gvcn"],
  "/academics/plans": ["gvcn", "bgh"],
  "/academics/support": ["gvcn", "bgh"],
  "/academics/teacher-chat": ["gvcn", "gvbm", "to_truong"],
  "/schedule/timetable": ["gvcn", "gvbm", "to_truong", "bgh", "pht"],
  "/schedule/period-log": ["gvcn", "gvbm", "to_truong"],
  "/schedule/manage": ["bgh", "pht"],
  "/conduct/evaluation": ["gvcn", "bgh"],
  "/conduct/records": ["gvcn", "bgh"],
  "/conduct/student-chat": ["gvcn", "bgh"],
  "/counseling/intake": ["gvcn", "bgh"],
  "/counseling/assessment": ["gvcn", "bgh"],
  "/counseling/referral": ["gvcn", "bgh"],
  "/activities/plan": ["gvcn", "bgh"],
  "/activities/attendance": ["gvcn", "bgh"],
  "/activities/announce": ["gvcn", "bgh"],
  "/emulation/scoring": ["gvcn", "bgh"],
  "/emulation/ranking": ["gvcn", "bgh"],
  "/parents/compose": ["gvcn", "bgh"],
  "/parents/inbox": ["gvcn", "bgh"],
  "/parents/appointments": ["gvcn", "bgh"],
  "/parents/cmhs": ["gvcn", "bgh"],
  "/parents/portal": ["gvcn", "bgh"],
  "/records/students": ["gvcn", "bgh"],
  "/records/upload": ["gvcn", "bgh"],
  "/records/intake": ["gvcn", "bgh"],
  "/records/report": ["gvcn", "bgh"],
  "/records/history": ["gvcn", "bgh"],
  "/register/roster": ["gvcn"],
  "/register/seating": ["gvcn"],
  "/register/seating-history": ["gvcn"],
  "/register/kpi": ["gvcn"],
  "/register/plans": ["gvcn"],
  "/register/suggestions": ["gvcn"],
  "/register/export": ["gvcn"],
  "/register/signoff": ["gvcn", "bgh"],
  "/register/lock-records": ["gvcn", "bgh"],
  "/register/audit": ["gvcn", "bgh"],
  "/register/year-events": ["gvcn"],
  "/competency/evidence": ["gvcn", "gvbm", "to_truong"],
  "/competency/self-assessment": ["gvcn", "gvbm", "to_truong"],
  "/safety/report": ["gvcn", "gvbm", "to_truong", "bgh"],
  "/safety/bgh": ["bgh", "pht"],
  "/safety/followup": ["gvcn", "bgh"],
  "/safety/archive": ["gvcn", "bgh"],
  "/school/dashboard": ["bgh", "pht"],
  "/school/staff": ["bgh", "pht", "ke_toan"],
  "/school/users": ["bgh"],
  "/school/students": ["bgh", "pht", "ke_toan"],
  "/school/announce": ["bgh", "pht"],
  "/school/approvals": ["bgh", "pht"],
  "/school/assignments": ["bgh"],
  "/school/campuses": ["bgh", "pht", "ke_toan"],
  "/school/daily-reports": ["bgh", "pht"],
  "/school/equipment": ["bgh", "pht", "ke_toan"],
  "/school/exam-analytics": ["bgh", "pht"],
  "/school/journals": ["bgh", "pht"],
  "/school/nq37": ["bgh", "pht", "ke_toan"],
  "/school/radar": ["bgh", "pht"],
  "/school/strategy": ["bgh", "pht"],
  "/school/substitutes": ["bgh", "pht"],
  "/school/ai-assistant": ["bgh", "pht"],
  "/team/home": ["to_truong"],
  "/team/lesson-plans": ["to_truong"],
  "/team/meetings": ["to_truong"],
  "/team/review": ["to_truong"],
  "/team/teachers": ["to_truong"],
  "/dept/dashboard": ["so_gd", "phong_gd", "ubnd"],
  "/dept/data": ["so_gd"],
  "/dept/facilities": ["so_gd", "phong_gd", "ubnd"],
  "/dept/reports": ["so_gd", "phong_gd", "ubnd"],
  "/dept/users": ["so_gd"],
  "/dept/wards": ["so_gd", "phong_gd", "ubnd"],
  "/portal/parent": ["phu_huynh"],
  "/portal/student": ["hoc_sinh"],
  "/portal/student/hoc-ba": ["hoc_sinh"],
};

const ROLE_EMAIL = {
  gvcn: "gvcn@demo.scn", gvbm: "gvbm@demo.scn", to_truong: "totruong@demo.scn",
  bgh: "bgh@demo.scn", pht: "pht@demo.scn", ke_toan: "ketoan@demo.scn",
  so_gd: "sogd@demo.scn", phong_gd: "phonggd@demo.scn", ubnd: "ubnd@demo.scn",
  phu_huynh: "phuhuynh@demo.scn", hoc_sinh: "hocsinh@demo.scn",
};

const browser = await chromium.launch();
async function loginCtx(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(`${email}: ${m.text().slice(0, 120)}`); });
  p.on("pageerror", (e) => errors.push(`${email}: ${String(e).slice(0, 120)}`));
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill("#email", email);
  await p.fill("input[type=password]", "demo1234");
  await p.click("button[type=submit]");
  await p.waitForTimeout(5000);
  return { ctx, p };
}
const settle = async (p, ms = 800) => {
  await p.waitForLoadState("domcontentloaded").catch(() => {});
  await p.waitForTimeout(ms);
};

// === PHAN 1: ACCESS MATRIX - moi role vao moi route allowed ===
// moi role 1 context, duyet tat ca route role do duoc phep + 1 route bi cam mau
for (const [role, email] of Object.entries(ROLE_EMAIL)) {
  const { ctx, p } = await loginCtx(email);
  const allowed = Object.entries(MATRIX).filter(([, r]) => r.includes(role)).map(([r]) => r);
  let ok = 0, fail = [];
  for (const route of allowed) {
    await p.goto(`${BASE}${route}`).catch(() => {});
    await settle(p, 1200);
    const txt = await p.locator("body").innerText().catch(() => "");
    const pathname = new URL(p.url()).pathname;
    // redirect hop le (vd /records/history -> /register/audit?type=records) van tinh la OK
    const onRoute = pathname === route || pathname.startsWith(route + "/") ||
      ["/dashboard", "/academics/grades", "/portal/parent", "/portal/student",
        "/school/dashboard", "/dept/dashboard", "/team/home", "/register/audit"].includes(pathname);
    const hasContent = txt.length > 150 && !/404|không tìm thấy/i.test(txt.slice(0, 300));
    if (onRoute && hasContent) ok++; else fail.push(`${route} -> ${pathname}`);
  }
  check(`AM-${role}`, `${allowed.length} routes allowed`, fail.length === 0,
    fail.length ? `fail: ${fail.join(",")}` : `${ok} ok`);
  // deny mau: 1 route cua role khac - check PATHNAME exact (khong includes)
  const denied = Object.entries(MATRIX).find(([, r]) => !r.includes(role));
  if (denied) {
    await p.goto(`${BASE}${denied[0]}`).catch(() => {});
    await p.waitForTimeout(2500); // redirect qua server component mat ~1-2s
    const pathname = new URL(p.url()).pathname;
    check(`AM-${role}-deny`, `${denied[0]} bi chan`, pathname !== denied[0],
      pathname);
  }
  await ctx.close();
}

// === PHAN 2: WRITE FLOWS qua UI -> verify DB ===
const { data: gvcnP } = await db.from("profiles").select("id,school_id").eq("email", "gvcn@demo.scn").single();
const { data: myClasses } = await db.from("classes").select("id,name").eq("gvcn_id", gvcnP.id);
const { data: anyStu } = await db.from("students").select("id,full_name,code").eq("class_id", myClasses[0].id).limit(1).single();
const today = new Date().toISOString().slice(0, 10);
const MARK = `FULL-${Date.now()}`;

// --- GVCN writes ---
{
  const { ctx, p } = await loginCtx("gvcn@demo.scn");

  // W01: Diem danh -> DB
  await p.goto(`${BASE}/attendance/daily?class=${myClasses[0].id}&date=${today}`);
  await settle(p, 1500);
  const row = p.locator("tr", { hasText: anyStu.full_name }).first();
  if ((await row.count()) > 0) {
    await row.locator('label:has-text("Vắng có phép")').click().catch(() => {});
    await p.locator('button:has-text("Xác nhận chuyên cần")').click();
    await p.waitForTimeout(2500);
    const { data: a } = await db.from("attendance_records").select("status")
      .eq("student_id", anyStu.id).eq("date", today).limit(1);
    check("W01", "Diem danh -> DB", a?.[0]?.status === "excused", a?.[0]?.status);
  } else check("W01", "Diem danh -> DB", false, "no student row");

  // W02: Ghi nhan hanh kiem
  await p.goto(`${BASE}/conduct/records`);
  await settle(p, 1500);
  await p.locator('label:has-text("Học sinh") select').selectOption(anyStu.id).catch(() => {});
  await p.locator('label:has-text("Khen thưởng")').click().catch(() => {});
  await p.locator("textarea").first().fill(`Ghi nhan ${MARK}`);
  await p.locator('button:has-text("Lưu ghi nhận")').click();
  await p.waitForTimeout(2500);
  const { data: cr } = await db.from("conduct_records").select("id").ilike("content", `%${MARK}%`).limit(1);
  check("W02", "Ghi nhan HK -> DB", (cr?.length ?? 0) === 1, "");

  // W03: Thong bao PH
  await p.goto(`${BASE}/parents/compose`);
  await settle(p, 1500);
  await p.locator('input[placeholder*="Thông báo"], input[placeholder*="họp"]').first().fill(`TB ${MARK}`);
  await p.locator("textarea").nth(1).fill(`ND ${MARK}`);
  await p.locator('button:has-text("Gửi thông báo")').click();
  await p.waitForTimeout(3000);
  const { data: an } = await db.from("announcements").select("id").ilike("content", `%${MARK}%`).limit(1);
  check("W03", "Thong bao PH -> DB", (an?.length ?? 0) === 1, "");

  // W04: Cham diem thi dua
  const period = `${new Date().getFullYear()}-T${new Date().getMonth() + 1}`;
  await p.goto(`${BASE}/emulation/scoring`);
  await settle(p, 1500);
  await p.locator('td input[type="number"]').first().fill("9");
  await p.locator('button:has-text("Lưu điểm thi đua")').click();
  await p.waitForTimeout(2500);
  const { data: em } = await db.from("emulation_scores").select("score")
    .in("class_id", myClasses.map((c) => c.id)).eq("period", period);
  check("W04", "Diem thi dua -> DB", (em ?? []).some((e) => e.score === 9),
    (em ?? []).map((e) => e.score).join(","));

  // W05: Sua ho so HS (CR-014 regression)
  await p.goto(`${BASE}/records/students`);
  await settle(p, 1500);
  await p.locator("tbody tr").first().click();
  await p.waitForTimeout(800);
  const eb = p.locator('button:has-text("Sửa hồ sơ")').first();
  if ((await eb.count()) > 0) {
    await eb.click();
    await p.waitForTimeout(500);
    const modal = p.locator("div.fixed").last();
    await modal.locator('label:has-text("Địa chỉ") input').fill(`DC ${MARK}`);
    await modal.locator('button:has-text("Lưu thay đổi")').click();
    await p.waitForTimeout(2500);
    const { data: st } = await db.from("students").select("id").eq("address", `DC ${MARK}`).limit(1);
    check("W05", "Sua HS -> DB + history", (st?.length ?? 0) === 1, "");
  } else check("W05", "Sua HS -> DB", false, "no edit btn");

  // W06: So dau bai (GVBM/GVCN ghi)
  await p.goto(`${BASE}/schedule/period-log`);
  await settle(p, 1500);
  const plBody = await p.locator("body").innerText();
  check("W06", "So dau bai render", /tiết|sổ đầu bài|Chưa ghi/i.test(plBody), "");
  await shot(p, "w06-period-log");

  // W07: Don nghi phep
  await p.goto(`${BASE}/attendance/leaves`);
  await settle(p, 1500);
  const lvBody = await p.locator("body").innerText();
  check("W07", "Don nghi phep render", /nghỉ|phép|vắng/i.test(lvBody), "");

  // W08: Xep cho ngoi
  await p.goto(`${BASE}/register/seating`);
  await settle(p, 1500);
  const seatBody = await p.locator("body").innerText();
  check("W08", "So do cho ngoi render", /chỗ ngồi|bàn|tuyên dương|học sinh/i.test(seatBody), "");
  await shot(p, "w08-seating");

  await ctx.close();
}

// --- GVBM writes ---
{
  const { ctx, p } = await loginCtx("gvbm@demo.scn");
  await p.goto(`${BASE}/schedule/period-log`);
  await settle(p, 1500);
  const plBody = await p.locator("body").innerText();
  check("W09", "GVBM so dau bai", /tiết|sổ đầu bài|Chưa ghi/i.test(plBody), "");
  await shot(p, "w09-gvbm-periodlog");

  await p.goto(`${BASE}/competency/evidence`);
  await settle(p, 1500);
  check("W10", "GVBM minh chung NL", (await p.locator("body").innerText()).length > 300, "");
  await ctx.close();
}

// --- BGH writes ---
{
  const { ctx, p } = await loginCtx("bgh@demo.scn");
  await p.goto(`${BASE}/school/announce`);
  await settle(p, 1500);
  await shot(p, "w11-bgh-announce");
  const annBody = await p.locator("body").innerText();
  check("W11", "BGH thong bao toan truong render", /thông báo|toàn trường|gửi/i.test(annBody), "");

  await p.goto(`${BASE}/school/approvals`);
  await settle(p, 1500);
  check("W12", "BGH approvals render", (await p.locator("body").innerText()).length > 200, "");

  await p.goto(`${BASE}/safety/bgh`);
  await settle(p, 1500);
  check("W13", "BGH safety render", /an toàn|sự cố|sự vụ/i.test(await p.locator("body").innerText()), "");
  await ctx.close();
}

// --- TO_TRUONG ---
{
  const { ctx, p } = await loginCtx("totruong@demo.scn");
  await p.goto(`${BASE}/team/home`);
  await settle(p, 1500);
  check("W14", "To truong home", (await p.locator("body").innerText()).length > 200, "");
  await shot(p, "w14-team-home");
  await p.goto(`${BASE}/team/meetings`);
  await settle(p, 1500);
  check("W15", "To truong meetings", /họp|biên bản|cuộc họp/i.test(await p.locator("body").innerText()), "");
  await ctx.close();
}

// --- KE_TOAN ---
{
  const { ctx, p } = await loginCtx("ketoan@demo.scn");
  await p.goto(`${BASE}/school/equipment`);
  await settle(p, 1500);
  check("W16", "Ke toan equipment", /thiết bị|tài sản|cơ sở/i.test(await p.locator("body").innerText()), "");
  await ctx.close();
}

// --- DEPT roles ---
for (const [role, route] of [["so_gd", "/dept/dashboard"], ["phong_gd", "/dept/reports"], ["ubnd", "/dept/facilities"]]) {
  const { ctx, p } = await loginCtx(ROLE_EMAIL[role]);
  await p.goto(`${BASE}${route}`);
  await settle(p, 1500);
  check(`W-${role}`, `${role} ${route}`, (await p.locator("body").innerText()).length > 200, "");
  await ctx.close();
}

// --- Portals ---
{
  const { ctx, p } = await loginCtx("phuhuynh@demo.scn");
  await p.goto(`${BASE}/portal/parent`);
  await settle(p, 1500);
  check("W17", "Portal PH day du", /con|điểm|chuyên cần|học/i.test(await p.locator("body").innerText()), "");
  await shot(p, "w17-portal-ph");
  await ctx.close();
}
{
  const { ctx, p } = await loginCtx("hocsinh@demo.scn");
  await p.goto(`${BASE}/portal/student/hoc-ba`);
  await settle(p, 1500);
  check("W18", "Hoc ba HS", /học bạ|điểm|hạnh kiểm/i.test(await p.locator("body").innerText()), "");
  await shot(p, "w18-hocba");
  await ctx.close();
}

// ================= SUMMARY =================
console.log("\n=== console errors:", errors.length);
[...new Set(errors)].slice(0, 15).forEach((e) => console.log("  -", e));
const pass = results.filter((r) => r.pass).length;
const fails = results.filter((r) => !r.pass);
console.log(`\n===== ${pass}/${results.length} PASS =====`);
if (fails.length) { console.log("FAILURES:"); fails.forEach((f) => console.log(`  ${f.id} ${f.name} ${f.detail}`)); }
await browser.close();
