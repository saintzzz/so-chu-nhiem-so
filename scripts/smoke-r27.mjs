// Post-deploy smoke for r26 (commit 9caca75/3a5d2b6) on prod.
// Login per role, visit r26-swept routes, check error boundaries + console errors.
import { chromium } from "playwright";

const BASE = "https://sochunhiem.vieschool.com";
const results = [];
const check = (id, name, pass, detail = "") =>
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${name}${detail ? " - " + detail : ""}`);

const ROUTES = {
  teacher: [
    "/activities/announce", "/activities/plan", "/activities/attendance",
    "/attendance/daily-report", "/safety/followup", "/safety/bgh",
    "/notifications", "/parents/inbox", "/schedule/period-log",
  ],
  school: ["/school/daily-reports", "/school/users", "/dept/reports"],
  parent: ["/portal", "/portal/parent"],
};

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const consoleErrs = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 100)); });
page.on("pageerror", (e) => consoleErrs.push("PAGEERR: " + e.message.slice(0, 100)));

async function login(email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.fill('#email', email);
  await page.fill('#password', "demo1234");
  await page.click('button[type="submit"], button:has-text("Đăng nhập")');
  await page.waitForTimeout(4000);
  return !page.url().includes("/login");
}

for (const [role, routes] of Object.entries(ROUTES)) {
  const email = { teacher: "anhptl@nd.scn", school: "hainv@nd.scn", parent: "annv@nd.scn" }[role];
  const ok = await login(email);
  check(`${role}-login`, `${role} login`, ok, page.url());
  if (!ok) continue;
  for (const r of routes) {
    consoleErrs.length = 0;
    try {
      const resp = await page.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(2500);
      const body = (await page.textContent("body")) ?? "";
      const status = resp?.status() ?? 0;
      const errBoundary = /Something went wrong|Đã xảy ra lỗi|Application error/i.test(body);
      const denied = page.url().includes("/login") || status === 403;
      const realErrs = consoleErrs.filter((e) => !/favicon|third-party|net::ERR_ABORTED/i.test(e));
      check(
        `${role}${r}`, `${r}`,
        status === 200 && !errBoundary,
        `status=${status} boundary=${errBoundary} console=${realErrs.length}${realErrs[0] ? " " + realErrs[0] : ""}`,
      );
    } catch (e) {
      check(`${role}${r}`, r, false, e.message.slice(0, 80));
    }
  }
  // logout via clearing cookies for next role
  await ctx.clearCookies();
}

// Denied-route checks: teacher -> admin-only; parent -> teacher route
await login("anhptl@nd.scn");
await page.goto(`${BASE}/school/users`, { waitUntil: "domcontentloaded", timeout: 20000 });
await page.waitForTimeout(2000);
check("deny-t2", "teacher blocked from /school/users", !page.url().includes("/school/users") || (await page.textContent("body")).includes("không có quyền"), page.url());
await ctx.clearCookies();
await login("minhtv@nd.scn");
await page.goto(`${BASE}/attendance/daily`, { waitUntil: "domcontentloaded", timeout: 20000 });
await page.waitForTimeout(2000);
check("deny-p1", "parent blocked from /attendance/daily", !page.url().includes("/attendance/daily"), page.url());

await browser.close();
const fails = results.filter((r) => !r.pass).length;
console.log(`\nDONE`);
