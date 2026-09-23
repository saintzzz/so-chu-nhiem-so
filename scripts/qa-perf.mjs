// qa-perf.mjs - Performance suite: do TTFB + full-load + interaction latency
// tren PRODUCTION cho tat ca route chinh cua moi role.
// Nguong (AGENTS.md): server render < 1000ms, dieu huong/tuong tac < 3000ms.
// Chay: node scripts/qa-perf.mjs
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "https://so-chu-nhiem-so-theta.vercel.app";
const TTFB_LIMIT = 1000;
const LOAD_LIMIT = 3000;

const ROUTES = {
  gvcn: [
    "/dashboard", "/attendance/daily", "/register/roster", "/register/seating",
    "/academics/grades", "/schedule/period-log", "/conduct/records",
    "/emulation/scoring", "/records/students", "/register/audit",
    "/parents/inbox", "/notifications", "/register/plans",
  ],
  gvbm: ["/academics/grades", "/schedule/period-log", "/schedule/timetable", "/academics/lesson-plans"],
  bgh: ["/school/dashboard", "/register/audit", "/school/approvals", "/register/signoff", "/school/staff"],
  phu_huynh: ["/portal", "/parents/inbox"],
  hoc_sinh: ["/portal/student"],
};

const results = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id.padEnd(38)} ${detail}`);
};

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("input[type=password]", "demo1234");
  await page.click("button[type=submit]");
  await page.waitForTimeout(5000);
}

const browser = await chromium.launch();
const EMAIL = (r) => `${r}@demo.scn`;

for (const [role, routes] of Object.entries(ROUTES)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, EMAIL(role));

  for (const route of routes) {
    // Lan 1 (co the cold) + lan 2 (warm) - report warm vi cold-start Vercel la van de rieng
    const samples = [];
    for (let i = 0; i < 2; i++) {
      const t0 = Date.now();
      await page.goto(`${BASE}${route}`, { waitUntil: "commit" });
      const ttfb = Date.now() - t0;
      await page.waitForLoadState("networkidle").catch(() => {});
      const load = Date.now() - t0;
      samples.push({ ttfb, load });
    }
    const warm = samples[1];
    check(`${role} ${route}`, "ttfb", warm.ttfb < TTFB_LIMIT,
      `ttfb=${samples.map((s) => s.ttfb).join("/")}ms load=${samples.map((s) => s.load).join("/")}ms`);
    check(`${role} ${route}`, "load", warm.load < LOAD_LIMIT, "");
  }
  await ctx.close();
}

// Interaction latency: doi lop tren roster (client nav - phai < 3s)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "gvcn@demo.scn");
  await page.goto(`${BASE}/register/roster`, { waitUntil: "networkidle" });
  const chips = page.locator('main a[href*="/register/roster?class="]');
  const n = await chips.count();
  if (n >= 2) {
    for (let i = 0; i < Math.min(n, 4); i++) {
      const t = Date.now();
      await chips.nth(i).click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(300);
      const ms = Date.now() - t;
      check("roster class-switch", `chip ${i + 1}`, ms < LOAD_LIMIT, `${ms}ms`);
    }
  }
  await ctx.close();
}

const pass = results.filter((r) => r.pass).length;
const fails = results.filter((r) => !r.pass);
console.log(`\n===== ${pass}/${results.length} PASS (ttfb<${TTFB_LIMIT}ms, load<${LOAD_LIMIT}ms) =====`);
if (fails.length) {
  console.log("SLOWEST / FAILURES:");
  fails.slice(0, 20).forEach((f) => console.log(`  ${f.id} ${f.name}`));
}
await browser.close();
