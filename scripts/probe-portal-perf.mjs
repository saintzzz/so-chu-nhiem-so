// probe-portal-perf.mjs - do TTFB nhieu lan cho portal pages (sau opt embed).
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "https://sochunhiem.vieschool.com";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

async function login(email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

for (const [email, route] of [
  ["sovqt@demo.scn", "/dept/usage"],
  ["sovqt@demo.scn", "/dept/schools"],
]) {
  await ctx.clearCookies();
  await login(email);
  const ttfbs = [];
  for (let i = 0; i < 6; i++) {
    const t0 = Date.now();
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    const ttfb = Date.now() - t0;
    ttfbs.push(ttfb);
    await page.waitForTimeout(500);
  }
  const sorted = [...ttfbs].sort((a, b) => a - b);
  console.log(`${route}: ttfb=[${ttfbs.join(",")}] min=${sorted[0]} med=${sorted[Math.floor(sorted.length / 2)]}`);
}

await browser.close();
