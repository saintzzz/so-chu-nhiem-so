// qa-full-coverage.mjs v2 - FULL coverage:
//   Phan 1: Access matrix qua HTTP (moi route x moi role - ca allowed lan denied)
//   Phan 2: Write flows qua UI that -> verify DB
// Chay: node scripts/qa-full-coverage.mjs
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "fs";

const BASE = process.env.BASE_URL ?? "https://sochunhiem.vieschool.com";
const SHOTS = new URL("../docs/qa/screenshots-full/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(SHOTS, { recursive: true });

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
const errors = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${name} ${detail}`);
};

// ===== ACCESS MATRIX (khop requireRoles thuc te) =====
import { MATRIX, ALIASES, ROLE_EMAIL, ROLE_HOME } from "./qa-matrix.mjs";


const browser = await chromium.launch();
async function loginCtx(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() !== "error") return; const t = m.text(); if (/Failed to load resource.*status of 4\d\d/.test(t)) return; errors.push(`${email}: ${t.slice(0, 120)}`); });
  p.on("pageerror", (e) => errors.push(`${email} pageerror: ${e.message.slice(0, 120)}`));
  p.on("requestfailed", (r) => { const err = r.failure()?.errorText ?? ""; if (!err.includes("ERR_ABORTED")) errors.push(`${email} reqfail: ${r.url().slice(0, 80)} ${err}`); });
  p.on("response", (r) => { if (r.status() >= 500) errors.push(`${email} 5xx: ${r.url().slice(0, 80)}`); });
  await gotoSafe(p, `${BASE}/login`, { waitUntil: "networkidle" });
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
// Navigation crash khong duoc giet suite - danh dau de check tiep theo fail.
const gotoSafe = async (p, url, opts) => {
  try {
    await p.goto(url, opts);
    return true;
  } catch (e) {
    console.log(`  [goto timeout] ${url} - ${String(e.message).slice(0, 60)}`);
    return false;
  }
};

// === PHAN 1: FULL ACCESS MATRIX qua HTTP request (nhanh, chinh xac) ===
// Voi moi role: request.get moi route. Allowed -> 200 dung route. Denied -> redirect ve role home.
// Effective roles = role chinh + concurrent_roles (vd gvcn kiem to_truong
// hop le vao /team/*) - oracle phai tinh ca kiem nhiem.
const EFFECTIVE = {};
{
  const { data: profs } = await db
    .from("profiles")
    .select("email,role,concurrent_roles")
    .in("email", Object.values(ROLE_EMAIL));
  for (const p of profs ?? []) {
    EFFECTIVE[p.role] = [p.role, ...(p.concurrent_roles ?? [])];
  }
}
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
      await gotoSafe(p, `${BASE}/login`, { waitUntil: "networkidle" });
      await p.fill("#email", email);
      await p.fill("input[type=password]", "demo1234");
      await p.click("button[type=submit]");
      await p.waitForTimeout(5000);
      r = await fetchRoute();
    }
    if (!r) { // transient timeout/cold-start - retry mot lan truoc khi fail
      await new Promise((res) => setTimeout(res, 2000));
      r = await fetchRoute();
    }
    if (!r) { fails.push(`${route}:no-response`); continue; }
    const { res, finalPath } = r;
    const expected = roles.some((r) => (EFFECTIVE[role] ?? [role]).includes(r));
    if (expected) {
      const ok = (res.ok() && finalPath === route) || (finalPath === ALIASES[route]);
      if (ok) allowOk++; else fails.push(`${route}:expected-allow,redirect->${finalPath}`);
    } else {
      const ok = finalPath === ROLE_HOME[role];
      if (ok) denyOk++; else fails.push(`${route}:expected-deny->${ROLE_HOME[role]},got->${finalPath}`);
    }
  }
  const total = Object.keys(MATRIX).length;
  const nAllowed = Object.values(MATRIX).filter((r) => r.some((x) => (EFFECTIVE[role] ?? [role]).includes(x))).length;
  check(`AM-${role}`, `${role}: ${nAllowed} allow + ${total - nAllowed} deny`,
    fails.length === 0, fails.length ? fails.slice(0, 6).join(" | ") : `${allowOk}+${denyOk} ok`);
  await ctx.close();
}

// === PHAN 2: WRITE FLOWS qua UI -> verify DB ===
const { data: gvcnP } = await db.from("profiles").select("id,school_id").eq("email", "anhptl@nd.scn").single();
const { data: myClasses } = await db.from("classes").select("id,name").eq("gvcn_id", gvcnP.id);
const { data: anyStu } = await db.from("students").select("id,full_name,code").eq("class_id", myClasses[0].id).limit(1).single();
const today = new Date().toISOString().slice(0, 10);
const MARK = `FULL-${Date.now()}`;

{
  const { ctx, p } = await loginCtx("anhptl@nd.scn");

  // W01: Diem danh -> DB. Xoa record cu cua HS hom nay de assert deterministic.
  await db.from("attendance_records").delete().eq("student_id", anyStu.id).eq("date", today);
  await gotoSafe(p, `${BASE}/attendance/daily?class=${myClasses[0].id}&date=${today}`);
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
  await gotoSafe(p, `${BASE}/conduct/records`);
  await settle(p, 1500);
  await p.locator('label:has-text("Học sinh") select').selectOption(anyStu.id).catch(() => {});
  await p.locator('label:has-text("Khen thưởng")').click().catch(() => {});
  await p.locator("textarea").first().fill(`Ghi nhan ${MARK}`);
  await p.locator('button:has-text("Lưu ghi nhận")').click();
  await p.waitForTimeout(2500);
  const { data: cr } = await db.from("conduct_records").select("id").ilike("content", `%${MARK}%`).limit(1);
  check("W02", "Ghi nhan HK -> DB", (cr?.length ?? 0) === 1, "");

  // W03: Thong bao PH - click chip lop ro rang + doi feedback success.
  await gotoSafe(p, `${BASE}/parents/compose`);
  await settle(p, 1500);
  await p.locator(`button:has-text("${myClasses[0].name}")`).first().click({ timeout: 5000 }).catch(() => {});
  await p.locator('input[placeholder*="VD: Thông báo"]').fill(`TB ${MARK}`);
  await p.locator('textarea[placeholder*="nội dung thông báo"]').fill(`ND ${MARK}`);
  const sendBtn = p.locator('button:has-text("Gửi thông báo")').first();
  const btnDisabled = await sendBtn.isDisabled().catch(() => "err");
  await sendBtn.click({ timeout: 10000 }).catch(() => sendBtn.click({ force: true }).catch(() => {}));
  const fbOk = await p.locator('text=/Đã gửi thông báo/').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  const { data: an } = await db.from("announcements").select("id").ilike("content", `%${MARK}%`).limit(1);
  const fbText = fbOk ? "" : `btnDisabled=${btnDisabled} ` + ((await p.locator("body").innerText()).match(/Đã lưu[^.\n]*|không gửi được[^.\n]*|lỗi[^.\n]*/i)?.[0] ?? "no-feedback");
  check("W03", "Thong bao PH -> DB", (an?.length ?? 0) === 1, fbOk ? "" : `feedback=${fbText}`);

  // W04: Cham diem thi dua - form luu vao currentPeriodVN() (thang hien tai VN)
  const vnNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const period = `${vnNow.getFullYear()}-T${vnNow.getMonth() + 1}`;
  await gotoSafe(p, `${BASE}/emulation/scoring`);
  await settle(p, 1500);
  // chon gia tri chua ton tai trong ky de assert deterministic
  const { data: curScores } = await db.from("emulation_scores").select("score")
    .in("class_id", myClasses.map((c) => c.id)).eq("period", period);
  const used = new Set((curScores ?? []).map((e) => e.score));
  const uniqScore = [9, 8, 6, 5, 4, 3, 2, 1, 10].find((v) => !used.has(v)) ?? 7;
  await p.locator('td input[type="number"]').first().fill(String(uniqScore));
  await p.locator('button:has-text("Lưu điểm thi đua")').click();
  await p.waitForTimeout(2500);
  const { data: em } = await db.from("emulation_scores").select("score")
    .in("class_id", myClasses.map((c) => c.id)).eq("period", period);
  check("W04", "Diem thi dua -> DB", (em ?? []).some((e) => e.score === uniqScore),
    `period=${period} scores=${(em ?? []).map((e) => e.score).join(",")}`);

  // W05: Sua ho so HS qua server action (CR-014 + CR-015)
  await gotoSafe(p, `${BASE}/records/students`);
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
    await gotoSafe(p, `${BASE}/records/students`);
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
  // Neu gvcn chi co 1 lop: seed lop tam thu 2 (cung truong, gvcn=anhptl) + 2 HS, cleanup sau.
  let w32TempClass = null;
  let w32Classes = myClasses;
  if (myClasses.length < 2) {
    const { data: src } = await db.from("classes").select("school_id,academic_year_id,grade,campus_id").eq("id", myClasses[0].id).single();
    const { data: tc, error: tce } = await db.from("classes").insert({
      school_id: src.school_id, academic_year_id: src.academic_year_id,
      campus_id: src.campus_id, grade: src.grade,
      name: `TST-${MARK}`, gvcn_id: gvcnP.id, status: "active",
    }).select("id,name").single();
    if (tce) console.log("  [W32 seed class]", tce.message);
    w32TempClass = tc ?? null;
    if (w32TempClass) {
      await db.from("students").insert([
        { class_id: w32TempClass.id, code: `TST1${MARK}`, full_name: `Test Aa ${MARK}`, status: "active" },
        { class_id: w32TempClass.id, code: `TST2${MARK}`, full_name: `Test Bb ${MARK}`, status: "active" },
      ]);
      w32Classes = [myClasses[0], w32TempClass];
    }
  }
  if (w32Classes.length >= 2) {
    const [cA, cB] = w32Classes;
    const rosterBody = async () =>
      (await p.locator("main table, [role=main] table").first().innerText().catch(() => "")) ||
      (await p.locator("main").first().innerText());
    await gotoSafe(p, `${BASE}/register/roster?class=${cA.id}`);
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
    // Ten lop co the nam ngoai <main> (picker/toolbar) - check ca body.
    const fullBodyB = await p.locator("body").innerText();
    const changed = bodyA !== bodyB && fullBodyB.includes(cB.name);
    const hasStuB = !stuB?.length || stuB.some((s) => bodyB.includes(s.full_name.split(" ").pop()));
    check("W32", "Roster doi lop -> data doi theo",
      urlB.includes(cB.id) && !urlA.includes(cB.id) && changed && hasStuB,
      `url=${urlB.includes(cB.id)} diff=${bodyA !== bodyB} cls=${fullBodyB.includes(cB.name)} stu=${hasStuB}`);
  } else check("W32", "Roster doi lop", false, `chi co ${myClasses.length} lop + seed fail`);
  if (w32TempClass) {
    await db.from("students").delete().eq("class_id", w32TempClass.id);
    await db.from("classes").delete().eq("id", w32TempClass.id);
  }

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
    await gotoSafe(p, `${BASE}${route}`);
    await settle(p, 1200);
    const txt = await p.locator("main, [role=main], body").first().innerText();
    check(id, name, re.test(txt), `len=${txt.length}`);
  }
  await ctx.close();
}

// --- GVBM ---
{
  const { ctx, p } = await loginCtx("minhtv@nd.scn");
  await gotoSafe(p, `${BASE}/schedule/period-log`);
  await settle(p, 1500);
  check("W13", "GVBM so dau bai", /tiết|sổ đầu bài/i.test(await p.locator("body").innerText()), "");

  // W14: GVBM grades - chi thay lop minh day (CR-015). Negative control
  // dong: chon 1 lop cung truong ma gvbm KHONG day (tranh stale khi
  // phan cong day thay doi - truoc hard-code 6A3 nhung gvbm co day 6A3).
  const { data: gvbmP } = await db.from("profiles").select("id,school_id").eq("email", "minhtv@nd.scn").single();
  const { data: ttMine } = await db.from("timetable_entries").select("class_id").eq("teacher_id", gvbmP.id);
  const myClassIds = new Set((ttMine ?? []).map((t) => t.class_id));
  const { data: schoolClasses } = await db.from("classes").select("id,name").eq("school_id", gvbmP.school_id);
  const notMine = (schoolClasses ?? []).filter((c) => !myClassIds.has(c.id)).map((c) => c.name);
  await gotoSafe(p, `${BASE}/academics/grades`);
  await settle(p, 1500);
  const gradeTxt = await p.locator("body").innerText();
  const leaked = notMine.filter((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(gradeTxt));
  check("W14", "GVBM chi thay lop minh day (negative control dong)",
    notMine.length === 0 || leaked.length === 0,
    leaked.length ? `LEAK: thay ${leaked.join(",")}` : `scope dung (not-mine: ${notMine.slice(0, 4).join(",")})`);
  await ctx.close();
}

// --- BGH ---
{
  const { ctx, p } = await loginCtx("hainv@nd.scn");
  const bghChecks = [
    ["W15", "/school/announce", /thông báo|toàn trường|gửi/i, "Thong bao truong"],
    ["W16", "/school/approvals", /duyệt|phê duyệt|chờ|kế hoạch/i, "Approvals"],
    ["W17", "/safety/bgh", /an toàn|sự cố|sự vụ|báo cáo/i, "Safety"],
    ["W18", "/school/journals", /nhật ký|sổ|lớp/i, "Journals"],
  ];
  for (const [id, route, re, name] of bghChecks) {
    await gotoSafe(p, `${BASE}${route}`);
    await settle(p, 1200);
    check(id, `BGH ${name}`, re.test(await p.locator("body").innerText()), "");
  }
  await ctx.close();
}

// --- TO_TRUONG ---
{
  const { ctx, p } = await loginCtx("hanhlth@nd.scn");
  await gotoSafe(p, `${BASE}/team/home`);
  await settle(p, 1200);
  check("W19", "To truong home", (await p.locator("body").innerText()).length > 200, "");
  await gotoSafe(p, `${BASE}/team/meetings`);
  await settle(p, 1200);
  check("W20", "To truong meetings", /họp|biên bản|cuộc họp/i.test(await p.locator("body").innerText()), "");
  await ctx.close();
}

// --- KE_TOAN / DEPT ---
{
  const { ctx, p } = await loginCtx("trangpt@nd.scn");
  await gotoSafe(p, `${BASE}/school/equipment`);
  await settle(p, 1200);
  check("W21", "Ke toan equipment", /thiết bị|tài sản|cơ sở/i.test(await p.locator("body").innerText()), "");
  await ctx.close();
}
for (const [role, route] of [["so_gd", "/dept/dashboard"], ["ubnd", "/dept/facilities"]]) {
  const { ctx, p } = await loginCtx(ROLE_EMAIL[role]);
  await gotoSafe(p, `${BASE}${route}`);
  await settle(p, 1200);
  check(`W-${role}`, `${role} ${route}`, (await p.locator("body").innerText()).length > 200, "");
  await ctx.close();
}

// --- Portals ---
{
  const { ctx, p } = await loginCtx("annv@nd.scn");
  await gotoSafe(p, `${BASE}/portal/parent`);
  await settle(p, 2500);
  const w22Body = await p.locator("body").innerText();
  check("W22", "Portal PH", /con|điểm|chuyên cần|học/i.test(w22Body), `len=${w22Body.length}`);
  await ctx.close();
}
{
  const { ctx, p } = await loginCtx("baong@nd.scn");
  await gotoSafe(p, `${BASE}/portal/student/hoc-ba`);
  await settle(p, 1500);
  check("W23", "Hoc ba HS", /học bạ|điểm|hạnh kiểm/i.test(await p.locator("body").innerText()), "");
  await ctx.close();
}

// === PHAN 3: WRITE FLOWS bo sung (period-log, lesson-plan, signoff, meeting, portal) ===

// W24: GVCN luu so dau bai -> period_logs
{
  const { ctx, p } = await loginCtx("anhptl@nd.scn");
  await gotoSafe(p, `${BASE}/schedule/period-log`);
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
  await gotoSafe(p, `${BASE}/academics/lesson-plans`);
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
// Setup: dam bao co pending signoff cho lop gvcn (seed neu thieu) - cung ID chay qua ca 2 buoc
let w26SignoffId = null;
const w26Period = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).slice(0, 7);
{
  for (const c of myClasses) {
    const { data: existing } = await db.from("register_signoffs").select("id,status")
      .eq("class_id", c.id).eq("period", w26Period).eq("type", "so_chu_nhiem").maybeSingle();
    if (existing && existing.status !== "signed") {
      await db.from("register_signoffs").update({ status: "pending", submitted_by: null, submitted_at: null, signed_by: null, signed_at: null, reject_reason: null }).eq("id", existing.id);
      w26SignoffId = existing.id;
      break;
    }
    if (!existing) {
      const { data: ins, error: ie } = await db.from("register_signoffs").insert({ class_id: c.id, period: w26Period, type: "so_chu_nhiem", status: "pending" }).select("id").single();
      if (ie) console.log("  [W26 seed]", ie.message);
      w26SignoffId = ins?.id ?? null;
      if (w26SignoffId) break;
    }
  }
  // Tat ca lop da signed ky nay -> quet ky tiep theo cho toi khi tim duoc
  // slot trong (row co the da signed o ky sau tu run truoc).
  if (!w26SignoffId && myClasses[0]) {
    let [y, m] = w26Period.split("-").map(Number);
    for (let step = 1; step <= 12 && !w26SignoffId; step++) {
      m += 1; if (m > 12) { m = 1; y += 1; }
      const next = `${y}-${String(m).padStart(2, "0")}`;
      const { data: existing } = await db.from("register_signoffs").select("id,status")
        .eq("class_id", myClasses[0].id).eq("period", next).eq("type", "so_chu_nhiem").maybeSingle();
      if (existing && existing.status !== "signed") {
        await db.from("register_signoffs").update({ status: "pending", submitted_by: null, submitted_at: null, signed_by: null, signed_at: null, reject_reason: null }).eq("id", existing.id);
        w26SignoffId = existing.id;
      } else if (!existing) {
        const { data: ins, error: ie } = await db.from("register_signoffs").insert({ class_id: myClasses[0].id, period: next, type: "so_chu_nhiem", status: "pending" }).select("id").single();
        if (ie) console.log("  [W26 seed]", ie.message);
        w26SignoffId = ins?.id ?? null;
      }
    }
  }
}
{
  const { ctx, p } = await loginCtx("anhptl@nd.scn");
  const myClassIds = myClasses.map((c) => c.id);
  const { data: pending } = await db.from("register_signoffs").select("id,status")
    .in("class_id", myClassIds).eq("status", "pending");
  await gotoSafe(p, `${BASE}/register/signoff`);
  await settle(p, 1500);
  if (pending?.length) {
    // Correlate dong UI -> exact signoff row (class name + period -> id)
    const row = p.locator('tr:has(button:has-text("Nộp sổ"))').first();
    if ((await row.count()) > 0) {
      const clsName = (await row.locator("td").nth(0).innerText()).trim();
      const period = (await row.locator("td").nth(1).innerText()).trim();
      const cls = myClasses.find((c) => c.name === clsName);
      const { data: target } = cls ? await db.from("register_signoffs").select("id,status")
        .eq("class_id", cls.id).eq("period", period).eq("status", "pending").maybeSingle() : { data: null };
      if (target) {
        const gvcnPid = gvcnP.id;
        await row.locator('button:has-text("Nộp sổ")').click();
        await p.waitForTimeout(2500);
        const { data: after } = await db.from("register_signoffs").select("id,status,submitted_by").eq("id", target.id).single();
        if (after?.status === "submitted") w26SignoffId = after.id;
        check("W26a", `GVCN nop so ${clsName}/${period} -> pending->submitted (id=${target.id.slice(0, 8)})`,
          after?.status === "submitted" && after?.submitted_by === gvcnPid,
          `before=pending after=${after?.status} by_match=${after?.submitted_by === gvcnPid}`);
      } else check("W26a", "GVCN nop so", false, `khong map duoc row UI -> signoff pending (${clsName}/${period})`);
    } else check("W26a", "GVCN nop so", false, "no submit btn");
  } else check("W26a", "GVCN nop so", false, "PRECONDITION: khong co pending signoff - seed truoc khi chay");
  await ctx.close();
}
{
  const { ctx, p } = await loginCtx("hainv@nd.scn");
  // BGH tao dot ky: chap nhan insert moi HOAC thong bao da ton tai (idempotent)
  await gotoSafe(p, `${BASE}/register/signoff`);
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

  // BGH ky duyet: uu tien id da nop o W26a (cung ID qua pending->submitted->signed)
  const { data: submitted } = await db.from("register_signoffs").select("id,class_id,period")
    .eq("status", "submitted");
  const preferred = w26SignoffId ? submitted?.find((s) => s.id === w26SignoffId) : null;
  if (submitted?.length) {
    let row = p.locator('tr:has(button:has-text("Ký duyệt"))').first();
    if (preferred) {
      const { data: prefCls } = await db.from("classes").select("name").eq("id", preferred.class_id).single();
      const exact = p.locator('tr', { hasText: prefCls?.name ?? "" }).filter({ has: p.locator('button:has-text("Ký duyệt")') }).filter({ hasText: preferred.period }).first();
      if ((await exact.count()) > 0) row = exact;
    }
    if ((await row.count()) > 0) {
      const clsName = (await row.locator("td").nth(0).innerText()).trim();
      const period = (await row.locator("td").nth(1).innerText()).trim();
      const { data: clsAll } = await db.from("classes").select("id,name").eq("name", clsName);
      const clsIds = new Set((clsAll ?? []).map((c) => c.id));
      const target = submitted.find((s) => clsIds.has(s.class_id) && s.period === period);
      if (target) {
        const { data: bghP } = await db.from("profiles").select("id").eq("email", "hainv@nd.scn").single();
        await row.locator('button:has-text("Ký duyệt")').first().click();
        await p.waitForTimeout(2500);
        const { data: after } = await db.from("register_signoffs").select("id,status,signed_by").eq("id", target.id).single();
        check("W26c", `BGH ky duyet ${clsName}/${period} -> submitted->signed (id=${target.id.slice(0, 8)})`,
          after?.status === "signed" && after?.signed_by === bghP?.id,
          `after=${after?.status} signed_by_match=${after?.signed_by === bghP?.id}`);
      } else check("W26c", "BGH ky duyet", false, `khong map duoc row UI -> signoff submitted (${clsName}/${period})`);
    } else check("W26c", "BGH ky duyet", false, "no sign btn");
  } else check("W26c", "BGH ky duyet", false, "PRECONDITION: khong co submitted signoff");
  await ctx.close();
}

// W27: To truong tao buoi sinh hoat -> dept_meetings
{
  const { ctx, p } = await loginCtx("hanhlth@nd.scn");
  await gotoSafe(p, `${BASE}/team/meetings`);
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
  const { ctx, p } = await loginCtx("annv@nd.scn");
  await gotoSafe(p, `${BASE}/portal/parent`);
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
// Seed deterministic: can 1 plan submitted tai truong Nguyen Du (scope school).
{
  const { data: ttProf } = await db.from("profiles").select("id,school_id")
    .eq("email", "hanhlth@nd.scn").single();
  const { data: lp0 } = await db.from("lesson_plans").select("id")
    .eq("school_id", ttProf.school_id).eq("status", "submitted").limit(1);
  let w29Id = lp0?.[0]?.id ?? null;
  if (!w29Id) {
    const { data: teacher } = await db.from("profiles").select("id")
      .eq("school_id", ttProf.school_id).eq("role", "gvbm").limit(1);
    const { data: cls } = await db.from("classes").select("id")
      .eq("school_id", ttProf.school_id).eq("status", "active").limit(1);
    const { data: sub } = await db.from("subjects").select("id")
      .eq("school_id", ttProf.school_id).limit(1);
    const { data: ins, error: ie } = await db.from("lesson_plans").insert({
      school_id: ttProf.school_id,
      teacher_id: teacher[0].id,
      class_id: cls[0].id,
      subject_id: sub[0].id,
      title: "QA-W29 deterministic plan",
      content: "Noi dung giao an QA",
      week: 9,
      status: "submitted",
    }).select("id").single();
    if (ie) console.log("  [W29 seed]", ie.message);
    w29Id = ins?.id ?? null;
  }
  const { ctx, p } = await loginCtx("hanhlth@nd.scn");
  await gotoSafe(p, `${BASE}/team/lesson-plans`);
  await settle(p, 1500);
  if (w29Id) {
    const approveBtn = p.locator('button[title*="Duyệt"]').first();
    if ((await approveBtn.count()) > 0) {
      await approveBtn.click();
      await p.waitForTimeout(800);
      const confirmBtn = p.locator('button:has-text("Duyệt")').first();
      if ((await confirmBtn.count()) > 0) await confirmBtn.click();
      let after = null;
      for (let i = 0; i < 8 && after?.status !== "team_approved"; i++) {
        await p.waitForTimeout(1500);
        ({ data: after } = await db.from("lesson_plans").select("id,status,team_reviewed_by")
          .eq("id", w29Id).single());
      }
      check("W29", "To truong duyet giao an -> team_approved",
        after?.status === "team_approved", `id=${w29Id.slice(0,8)} status=${after?.status} by=${after?.team_reviewed_by === ttProf.id}`);
    } else check("W29", "To truong duyet giao an", false, "no approve btn");
  } else check("W29", "To truong duyet giao an", false, "PRECONDITION: seed plan that bai");
  await ctx.close();
}

// W30: BGH duyet cuoi giao an (team_approved -> approved)
{
  const { ctx, p } = await loginCtx("hainv@nd.scn");
  const { data: lp } = await db.from("lesson_plans").select("id,status")
    .eq("status", "team_approved");
  if (lp?.length) {
    // BGH review o route nao? tim page co LessonPlanBoard mode=bgh
    await gotoSafe(p, `${BASE}/school/approvals`);
    await settle(p, 1500);
    const approveBtn = p.locator('button[title="Duyệt"]').first();
    if ((await approveBtn.count()) > 0) {
      await approveBtn.click();
      // Poll DB toi 12s - server action tren lambda lanh co the cham hon
      // sleep co dinh.
      const ids = lp.map((x) => x.id);
      let approved = 0;
      for (let i = 0; i < 8 && approved === 0; i++) {
        await p.waitForTimeout(1500);
        const { data: after } = await db.from("lesson_plans").select("id,status").in("id", ids);
        approved = (after ?? []).filter((x) => x.status === "approved").length;
      }
      check("W30", "BGH duyet giao an -> approved", approved >= 1, `moved=${approved}/${ids.length}`);
    } else check("W30", "BGH duyet giao an", false, "no approve btn at /school/approvals");
  } else check("W30", "BGH duyet giao an", false, "PRECONDITION: khong co lesson_plans team_approved");
  await ctx.close();
}

// W31: GVCN xac nhan lich hen (proposed -> confirmed)
// Seed deterministic: can 1 appointment proposed cho anhptl (teacher_id = anhptl).
{
  const anhptlId = "bb42e98d-f6ca-40ff-98c9-4440beda01a7";
  const { data: ap0 } = await db.from("appointments").select("id")
    .eq("teacher_id", anhptlId).eq("status", "proposed").limit(1);
  let w31Id = ap0?.[0]?.id ?? null;
  if (!w31Id) {
    const { data: cls } = await db.from("classes").select("id")
      .eq("gvcn_id", anhptlId).eq("status", "active").limit(1);
    const { data: st } = cls?.length
      ? await db.from("students").select("id").eq("class_id", cls[0].id).limit(1)
      : { data: [] };
    const { data: ps } = st?.length
      ? await db.from("parent_students").select("parent_id").eq("student_id", st[0].id).limit(1)
      : { data: [] };
    if (cls?.length && st?.length && ps?.length) {
      const { data: ins, error: ie } = await db.from("appointments").insert({
        parent_id: ps[0].parent_id,
        teacher_id: anhptlId,
        student_id: st[0].id,
        scheduled_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        purpose: "QA-W31 deterministic appointment",
        status: "proposed",
      }).select("id").single();
      if (ie) console.log("  [W31 seed]", ie.message);
      w31Id = ins?.id ?? null;
    }
  }
  const { ctx, p } = await loginCtx("anhptl@nd.scn");
  await gotoSafe(p, `${BASE}/parents/appointments`);
  await settle(p, 1500);
  if (w31Id) {
    const confirmBtn = p.locator('button:has-text("Xác nhận"), button:has-text("Nhận lịch")').first();
    if ((await confirmBtn.count()) > 0) {
      await confirmBtn.click();
      let after = null;
      for (let i = 0; i < 8 && after?.status !== "confirmed"; i++) {
        await p.waitForTimeout(1500);
        ({ data: after } = await db.from("appointments").select("id,status,teacher_id")
          .eq("id", w31Id).single());
      }
      check("W31", "GVCN xac nhan lich hen -> confirmed",
        after?.status === "confirmed", `id=${w31Id.slice(0,8)} status=${after?.status}`);
    } else check("W31", "GVCN xac nhan lich hen", false, "no confirm btn");
  } else check("W31", "GVCN xac nhan lich hen", false, "PRECONDITION: seed appointment that bai");
  await ctx.close();
}

console.log("\n=== console errors:", errors.length);
[...new Set(errors)].slice(0, 15).forEach((e) => console.log("  -", e));
check("CONSOLE", "0 console errors", errors.length === 0, [...new Set(errors)].slice(0, 3).join(" | "));
const pass = results.filter((r) => r.pass).length;
const fails = results.filter((r) => !r.pass);
console.log(`\n===== ${pass}/${results.length} PASS =====`);
if (fails.length) { console.log("FAILURES:"); fails.forEach((f) => console.log(`  ${f.id} ${f.name} ${f.detail}`)); }
await browser.close();
process.exit(fails.length ? 1 : 0);
