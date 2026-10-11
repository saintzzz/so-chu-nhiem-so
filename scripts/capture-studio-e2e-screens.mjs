// Chup screenshot luong Studio TVC360 E2E tren prod -> docs/demo/e2e-assets/
// Flow: GV soan DC-01 (YCCD -> AI sinh -> luu -> gui duyet) -> to truong duyet
// -> BGH xuat ban -> thu vien/ngan hang/export PDF. Material QA duoc xoa cuoi script.
// Chay: node scripts/capture-studio-e2e-screens.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i).trim()] ||= l.slice(i + 1).trim();
}

const BASE = "https://sochunhiem.vieschool.com";
const OUT = "docs/demo/e2e-assets";
const TAG = `QA-S${Date.now().toString(36).toUpperCase().slice(-5)}`;
mkdirSync(OUT, { recursive: true });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

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

async function gotoPage(p, url) {
  for (let i = 0; i < 3; i++) {
    await p.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    const err = await p.locator("text=Không tải được dữ liệu").count();
    if (!err) return;
    console.log(`  retry ${url} (error state)`);
    await p.waitForTimeout(4000);
  }
}

const shot = (p, file) => p.screenshot({ path: `${OUT}/${file}` });

const authorId = (
  await sb.from("profiles").select("id").eq("email", "anhptl@nd.scn").single()
).data.id;
let matId = null;

try {
  // ---- T1: GV soan hoc lieu ----
  const { ctx: gCtx, p: g } = await login("anhptl@nd.scn");

  await gotoPage(g, `${BASE}/studio`);
  await shot(g, "s1-studio-hub.png");
  console.log("s1 hub");

  await gotoPage(g, `${BASE}/studio/DC-01`);
  const form = g.locator("div.rounded-xl.border.bg-card.p-5").first();
  const sel = form.locator("select");
  await sel.nth(0).selectOption("toan");
  await g.waitForTimeout(1200);
  await sel.nth(1).selectOption("6");
  await g.waitForTimeout(2000);
  await form.locator("input[type=checkbox]").first().check();
  await shot(g, "s2-dc01-form-yccd.png");
  console.log("s2 DC-01 form + YCCD");

  // Flow luu -> duyet -> xuat ban dung DC-02 (rule-based, on dinh ~6s)
  await gotoPage(g, `${BASE}/studio/DC-02`);
  const form2 = g.locator("div.rounded-xl.border.bg-card.p-5").first();
  const sel2 = form2.locator("select");
  await sel2.nth(0).selectOption("toan");
  await g.waitForTimeout(1200);
  await sel2.nth(1).selectOption("6");
  await g.waitForTimeout(2000);
  await form2.locator("input[type=checkbox]").first().check();
  await shot(g, "s3-dc02-form.png");
  await form2.getByRole("button", { name: /Sinh học liệu/ }).click();
  await g.getByRole("button", { name: "Lưu học liệu" }).waitFor({ timeout: 120000 });
  await g.waitForTimeout(1500);
  await shot(g, "s4-dc02-generated.png");
  console.log("s3/s4 DC-02 generated ma tran");

  await g.getByRole("button", { name: "Lưu học liệu" }).click();
  await g.waitForSelector("text=Đã lưu", { timeout: 30000 });
  await g.waitForTimeout(800);
  await shot(g, "s5-saved.png");
  // material DC-02 + matrix tao cung luc - tag ca hai de cleanup
  matId = (
    await sb.from("tvc_materials")
      .select("id").eq("author_id", authorId).eq("tool_code", "DC-02")
      .order("created_at", { ascending: false }).limit(1).single()
  ).data.id;
  const mxId = (
    await sb.from("tvc_matrices")
      .select("id").eq("owner_id", authorId)
      .order("created_at", { ascending: false }).limit(1).single()
  ).data?.id;
  await sb.from("tvc_materials").update({ title: `${TAG}-matran` }).eq("id", matId);
  if (mxId) await sb.from("tvc_matrices").update({ title: `${TAG}-matrix` }).eq("id", mxId);
  console.log("saved material", matId, "matrix", mxId);

  await gotoPage(g, `${BASE}/studio/library/${matId}`);
  await shot(g, "s6-material-personal.png");
  console.log("s6 material detail (personal)");

  await g.getByRole("button", { name: "Gửi duyệt" }).click();
  await g.waitForTimeout(2500);
  await shot(g, "s7-submitted.png");
  console.log("s7 in_review");
  await gCtx.close();

  // ---- T2: to truong duyet ----
  const { ctx: tCtx, p: t } = await login("linhnm@nd.scn");
  await gotoPage(t, `${BASE}/studio/library/${matId}`);
  await shot(t, "s8-totruong-review.png");
  await t.getByRole("button", { name: /Tổ duyệt/ }).click();
  await t.waitForTimeout(2500);
  await shot(t, "s9-totruong-ok.png");
  console.log("s8/s9 to truong duyet");
  await tCtx.close();

  // ---- T3: BGH xuat ban ----
  const { ctx: bCtx, p: b } = await login("hainv@nd.scn");
  await gotoPage(b, `${BASE}/studio/library/${matId}`);
  await shot(b, "s10-bgh-publish.png");
  await b.getByRole("button", { name: /BGH duyệt/ }).click();
  await b.waitForTimeout(3000);
  await shot(b, "s11-published.png");
  const st = (
    await sb.from("tvc_materials").select("status").eq("id", matId).single()
  ).data?.status;
  console.log("s10/s11 BGH publish, status =", st);
  await bCtx.close();

  // ---- T4: ngan hang + thu vien + print ----
  const { ctx: g2Ctx, p: g2 } = await login("anhptl@nd.scn");
  await gotoPage(g2, `${BASE}/studio/questions`);
  await g2.waitForTimeout(3000);
  await shot(g2, "s12-questions-bank.png");
  await gotoPage(g2, `${BASE}/studio/library`);
  await g2.waitForTimeout(1500);
  await shot(g2, "s13-library.png");
  await gotoPage(g2, `${BASE}/studio-print/${matId}`);
  await g2.waitForTimeout(2000);
  await shot(g2, "s14-print-pdf.png");
  console.log("s12-s14 bank + library + print");
  await g2Ctx.close();
} finally {
  if (matId) {
    await sb.from("tvc_reviews").delete().eq("material_id", matId);
    await sb.from("tvc_materials").delete().eq("id", matId);
    console.log("cleanup material", matId);
  }
  const { data: mxs } = await sb.from("tvc_matrices").select("id").like("title", `${TAG}%`);
  if (mxs?.length) await sb.from("tvc_matrices").delete().in("id", mxs.map((x) => x.id));
  await browser.close();
}
