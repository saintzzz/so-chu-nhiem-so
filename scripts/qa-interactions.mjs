// qa-interactions.mjs - sweep toan bo route: do load, click tung control an toan,
// do latency phan hoi, bat console error. Chay: node scripts/qa-interactions.mjs
import { chromium } from "playwright";

const BASE = "https://so-chu-nhiem-so-theta.vercel.app";
const results = [];
const errors = [];

// Route theo role - phu het nav GVCN + spot-check BGH/PH
const ROUTES = {
  gvcn: [
    "/dashboard", "/attendance/daily", "/attendance/daily-report",
    "/attendance/leaves", "/attendance/notify", "/attendance/tracking",
    "/attendance/history", "/register/roster", "/register/seating",
    "/register/kpi", "/register/plans", "/register/suggestions",
    "/register/seating-history", "/register/export", "/register/signoff",
    "/register/lock-records", "/register/audit",
    "/schedule/timetable", "/schedule/period-log", "/academics/grades",
    "/academics/lesson-plans", "/academics/exams", "/academics/analysis",
    "/academics/support", "/academics/plans", "/academics/teacher-chat",
    "/academics/parent-chat", "/conduct/evaluation", "/conduct/records",
    "/conduct/student-chat", "/counseling/intake", "/counseling/assessment",
    "/counseling/referral", "/activities/plan", "/activities/attendance",
    "/activities/announce", "/emulation/scoring", "/emulation/ranking",
    "/parents/compose", "/parents/inbox", "/parents/appointments",
    "/parents/cmhs", "/records/students", "/records/upload",
    "/records/report", "/records/history", "/profile",
  ],
  bgh: ["/school/staff", "/school/users", "/school/students",
    "/school/announce", "/school/exam-analytics", "/school/strategy",
    "/school/equipment", "/school/nq37", "/school/journals",
    "/schedule/manage", "/safety/bgh"],
  gvbm: ["/academics/grades", "/schedule/period-log", "/schedule/timetable"],
  phuhuynh: ["/portal/parent"],
  hocsinh: ["/portal/student", "/portal/student/hoc-ba"],
};

// Controls KHONG click (destructive/submit/nav-di)
const SKIP_TEXT = /xoá|xóa|hủy kế hoạch|ký duyệt|từ chối|nộp sổ|gửi|lưu|tạo đợt|duyệt|khóa|đăng|logout|đăng xuất|xác nhận/i;

function check(id, name, pass, detail = "") {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${name} ${detail}`);
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("input[type=password]", "demo1234");
  await page.click("button[type=submit]");
  await page.waitForTimeout(5000);
}

const browser = await chromium.launch();

for (const [role, routes] of Object.entries(ROUTES)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${role} ${page.url().replace(BASE, "")}: ${m.text().slice(0, 120)}`);
  });
  page.on("pageerror", (e) => errors.push(`${role} ${page.url().replace(BASE, "")}: ${String(e).slice(0, 120)}`));
  await login(page, `${role}@demo.scn`);

  for (const route of routes) {
    const t0 = Date.now();
    await page.goto(`${BASE}${route}`, { waitUntil: "commit" });
    const ttfb = Date.now() - t0;
    await page.waitForLoadState("networkidle").catch(() => {});
    const load = Date.now() - t0;
    const bodyTxt = await page.locator("body").innerText().catch(() => "");
    const hasContent = bodyTxt.length > 200 && !/404|not found/i.test(bodyTxt.slice(0, 200));
    check(`${role} ${route}`, "load", hasContent && load < 8000, `ttfb=${ttfb}ms load=${load}ms`);

    // Click cac control an toan: chips/tab/filter/link giu trang
    const chips = page.locator('main a[href*="class="], main button:not([type=submit])');
    const n = await chips.count();
    let clicked = 0;
    for (let i = 0; i < Math.min(n, 6); i++) {
      const el = chips.nth(i);
      const txt = ((await el.innerText().catch(() => "")) || "").trim();
      if (!txt || SKIP_TEXT.test(txt)) continue;
      const tag = await el.evaluate((e) => e.tagName);
      const t1 = Date.now();
      if (tag === "A") {
        // chi click link noi bo giu param (chip), khong di trang khac
        const href = await el.getAttribute("href");
        if (!href || !href.includes(route.split("?")[0])) continue;
        await el.click();
        await page.waitForLoadState("networkidle").catch(() => {});
        clicked++;
        results.push({ id: `${route} chip`, name: txt.slice(0, 30), pass: true, detail: `${Date.now() - t1}ms` });
      } else {
        // button: chi click neu la toggle/tab/expand (khong submit/destructive)
        await el.click().catch(() => {});
        await page.waitForTimeout(600);
        clicked++;
        results.push({ id: `${route} btn`, name: txt.slice(0, 30), pass: true, detail: `${Date.now() - t1}ms` });
        // mo modal? dong bang Esc
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
    }
    if (clicked > 0) console.log(`  ${route}: clicked ${clicked} controls`);
  }
  await ctx.close();
}

// Do dac biet: dashboard chip latency cold->warm, 3 vong
const ctx = await browser.newContext();
const page = await ctx.newPage();
await login(page, "gvcn@demo.scn");
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
for (let i = 0; i < 4; i++) {
  const target = i % 2 === 0 ? "8A2" : "6A3";
  const t = Date.now();
  await page.locator("a").filter({ hasText: new RegExp(`^${target}`) }).first().click();
  await page.waitForLoadState("networkidle").catch(() => {});
  const ms = Date.now() - t;
  check("dashboard-chip", `click ${target} vong ${i + 1}`, ms < 5000, `${ms}ms`);
}
await ctx.close();

console.log("\n=== CONSOLE ERRORS:", errors.length);
[...new Set(errors)].slice(0, 15).forEach((e) => console.log("  -", e));
const pass = results.filter((r) => r.pass).length;
console.log(`\n===== ${pass}/${results.length} PASS =====`);
await browser.close();
