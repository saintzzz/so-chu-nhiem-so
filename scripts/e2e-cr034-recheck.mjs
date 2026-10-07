// Re-check 2 failed assertions of e2e-cr034 (school suffix fixed).
import { chromium } from "playwright";
const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const suffix = process.argv[2];
const results = [];
const ok = (n, p, note = "") => { results.push(p); console.log(`${p ? "PASS" : "FAIL"} ${n}${note ? " - " + note : ""}`); };
let ctx, page;
async function login(email, pw) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", pw);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
}
const browser = await chromium.launch();
ctx = await browser.newContext();
page = await ctx.newPage();
try {
  await login(`hieutruong.demo${suffix}@demo.scn`, "demo1234");
  await page.goto(`${BASE}/school/users`, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  const t = await page.textContent("body");
  ok("GV row in users table", t.includes(`gv.demo${suffix}@demo.scn`));

  await ctx.clearCookies();
  await login("gvcn@demo.scn", "demo1234");
  await page.goto(`${BASE}/register/roster`, { waitUntil: "networkidle" });
  const t2 = await page.textContent("body");
  ok("gvcn /register/roster render", /học sinh|danh sách|phụ huynh/i.test(t2));
} catch (e) {
  ok("suite", false, String(e.message ?? e).slice(0, 300));
}
await browser.close();
const f = results.filter((r) => !r).length;
console.log(`\n=== ${results.length - f}/${results.length} PASS ===`);
process.exit(f ? 1 : 0);
