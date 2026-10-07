// E2E CR-034 - demo gate 15/10. Run: node scripts/e2e-cr034.mjs
// Requires: dev server on :3111 (BASE_URL override ok), playwright chromium.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const results = [];
const ok = (name, pass, note = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${note ? " - " + note : ""}`);
};

const suffix = Date.now() % 100000;
const adminEmail = `hieutruong.demo${suffix}@demo.scn`;
const gvEmail = `gv.demo${suffix}@demo.scn`;
const schoolName = `THPT Demo Gate ${suffix}`;
const schoolCode = `THPT-DG${suffix}`;
let ctx, page;

async function login(email, pw) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", pw);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
  return page.url();
}

try {
  const browser = await chromium.launch();
  ctx = await browser.newContext();
  page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

  // 1. Sở GD login
  const u1 = await login("sogd@demo.scn", "demo1234");
  ok("login sogd", !u1.includes("/login"), u1);

  // 2. /dept/schools render
  await page.goto(`${BASE}/dept/schools`, { waitUntil: "networkidle" });
  ok("dept/schools render", (await page.locator('button:has-text("Tạo trường")').count()) > 0);

  // 3. Create school + admin + demo seed
  await page.fill('input[placeholder="Tên trường *"]', schoolName);
  await page.fill('input[placeholder*="Mã trường"]', schoolCode);
  await page.click('button:has-text("THPT")');
  await page.fill('input[placeholder="Họ tên admin trường (BGH) *"]', "Hiệu trưởng Demo");
  await page.fill('input[type="email"]', adminEmail);
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button:has-text("Tạo trường")');
  await page.waitForSelector('text=Đã tạo trường', { timeout: 30000 });
  ok("create school", true);

  // school appears in table after revalidate
  await page.waitForTimeout(1500);
  const t1 = await page.textContent("body");
  ok("school listed", t1.includes(schoolName));

  // 4. New school admin login -> /school/users
  await ctx.clearCookies();
  const u2 = await login(adminEmail, "demo1234");
  ok("login new admin", !u2.includes("/login"), u2);
  await page.goto(`${BASE}/school/users`, { waitUntil: "networkidle" });
  ok("admin sees /school/users", (await page.locator('button:has-text("Thêm giáo viên")').count()) > 0);

  // 5. Admin creates GV account
  await page.click('button:has-text("Thêm giáo viên")');
  await page.fill('label:has-text("Họ tên") input', "GV Demo Gate");
  await page.fill('input[type="email"]', gvEmail);
  await page.fill('label:has-text("Mật khẩu") input', "demo1234");
  await page.click('button:has-text("Tạo tài khoản")');
  await page.waitForSelector('text=Đã tạo tài khoản', { timeout: 30000 });
  const t2 = await page.textContent("body");
  ok("admin creates GV", t2.includes(gvEmail));

  // 5b. GV moi login -> role home + truong moi co lap (0 HS truong khac)
  await ctx.clearCookies();
  const u3 = await login(gvEmail, "demo1234");
  ok("login new GV", !u3.includes("/login"), u3);
  await page.goto(`${BASE}/records/students`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  const tgv = await page.textContent("body");
  // truong moi: khong co HS nao cua truong khac (empty state hoac chi HS seed cua truong minh)
  ok("new GV records khong lo HS truong khac", !/Trường THCS Nguyễn Du|Trường TH Chu Văn An/i.test(tgv), "");

  // 5c. GV moi denied dept routes
  await page.goto(`${BASE}/dept/schools`, { waitUntil: "networkidle" });
  const tg2 = await page.textContent("body");
  ok("new GV denied /dept/schools", !tg2.includes("Tạo trường mới"), "");

  // 6. Usage dashboard
  await ctx.clearCookies();
  await login("sogd@demo.scn", "demo1234");
  await page.goto(`${BASE}/dept/usage`, { waitUntil: "networkidle" });
  const t3 = await page.textContent("body");
  ok("dept/usage render", /hoạt động|đăng nhập|tài khoản/i.test(t3));
  ok("usage shows new school", t3.includes(schoolName));

  // 7. RBAC deny: gvcn hits /dept/schools
  await ctx.clearCookies();
  await login("gvcn@demo.scn", "demo1234");
  await page.goto(`${BASE}/dept/schools`, { waitUntil: "networkidle" });
  const t4 = await page.textContent("body");
  ok("gvcn denied /dept/schools", !t4.includes("Tạo trường mới"));

  // 8. gvcn roster renders (parent-grant UI reachable)
  await page.goto(`${BASE}/register/roster`, { waitUntil: "networkidle" });
  const t5 = await page.textContent("body");
  ok("gvcn roster render", /học sinh|danh sách|Liên kết/i.test(t5));

  await browser.close();
} catch (e) {
  ok("suite error", false, String(e.message ?? e).slice(0, 300));
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n=== ${results.length - failed}/${results.length} PASS ===`);
process.exit(failed ? 1 : 0);
