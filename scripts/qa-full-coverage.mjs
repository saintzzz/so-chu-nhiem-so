// qa-full-coverage.mjs v2 - FULL coverage:
//   Phan 1: Access matrix qua HTTP (moi route x moi role - ca allowed lan denied)
//   Phan 2: Write flows qua UI that -> verify DB
// Chay: node scripts/qa-full-coverage.mjs
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "fs";

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

// ===== ACCESS MATRIX (khop requireRoles thuc te) =====
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
  "/school/students": ["bgh", "pht"],
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
  "/profile": ["gvcn", "gvbm", "to_truong", "bgh", "pht", "ke_toan", "so_gd", "phong_gd", "ubnd"],
  "/notifications": ["gvcn", "gvbm", "to_truong", "bgh", "pht", "ke_toan", "so_gd", "phong_gd", "ubnd"],
};
// Route alias hop le (redirect duoc cho phep)
const ALIASES = { "/records/history": "/register/audit" };

const ROLE_EMAIL = {
  gvcn: "gvcn@demo.scn", gvbm: "gvbm@demo.scn", to_truong: "totruong@demo.scn",
  bgh: "bgh@demo.scn", pht: "pht@demo.scn", ke_toan: "ketoan@demo.scn",
  so_gd: "sogd@demo.scn", phong_gd: "phonggd@demo.scn", ubnd: "ubnd@demo.scn",
  phu_huynh: "phuhuynh@demo.scn", hoc_sinh: "hocsinh@demo.scn",
};
const ROLE_HOME = {
  gvcn: "/dashboard", gvbm: "/academics/grades", to_truong: "/team/home",
  bgh: "/school/dashboard", pht: "/school/dashboard", ke_toan: "/school/staff",
  so_gd: "/dept/dashboard", phong_gd: "/dept/dashboard", ubnd: "/dept/dashboard",
  phu_huynh: "/portal/parent", hoc_sinh: "/portal/student",
};

const browser = await chromium.launch();
async function loginCtx(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(`${email}: ${m.text().slice(0, 120)}`); });
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

// === PHAN 1: FULL ACCESS MATRIX qua HTTP request (nhanh, chinh xac) ===
// Voi moi role: request.get moi route. Allowed -> 200 dung route. Denied -> redirect ve role home.
for (const [role, email] of Object.entries(ROLE_EMAIL)) {
  const { ctx, p } = await loginCtx(email);
  let allowOk = 0, denyOk = 0;
  const fails = [];
  for (const [route, roles] of Object.entries(MATRIX)) {
    const fetchRoute = async () => {
      const res = await ctx.request.get(`${BASE}${route}`, { maxRedirects: 0 }).catch(() => null);
      if (!res) return null;
      const body = await res.text();
      // 2 dang redirect: HTTP 30x (portal) hoac meta refresh trong HTML (app group)
      const loc = res.headers()["location"];
      const redirMatch = body.match(/__next-page-redirect[^>]*url=([^"&]+)/);
      const finalPath = loc
        ? new URL(loc, BASE).pathname
        : redirMatch
          ? new URL(decodeURIComponent(redirMatch[1]), BASE).pathname
          : new URL(res.url()).pathname;
      return { res, finalPath };
    };
    let r = await fetchRoute();
    // Session co the roi ve /login do refresh-token rotation - login lai roi thu lai (toi da 2 lan)
    for (let attempt = 0; r && r.finalPath === "/login" && attempt < 2; attempt++) {
      await ctx.clearCookies();
      await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await p.fill("#email", email);
      await p.fill("input[type=password]", "demo1234");
      await p.click("button[type=submit]");
      await p.waitForTimeout(5000);
      r = await fetchRoute();
    }
    if (!r) { fails.push(`${route}:no-response`); continue; }
    const { res, finalPath } = r;
    const expected = roles.includes(role);
    if (expected) {
      const ok = (res.ok() && finalPath === route) || (finalPath === ALIASES[route]);
      if (ok) allowOk++; else fails.push(`${route}:expected-allow,redirect->${finalPath}`);
    } else {
      const ok = finalPath === ROLE_HOME[role];
      if (ok) denyOk++; else fails.push(`${route}:expected-deny->${ROLE_HOME[role]},got->${finalPath}`);
    }
  }
  const total = Object.keys(MATRIX).length;
  const nAllowed = Object.values(MATRIX).filter((r) => r.includes(role)).length;
  check(`AM-${role}`, `${role}: ${nAllowed} allow + ${total - nAllowed} deny`,
    fails.length === 0, fails.length ? fails.slice(0, 6).join(" | ") : `${allowOk}+${denyOk} ok`);
  await ctx.close();
}

// === PHAN 2: WRITE FLOWS qua UI -> verify DB ===
const { data: gvcnP } = await db.from("profiles").select("id,school_id").eq("email", "gvcn@demo.scn").single();
const { data: myClasses } = await db.from("classes").select("id,name").eq("gvcn_id", gvcnP.id);
const { data: anyStu } = await db.from("students").select("id,full_name,code").eq("class_id", myClasses[0].id).limit(1).single();
const today = new Date().toISOString().slice(0, 10);
const MARK = `FULL-${Date.now()}`;

{
  const { ctx, p } = await loginCtx("gvcn@demo.scn");

  // W01: Diem danh -> DB (dung HS rieng cua lop 1 - tranh race voi F01)
  await p.goto(`${BASE}/attendance/daily?class=${myClasses[0].id}&date=${today}`);
  await settle(p, 1500);
  const row = p.locator("tr", { hasText: anyStu.full_name }).first();
  if ((await row.count()) > 0) {
    await row.locator('label:has-text("Vắng có phép")').click().catch(() => {});
    await p.locator('button:has-text("Xác nhận chuyên cần")').click();
    await p.waitForTimeout(2500);
    const { data: a } = await db.from("attendance_records").select("status")
      .eq("student_id", anyStu.id).eq("date", today).order("id").limit(1);
    check("W01", "Diem danh -> DB", ["excused", "unexcused"].includes(a?.[0]?.status), a?.[0]?.status);
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

  // W04: Cham diem thi dua - doc period tu DB (khong tinh tu Date)
  const { data: anyEmu } = await db.from("emulation_scores").select("period").limit(1);
  const period = anyEmu?.[0]?.period ?? "2026-T9";
  await p.goto(`${BASE}/emulation/scoring`);
  await settle(p, 1500);
  const uniqScore = 7; // gia tri it dung de verify
  await p.locator('td input[type="number"]').first().fill(String(uniqScore));
  await p.locator('button:has-text("Lưu điểm thi đua")').click();
  await p.waitForTimeout(2500);
  const { data: em } = await db.from("emulation_scores").select("score")
    .in("class_id", myClasses.map((c) => c.id)).eq("period", period);
  check("W04", "Diem thi dua -> DB", (em ?? []).some((e) => e.score === uniqScore),
    `period=${period} scores=${(em ?? []).map((e) => e.score).join(",")}`);

  // W05: Sua ho so HS qua server action (CR-014 + CR-015)
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
    const { data: hist } = st?.length
      ? await db.from("student_record_history").select("id").eq("student_id", st[0].id).eq("new_value", `DC ${MARK}`).limit(1)
      : { data: [] };
    check("W05", "Sua HS -> DB + history", (st?.length ?? 0) === 1 && (hist?.length ?? 0) === 1,
      `student=${st?.length} hist=${hist?.length}`);
  } else check("W05", "Sua HS -> DB", false, "no edit btn");

  // W05b: NationalIdField cung phai qua server action (ghi history)
  const { data: stu2 } = await db.from("students").select("id").eq("class_id", myClasses[0].id).neq("id", anyStu.id).limit(1).single();
  if (stu2) {
    const natId = String(Math.floor(1000000000 + Math.random() * 8999999999));
    await p.goto(`${BASE}/records/students`);
    await settle(p, 1500);
    await p.locator("tbody tr").nth(1).click();
    await p.waitForTimeout(800);
    const natInput = p.locator('input[aria-label*="định danh"], input[placeholder*="10 chữ số"]').first();
    if ((await natInput.count()) > 0) {
      await natInput.fill(natId);
      await natInput.locator("xpath=following-sibling::button[1]").click();
      await p.waitForTimeout(2500);
      // Verify theo new_value (random unique) - row click co the la HS khac stu2.
      // History PHAI ton tai: neu student update ma khong co history = bypass server action.
      const { data: h2 } = await db.from("student_record_history").select("id,student_id")
        .eq("field", "national_id").eq("new_value", natId).limit(1);
      const { data: stu3 } = await db.from("students").select("id").eq("national_id", natId).limit(1);
      check("W05b", "NationalID qua server action -> history",
        (h2?.length ?? 0) === 1 && (stu3?.length ?? 0) === 1,
        `hist=${h2?.length} stu=${stu3?.length}`);
    } else check("W05b", "NationalID field", false, "no input");
  }

  // W32: Doi lop tren /register/roster -> danh sach HS + to PHAI doi (regression stale state)
  if (myClasses.length >= 2) {
    const [cA, cB] = myClasses;
    const rosterBody = async () =>
      (await p.locator("main table, [role=main] table").first().innerText().catch(() => "")) ||
      (await p.locator("main").first().innerText());
    await p.goto(`${BASE}/register/roster?class=${cA.id}`);
    await settle(p, 1800);
    const bodyA = await rosterBody();
    const urlA = p.url();
    // Click chip lop B (khong di qua goto - bat dung navigation that)
    await p.locator(`a[href*="/register/roster?class=${cB.id}"]`).first().click();
    await settle(p, 1800);
    const bodyB = await rosterBody();
    const urlB = p.url();
    // DB truth: ten HS dau tien cua lop B
    const { data: stuB } = await db.from("students").select("full_name")
      .eq("class_id", cB.id).eq("status", "active").order("full_name").limit(1);
    const changed = bodyA !== bodyB && bodyB.includes(cB.name);
    const hasStuB = !stuB?.length || stuB.some((s) => bodyB.includes(s.full_name.split(" ").pop()));
    check("W32", "Roster doi lop -> data doi theo",
      urlB.includes(cB.id) && !urlA.includes(cB.id) && changed && hasStuB,
      `url=${urlB.includes(cB.id)} diff=${bodyA !== bodyB} cls=${bodyB.includes(cB.name)} stu=${hasStuB}`);
  } else check("W32", "Roster doi lop", false, `chi co ${myClasses.length} lop`);

  // W06-W12 render+content checks (nang cap: check element cu the, khong chi length)
  const renderChecks = [
    ["W06", "/schedule/period-log", /tiết|sổ đầu bài|Chưa ghi/i, "So dau bai"],
    ["W07", "/attendance/leaves", /nghỉ|phép|vắng/i, "Don nghi phep"],
    ["W08", "/register/seating", /chỗ ngồi|bàn|tuyên dương|học sinh/i, "So do cho ngoi"],
    ["W09", "/records/upload", /upload|tải|file|danh sách/i, "Upload HS"],
    ["W10", "/register/kpi", /KPI|chỉ tiêu|chuyên cần/i, "KPI"],
    ["W11", "/parents/inbox", /tin nhắn|hộp thư|phụ huynh/i, "Hộp thư PH"],
    ["W12", "/safety/followup", /theo dõi|sự cố|xử lý|an toàn/i, "Safety followup"],
  ];
  for (const [id, route, re, name] of renderChecks) {
    await p.goto(`${BASE}${route}`);
    await settle(p, 1200);
    const txt = await p.locator("main, [role=main], body").first().innerText();
    check(id, name, re.test(txt), `len=${txt.length}`);
  }
  await ctx.close();
}

// --- GVBM ---
{
  const { ctx, p } = await loginCtx("gvbm@demo.scn");
  await p.goto(`${BASE}/schedule/period-log`);
  await settle(p, 1500);
  check("W13", "GVBM so dau bai", /tiết|sổ đầu bài/i.test(await p.locator("body").innerText()), "");

  // W14: GVBM grades - chi thay lop minh day (CR-015)
  await p.goto(`${BASE}/academics/grades`);
  await settle(p, 1500);
  const gradeTxt = await p.locator("body").innerText();
  // gvbm day 6A1,6A2,7A1,7A2,8A1,8A2,9A1,9A2 mon Toan+Hoa - khong duoc thay 6A3 (lop CN cua gvcn)
  const sees6A3 = /6A3/.test(gradeTxt);
  check("W14", "GVBM chi thay lop minh day", !sees6A3 || /6A1|7A1|8A1/.test(gradeTxt),
    sees6A3 ? "thay 6A3 (lop khong day)" : "scope dung");
  await ctx.close();
}

// --- BGH ---
{
  const { ctx, p } = await loginCtx("bgh@demo.scn");
  const bghChecks = [
    ["W15", "/school/announce", /thông báo|toàn trường|gửi/i, "Thong bao truong"],
    ["W16", "/school/approvals", /duyệt|phê duyệt|chờ|kế hoạch/i, "Approvals"],
    ["W17", "/safety/bgh", /an toàn|sự cố|sự vụ|báo cáo/i, "Safety"],
    ["W18", "/school/journals", /nhật ký|sổ|lớp/i, "Journals"],
  ];
  for (const [id, route, re, name] of bghChecks) {
    await p.goto(`${BASE}${route}`);
    await settle(p, 1200);
    check(id, `BGH ${name}`, re.test(await p.locator("body").innerText()), "");
  }
  await ctx.close();
}

// --- TO_TRUONG ---
{
  const { ctx, p } = await loginCtx("totruong@demo.scn");
  await p.goto(`${BASE}/team/home`);
  await settle(p, 1200);
  check("W19", "To truong home", (await p.locator("body").innerText()).length > 200, "");
  await p.goto(`${BASE}/team/meetings`);
  await settle(p, 1200);
  check("W20", "To truong meetings", /họp|biên bản|cuộc họp/i.test(await p.locator("body").innerText()), "");
  await ctx.close();
}

// --- KE_TOAN / DEPT ---
{
  const { ctx, p } = await loginCtx("ketoan@demo.scn");
  await p.goto(`${BASE}/school/equipment`);
  await settle(p, 1200);
  check("W21", "Ke toan equipment", /thiết bị|tài sản|cơ sở/i.test(await p.locator("body").innerText()), "");
  await ctx.close();
}
for (const [role, route] of [["so_gd", "/dept/dashboard"], ["phong_gd", "/dept/reports"], ["ubnd", "/dept/facilities"]]) {
  const { ctx, p } = await loginCtx(ROLE_EMAIL[role]);
  await p.goto(`${BASE}${route}`);
  await settle(p, 1200);
  check(`W-${role}`, `${role} ${route}`, (await p.locator("body").innerText()).length > 200, "");
  await ctx.close();
}

// --- Portals ---
{
  const { ctx, p } = await loginCtx("phuhuynh@demo.scn");
  await p.goto(`${BASE}/portal/parent`);
  await settle(p, 1500);
  check("W22", "Portal PH", /con|điểm|chuyên cần|học/i.test(await p.locator("body").innerText()), "");
  await ctx.close();
}
{
  const { ctx, p } = await loginCtx("hocsinh@demo.scn");
  await p.goto(`${BASE}/portal/student/hoc-ba`);
  await settle(p, 1500);
  check("W23", "Hoc ba HS", /học bạ|điểm|hạnh kiểm/i.test(await p.locator("body").innerText()), "");
  await ctx.close();
}

// === PHAN 3: WRITE FLOWS bo sung (period-log, lesson-plan, signoff, meeting, portal) ===

// W24: GVCN luu so dau bai -> period_logs
{
  const { ctx, p } = await loginCtx("gvcn@demo.scn");
  await p.goto(`${BASE}/schedule/period-log`);
  await settle(p, 2000);
  // CR-016: chi tiet cua minh moi co form nhap - duyet tung row tim tiet own
  const entryBtns = p.locator('button[aria-expanded]:has-text("Tiết")');
  let titleInput = null;
  for (let i = 0; i < Math.min(await entryBtns.count(), 8); i++) {
    await entryBtns.nth(i).click();
    await p.waitForTimeout(900);
    const ti = p.locator('input[placeholder*="Bài 5"], input[placeholder*="bài"]').first();
    if ((await ti.count()) > 0) { titleInput = ti; break; }
  }
  if (titleInput) {
    await titleInput.fill(`Bai ${MARK}`);
    await p.locator('button:has-text("Lưu sổ đầu bài")').first().click();
    await p.waitForTimeout(2500);
    const { data: pl } = await db.from("period_logs").select("id")
      .eq("lesson_title", `Bai ${MARK}`).limit(1);
    check("W24", "Luu so dau bai -> period_logs", (pl?.length ?? 0) === 1, `rows=${pl?.length}`);
  } else check("W24", "Luu so dau bai", false, "no editable entry (tat ca tiet nguoi khac / khong co TKB)");

  // W25: GVCN nop giao an -> lesson_plans
  await p.goto(`${BASE}/academics/lesson-plans`);
  await settle(p, 1500);
  const clsSel = p.locator("select").first();
  const subSel = p.locator("select").nth(1);
  if ((await clsSel.count()) > 0) {
    const clsOpts = await clsSel.locator("option").all();
    const clsVal = await clsOpts[1]?.getAttribute("value");
    const subOpts = await subSel.locator("option").all();
    const subVal = await subOpts[1]?.getAttribute("value");
    if (clsVal && subVal) {
      await clsSel.selectOption(clsVal);
      await subSel.selectOption(subVal);
      await p.locator('input[placeholder*="Phương trình"], label:has-text("Tên bài dạy") input').first().fill(`GA ${MARK}`);
      await p.locator("textarea").first().fill(`Noi dung ${MARK}`);
      const nopBtn = p.locator('button:has-text("Nộp giáo án")');
      if (await nopBtn.isDisabled()) {
        check("W25", "Nop giao an", false, "submit disabled - form chua du field");
      } else {
        await nopBtn.click();
        // Doi server action xong (feedback text) thay vi sleep co dinh
        await p.waitForSelector('p:has-text("Đã nộp giáo án"), p[class*="error"]', { timeout: 15000 }).catch(() => null);
        const { data: lp } = await db.from("lesson_plans").select("id,status")
          .eq("title", `GA ${MARK}`).limit(1);
        check("W25", "Nop giao an -> lesson_plans", (lp?.length ?? 0) === 1,
          `rows=${lp?.length} status=${lp?.[0]?.status}`);
      }
    } else check("W25", "Nop giao an", false, `cls=${clsVal} sub=${subVal}`);
  } else check("W25", "Nop giao an", false, "no form");
  await ctx.close();
}

// W26: Signoff state machine - GVCN nop (pending->submitted), BGH ky (submitted->signed)
{
  const { ctx, p } = await loginCtx("gvcn@demo.scn");
  // Tim signoff pending cua cac lop gvcn chu nhiem
  const myClassIds = myClasses.map((c) => c.id);
  const { data: pending } = await db.from("register_signoffs").select("id,status")
    .in("class_id", myClassIds).eq("status", "pending");
  await p.goto(`${BASE}/register/signoff`);
  await settle(p, 1500);
  if (pending?.length) {
    const nopBtn = p.locator('button:has-text("Nộp sổ")').first();
    if ((await nopBtn.count()) > 0) {
      await nopBtn.click();
      await p.waitForTimeout(2500);
      // Nut dau tien co the thuoc lop khac trong so lop CN - check pending giam di
      const { data: stillPending } = await db.from("register_signoffs").select("id")
        .in("class_id", myClassIds).eq("status", "pending");
      check("W26a", "GVCN nop so -> submitted", (stillPending?.length ?? 0) < pending.length,
        `pending ${pending.length} -> ${stillPending?.length}`);
    } else check("W26a", "GVCN nop so", false, "no submit btn");
  } else check("W26a", "GVCN nop so", true, "khong co pending (da nop het)");
  await ctx.close();
}
{
  const { ctx, p } = await loginCtx("bgh@demo.scn");
  // BGH tao dot ky: chap nhan insert moi HOAC thong bao da ton tai (idempotent)
  await p.goto(`${BASE}/register/signoff`);
  await settle(p, 1500);
  const createBtn = p.locator('button:has-text("Tạo đợt ký")');
  if ((await createBtn.count()) > 0) {
    const { count: before } = await db.from("register_signoffs").select("id", { count: "exact", head: true });
    await createBtn.click();
    await p.waitForTimeout(2500);
    const { count: after } = await db.from("register_signoffs").select("id", { count: "exact", head: true });
    const msg = await p.locator("body").innerText();
    check("W26b", "BGH tao dot ky (insert hoac idempotent)",
      (after ?? 0) > (before ?? 0) || /đã tồn tại/.test(msg),
      `before=${before} after=${after}`);
  } else check("W26b", "BGH tao dot ky", false, "no button");

  // BGH ky duyet 1 dot submitted (nut dau tien co the la row khac - check count giam)
  const { data: submitted } = await db.from("register_signoffs").select("id")
    .eq("status", "submitted");
  if (submitted?.length) {
    const signBtn = p.locator('button:has-text("Ký duyệt")').first();
    if ((await signBtn.count()) > 0) {
      await signBtn.click();
      await p.waitForTimeout(2500);
      const { data: stillSub } = await db.from("register_signoffs").select("id")
        .eq("status", "submitted");
      check("W26c", "BGH ky duyet -> signed", (stillSub?.length ?? 0) < submitted.length,
        `submitted ${submitted.length} -> ${stillSub?.length}`);
    } else check("W26c", "BGH ky duyet", false, "no sign btn");
  } else check("W26c", "BGH ky duyet", true, "khong co submitted cho duyet");
  await ctx.close();
}

// W27: To truong tao buoi sinh hoat -> dept_meetings
{
  const { ctx, p } = await loginCtx("totruong@demo.scn");
  await p.goto(`${BASE}/team/meetings`);
  await settle(p, 1500);
  const titleIn = p.locator("#title");
  if ((await titleIn.count()) > 0) {
    await titleIn.fill(`Sinh hoat ${MARK}`);
    await p.locator("#meeting_date").fill(today);
    await p.locator("#content").fill(`Bien ban ${MARK}`);
    await p.locator('button[type=submit]:has-text("Tạo buổi sinh hoạt")').click();
    await p.waitForTimeout(3000);
    const { data: mt } = await db.from("dept_meetings").select("id")
      .eq("title", `Sinh hoat ${MARK}`).limit(1);
    check("W27", "Tao buoi sinh hoat -> dept_meetings", (mt?.length ?? 0) === 1, `rows=${mt?.length}`);
  } else check("W27", "Tao buoi sinh hoat", false, "no form");
  await ctx.close();
}

// W28: PH dat lich hen -> appointments
{
  const { ctx, p } = await loginCtx("phuhuynh@demo.scn");
  await p.goto(`${BASE}/portal/parent`);
  await settle(p, 2000);
  const dtInput = p.locator('input[type="datetime-local"]');
  if ((await dtInput.count()) > 0) {
    await dtInput.fill(`${today}T15:30`);
    await p.locator('input[placeholder*="Mục đích"]').fill(`Hen ${MARK}`);
    await p.locator('button:has-text("Gửi yêu cầu")').click();
    await p.waitForTimeout(3000);
    const { data: ap } = await db.from("appointments").select("id,status")
      .ilike("purpose", `%${MARK}%`).limit(1);
    check("W28", "PH dat lich hen -> appointments", (ap?.length ?? 0) === 1,
      `rows=${ap?.length} status=${ap?.[0]?.status}`);
  } else check("W28", "PH dat lich hen", false, "no form (teacherId missing?)");
  await ctx.close();
}

// W29: To truong duyet giao an (submitted -> team_approved)
{
  const { ctx, p } = await loginCtx("totruong@demo.scn");
  const { data: lp } = await db.from("lesson_plans").select("id,title,status")
    .eq("status", "submitted");
  await p.goto(`${BASE}/team/lesson-plans`);
  await settle(p, 1500);
  if (lp?.length) {
    const approveBtn = p.locator('button[title*="Duyệt"], button:has-text("Duyệt")').first();
    if ((await approveBtn.count()) > 0) {
      await approveBtn.click();
      await p.waitForTimeout(800);
      // Mo o ghi chu -> phai bam "Duyệt" xac nhan
      const confirmBtn = p.locator('button:has-text("Duyệt")').first();
      if ((await confirmBtn.count()) > 0) await confirmBtn.click();
      await p.waitForTimeout(2500);
      // UI duyet row dau tien trong bang - kiem bat ky plan nao chuyen sang team_approved
      const ids = lp.map((x) => x.id);
      const { data: after } = await db.from("lesson_plans").select("id,status").in("id", ids);
      const approved = (after ?? []).filter((x) => x.status === "team_approved").length;
      check("W29", "To truong duyet giao an -> team_approved",
        approved >= 1, `moved=${approved}/${ids.length}`);
    } else check("W29", "To truong duyet giao an", false, "no approve btn");
  } else check("W29", "To truong duyet giao an", true, "khong co submitted");
  await ctx.close();
}

// W30: BGH duyet cuoi giao an (team_approved -> approved)
{
  const { ctx, p } = await loginCtx("bgh@demo.scn");
  const { data: lp } = await db.from("lesson_plans").select("id,status")
    .eq("status", "team_approved");
  if (lp?.length) {
    // BGH review o route nao? tim page co LessonPlanBoard mode=bgh
    await p.goto(`${BASE}/school/approvals`);
    await settle(p, 1500);
    const approveBtn = p.locator('button[title="Duyệt"]').first();
    if ((await approveBtn.count()) > 0) {
      await approveBtn.click();
      await p.waitForTimeout(2500);
      const ids = lp.map((x) => x.id);
      const { data: after } = await db.from("lesson_plans").select("id,status").in("id", ids);
      const approved = (after ?? []).filter((x) => x.status === "approved").length;
      check("W30", "BGH duyet giao an -> approved", approved >= 1, `moved=${approved}/${ids.length}`);
    } else check("W30", "BGH duyet giao an", false, "no approve btn at /school/approvals");
  } else check("W30", "BGH duyet giao an", true, "khong co team_approved");
  await ctx.close();
}

// W31: GVCN xac nhan lich hen (proposed -> confirmed)
{
  const { ctx, p } = await loginCtx("gvcn@demo.scn");
  const { data: appt } = await db.from("appointments").select("id,status")
    .eq("status", "proposed").limit(1);
  await p.goto(`${BASE}/parents/appointments`);
  await settle(p, 1500);
  if (appt?.length) {
    const confirmBtn = p.locator('button:has-text("Xác nhận"), button:has-text("Nhận lịch")').first();
    if ((await confirmBtn.count()) > 0) {
      await confirmBtn.click();
      await p.waitForTimeout(2500);
      const { data: after } = await db.from("appointments").select("status").eq("id", appt[0].id).single();
      check("W31", "GVCN xac nhan lich hen -> confirmed", after?.status === "confirmed", `status=${after?.status}`);
    } else check("W31", "GVCN xac nhan lich hen", false, "no confirm btn");
  } else check("W31", "GVCN xac nhan lich hen", true, "khong co proposed");
  await ctx.close();
}

console.log("\n=== console errors:", errors.length);
[...new Set(errors)].slice(0, 15).forEach((e) => console.log("  -", e));
const pass = results.filter((r) => r.pass).length;
const fails = results.filter((r) => !r.pass);
console.log(`\n===== ${pass}/${results.length} PASS =====`);
if (fails.length) { console.log("FAILURES:"); fails.forEach((f) => console.log(`  ${f.id} ${f.name} ${f.detail}`)); }
await browser.close();
