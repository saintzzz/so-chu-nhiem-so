// Chup screenshot tung buoc cua lifecycle E2E tren prod -> docs/demo/e2e-assets/
// Dung cho KICH-BAN-DEMO-E2E.pptx. Chay: node scripts/capture-e2e-screens.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "https://sochunhiem.vieschool.com";
const OUT = "docs/demo/e2e-assets";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function login(email, pass = "demo1234") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(90000);
  for (let i = 0; i < 3; i++) {
    try {
      await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90000 });
      await p.fill("input[type=text]", email);
      await p.fill("input[type=password]", pass);
      await p.click("button[type=submit]");
      await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
      return { ctx, p };
    } catch {
      if (i === 2) throw new Error(`login ${email} failed`);
      await p.waitForTimeout(6000);
    }
  }
}

async function shot(p, url, file, extra) {
  for (let i = 0; i < 3; i++) {
    await p.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    if (extra) await extra(p);
    const err = await p.locator("text=Không tải được dữ liệu").count();
    if (!err) break;
    console.log(`  retry ${file} (page error state)`);
    await p.waitForTimeout(4000);
  }
  await p.screenshot({ path: `${OUT}/${file}` });
  console.log("shot", file, "->", p.url());
}

// A - So GD tao truong
{
  const { ctx, p } = await login("sovqt@demo.scn");
  await shot(p, "/dept/schools", "a1-dept-schools.png");
  await ctx.close();
}
// B - BGH
{
  const { ctx, p } = await login("hainv@nd.scn");
  await shot(p, "/school/users", "b1-school-users.png",
    async (p) => p.getByRole("button", { name: /Thêm giáo viên/ }).click().catch(() => {}));
  await shot(p, "/records/intake", "b2-records-intake.png",
    async (p) => p.getByRole("button", { name: "Tiếp nhận lớp mới" }).click().catch(() => {}));
  await shot(p, "/records/upload", "b3-upload-csv.png", async (p) => {
    const fi = p.locator("div.border-dashed input[type=file]");
    await fi.setInputFiles(`${OUT}/danh-sach-hoc-sinh-mau.csv`).catch(() => {});
    await p.waitForSelector("text=dòng hợp lệ", { timeout: 20000 }).catch(() => {});
  });
  await shot(p, "/school/assignments", "b4-assignments.png");
  await shot(p, "/school/students", "b5-students.png");
  await ctx.close();
}
// C - GVCN
{
  const { ctx, p } = await login("anhptl@nd.scn");
  await shot(p, "/attendance/daily", "c1-attendance.png");
  await shot(p, "/register/roster", "c2-roster.png");
  await ctx.close();
}
// D - GVBM home (deny path evidence: bi day ve route rieng)
{
  const { ctx, p } = await login("minhtv@nd.scn");
  await shot(p, "/school/users", "d1-gvbm-denied.png");
  await ctx.close();
}
// E - PH portal
{
  const { ctx, p } = await login("annv@nd.scn");
  await shot(p, "/portal/parent", "e1-parent-portal.png");
  await ctx.close();
}
await browser.close();
console.log("done ->", OUT);
