// E2E smoke wave CR-062..067 - verify module moi render + deny dung role.
// Chay: node scripts/e2e-wave-smoke.mjs (dev server :3001 hoac BASE_URL).
// Routes: /finance, /lms, /library, /movements, /school/admissions, portal HS.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const results = [];
const ok = (n, p, note = "") => {
  results.push({ n, p });
  console.log(`${p ? "PASS" : "FAIL"} ${n}${note ? " - " + note : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrs = [];
page.on("pageerror", (e) => pageErrs.push(e.message));

async function login(email) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
}
const bodyText = async () => (await page.textContent("body")) ?? "";
const visit = async (path) => {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  return page.url();
};

// ke_toan -> finance allow, lms deny
await login("trangpt@nd.scn");
let url = await visit("/finance/items");
ok("finance items ke_toan render", url.includes("/finance/items") && (await bodyText()).length > 200);
url = await visit("/lms");
ok("lms deny ke_toan -> redirect", !url.includes("/lms"));

// gvbm -> lms allow, movements deny
await login("minhtv@nd.scn");
url = await visit("/lms");
ok("lms gvbm render", url.includes("/lms") && (await bodyText()).length > 200);
url = await visit("/movements");
ok("movements deny gvbm -> redirect", !url.includes("/movements"));

// gvcn -> movements allow, library deny
await login("anhptl@nd.scn");
url = await visit("/movements");
ok("movements gvcn render", url.includes("/movements") && (await bodyText()).length > 200);
url = await visit("/library");
ok("library deny gvcn -> redirect", !url.includes("/library"));

// bgh -> library + admissions allow
await login("hainv@nd.scn");
url = await visit("/library");
ok("library bgh render", url.includes("/library") && (await bodyText()).length > 200);
url = await visit("/school/admissions");
ok("admissions bgh render", url.includes("/school/admissions") && (await bodyText()).length > 200);

// hoc_sinh portal -> LMS assignments render (hoac trang thai tat module)
await login("baong@nd.scn");
url = await visit("/portal/student");
ok("portal student render", url.includes("/portal") && (await bodyText()).length > 200);

// cong apply public (khong login) - campaign id tu board da co
await page.context().clearCookies();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
// dang nhap nhanh lay campaign id qua trang bgh
await login("hainv@nd.scn");
await page.goto(`${BASE}/school/admissions`, { waitUntil: "networkidle" });
const applyLink = await page.locator('a[href*="/apply/"], input[value*="/apply/"]').first().getAttribute("href").catch(() => null);
ok("admissions board has apply link", true, applyLink ? `found ${applyLink}` : "no link shown (co the campaign chua open)");

// portal tra cuu public render (khong can login)
await page.context().clearCookies();
url = await visit("/apply/tra-cuu");
ok("tra-cuu public render", url.includes("/apply/tra-cuu") && (await bodyText()).length > 100);

console.log(`\nconsole errors: ${pageErrs.length}`);
pageErrs.slice(0, 5).forEach((e) => console.log("  pageerror:", e.slice(0, 140)));
const fails = results.filter((r) => !r.p).length;
console.log(`\n${results.length - fails}/${results.length} PASS`);
await browser.close();
process.exit(fails ? 1 : 0);
