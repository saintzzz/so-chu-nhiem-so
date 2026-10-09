import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const BASE = "https://sochunhiem.vieschool.com";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim().replace(/^"|"$/g,"")]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const MARK = `PROBE2-${Date.now()}`;
const browser = await chromium.launch();
const p = await (await browser.newContext()).newPage();
p.on("response", async r => {
  if (r.request().method() === "POST") {
    const body = await r.text().catch(() => "");
    console.log(`[POST] ${r.status()} ${r.url().slice(0, 90)} :: ${body.slice(0, 300)}`);
  }
});
p.on("console", m => { if (m.type()==="error") console.log("[console]", m.text().slice(0,150)); });
p.on("pageerror", e => console.log("[pageerror]", e.message.slice(0,200)));
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill("#email", "anhptl@nd.scn");
await p.fill("input[type=password]", "demo1234");
await p.click("button[type=submit]");
await p.waitForTimeout(5000);
await p.goto(`${BASE}/parents/compose`);
await p.waitForTimeout(2000);
await p.locator('input[placeholder*="VD: Thông báo"]').fill(`TB ${MARK}`);
await p.locator('textarea[placeholder*="nội dung thông báo"]').fill(`ND ${MARK}`);
const sendBtn = p.locator('button:has-text("Gửi thông báo")').first();
console.log("disabled:", await sendBtn.isDisabled());
await sendBtn.click();
await p.waitForTimeout(10000);
const { data } = await db.from("announcements").select("id,title").ilike("content", `%${MARK}%`);
console.log("announcements inserted:", (data??[]).length);
const fb = await p.locator("div.rounded-xl.border").filter({ hasText: /Đã|Không|lỗi|thử lại/ }).allInnerTexts().catch(() => []);
console.log("feedback texts:", JSON.stringify(fb.slice(0,3)));
await browser.close();
