// E2E CR-034 - demo gate 15/10. Run: node scripts/e2e-cr034.mjs
// BASE_URL override cho production. Chay full chain: sogd tao truong -> DB verify ->
// admin login -> tao GV -> DB verify -> GV login -> isolation -> usage -> cleanup.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
const ok = (name, pass, note = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${note ? " - " + note : ""}`);
};
const consoleErrs = [];

const suffix = Date.now() % 100000;
const adminEmail = `hieutruong.demo${suffix}@demo.scn`;
const gvEmail = `gv.demo${suffix}@demo.scn`;
const schoolName = `THPT Demo Gate ${suffix}`;
const schoolCode = `THPT-DG${suffix}`;
let ctx, page;
let schoolId = null, adminUid = null, gvUid = null;

async function login(email, pw) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", pw);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
  // "/" redirect tiep sang role home - doi hop nay xong
  await page.waitForURL((u) => u.pathname !== "/", { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  return page.url();
}
const pathOf = () => new URL(page.url()).pathname;

async function cleanup() {
  // Xoa users + truong test khoi DB (auth.users delete cascade profiles)
  try {
    for (const uid of [adminUid, gvUid]) {
      if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {});
    }
    if (schoolId) {
      const { data: cls } = await admin.from("classes").select("id").eq("school_id", schoolId);
      const cids = (cls ?? []).map((c) => c.id);
      if (cids.length) {
        await admin.from("students").delete().in("class_id", cids);
        await admin.from("classes").delete().in("id", cids);
      }
      await admin.from("schools").delete().eq("id", schoolId);
    }
    console.log("[cleanup] done");
  } catch (e) {
    console.log("[cleanup] error:", e.message);
  }
}

try {
  const browser = await chromium.launch();
  ctx = await browser.newContext();
  page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrs.push(`pageerror: ${e.message.slice(0, 100)}`));
  page.on("console", (m) => { if (m.type() !== "error") return; const t = m.text(); if (/Failed to load resource.*status of 4\d\d/.test(t)) return; consoleErrs.push(t.slice(0, 100)); });
  page.on("requestfailed", (r) => { const err = r.failure()?.errorText ?? ""; if (!err.includes("ERR_ABORTED")) consoleErrs.push(`reqfail ${r.url().slice(0, 70)}`); });
  page.on("response", (r) => { if (r.status() >= 500) consoleErrs.push(`5xx ${r.url().slice(0, 70)}`); });

  // 1. So GD login -> exact home
  await login("sovqt@demo.scn", "demo1234");
  ok("login sogd -> /dept/dashboard", pathOf() === "/dept/dashboard", pathOf());

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
  const createdOk = await page.waitForSelector('text=Đã tạo trường', { timeout: 30000 }).then(() => true).catch(() => false);
  if (!createdOk) {
    const bodyTxt = await page.textContent("body").catch(() => "");
    const isRateLimit = /rate|quá nhiều|thử lại sau|too many/i.test(bodyTxt);
    ok("create school", false, isRateLimit ? "PRECONDITION: auth rate-limited - rerun sau vai phut" : `no success toast: ${bodyTxt.slice(0, 120)}`);
    throw new Error("create school failed");
  }
  ok("create school", true);

  // 4. DB verify: school row + admin profile linkage
  const { data: sch } = await admin.from("schools").select("id,code,level").eq("code", schoolCode).maybeSingle();
  schoolId = sch?.id ?? null;
  ok("DB school row ton tai", !!sch, `id=${schoolId ?? "none"}`);
  const { data: admProf } = await admin.from("profiles").select("id,role,school_id").eq("email", adminEmail).maybeSingle();
  adminUid = admProf?.id ?? null;
  ok("DB admin profile role=bgh + school_id dung",
    admProf?.role === "bgh" && admProf?.school_id === schoolId,
    `role=${admProf?.role} school_match=${admProf?.school_id === schoolId}`);

  // 5. DB verify: seed data thuoc truong moi, khong foreign
  const { data: cls } = await admin.from("classes").select("id").eq("school_id", schoolId ?? "");
  const cids = (cls ?? []).map((c) => c.id);
  const { data: studs } = cids.length
    ? await admin.from("students").select("id,class_id").in("class_id", cids)
    : { data: [] };
  const cidSet = new Set(cids);
  const foreign = (studs ?? []).filter((s) => !cidSet.has(s.class_id));
  ok("seed: classes + students thuoc truong moi", cids.length > 0 && (studs ?? []).length > 0,
    `classes=${cids.length} students=${studs?.length ?? 0}`);
  ok("seed: 0 foreign students", foreign.length === 0, `foreign=${foreign.length}`);

  // 6. New admin login -> exact role home
  await ctx.clearCookies();
  await login(adminEmail, "demo1234");
  ok("login new admin -> /school/dashboard", pathOf() === "/school/dashboard", pathOf());
  await page.goto(`${BASE}/school/users`, { waitUntil: "networkidle" });
  ok("admin sees /school/users", (await page.locator('button:has-text("Thêm giáo viên")').count()) > 0);

  // 7. Admin creates GV -> DB verify
  await page.click('button:has-text("Thêm giáo viên")');
  await page.fill('label:has-text("Họ tên") input', "GV Demo Gate");
  await page.fill('input[type="email"]', gvEmail);
  await page.fill('label:has-text("Mật khẩu") input', "demo1234");
  await page.click('button:has-text("Tạo tài khoản")');
  const gvCreated = await page.waitForSelector('text=Đã tạo tài khoản', { timeout: 30000 }).then(() => true).catch(() => false);
  ok("admin creates GV (success msg)", gvCreated, "");
  const { data: gvProf } = await admin.from("profiles").select("id,role,school_id").eq("email", gvEmail).maybeSingle();
  gvUid = gvProf?.id ?? null;
  ok("DB GV profile role=gvcn + school_id dung",
    gvProf?.role === "gvcn" && gvProf?.school_id === schoolId,
    `role=${gvProf?.role} school_match=${gvProf?.school_id === schoolId}`);

  // 8. New GV login -> exact role home + tenant isolation
  await ctx.clearCookies();
  await login(gvEmail, "demo1234");
  ok("login new GV -> /dashboard", pathOf() === "/dashboard", pathOf());
  await page.goto(`${BASE}/records/students`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  const tgv = await page.textContent("body");
  // isolation: sample HS truong khac, loai tru ten trung voi HS seed cua truong moi
  const { data: ownStu } = cids.length
    ? await admin.from("students").select("full_name").in("class_id", cids)
    : { data: [] };
  const ownNames = new Set((ownStu ?? []).map((s) => s.full_name));
  const { data: foreignStu } = await admin.from("students").select("full_name")
    .not("class_id", "in", `(${cids.join(",") || "00000000-0000-0000-0000-000000000000"})`).limit(30);
  const leaked = (foreignStu ?? []).filter((s) => s.full_name && !ownNames.has(s.full_name) && tgv.includes(s.full_name));
  ok("GV records khong lo HS truong khac", leaked.length === 0, `leaked=${leaked.map((s) => s.full_name).join(",")}`);

  // 9. GV denied /dept/schools -> redirect ve role home
  await page.goto(`${BASE}/dept/schools`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  ok("GV /dept/schools -> redirect /dashboard", pathOf() === "/dashboard" || !(await page.textContent("body")).includes("Tạo trường mới"), pathOf());

  // 10. Usage dashboard: thay truong moi
  await ctx.clearCookies();
  await login("sovqt@demo.scn", "demo1234");
  await page.goto(`${BASE}/dept/usage`, { waitUntil: "networkidle" });
  const t3 = await page.textContent("body");
  ok("dept/usage render", /hoạt động|đăng nhập|tài khoản/i.test(t3));
  ok("usage shows new school", t3.includes(schoolName));

  // 11. RBAC deny: gvcn cu hits /dept/schools
  await ctx.clearCookies();
  await login("anhptl@nd.scn", "demo1234");
  await page.goto(`${BASE}/dept/schools`, { waitUntil: "networkidle" });
  const t4 = await page.textContent("body");
  ok("gvcn denied /dept/schools", !t4.includes("Tạo trường mới"));

  ok("console/network clean", consoleErrs.length === 0, consoleErrs.slice(0, 3).join(" | "));

  await browser.close();
} catch (e) {
  if (!results.length || results[results.length - 1].pass) ok("suite error", false, String(e.message ?? e).slice(0, 300));
}

await cleanup();

const failed = results.filter((r) => !r.pass).length;
console.log(`\n=== ${results.length - failed}/${results.length} PASS ===`);
process.exit(failed ? 1 : 0);
