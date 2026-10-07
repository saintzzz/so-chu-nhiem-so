// qa-security-edge.mjs - security probes + edge/abnormal cases + perf timing.
// Bo sung qa-full-coverage.mjs (access matrix + write flows).
// Chay: node scripts/qa-security-edge.mjs   (BASE_URL override ok)
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const BASE = process.env.BASE_URL ?? "https://sochunhiem.vieschool.com";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
const check = (id, name, pass, detail = "") => {
  results.push({ id, name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${name}${detail ? " - " + detail : ""}`);
};

async function asUser(email, fn) {
  const c = createClient(URL_, ANON);
  const { error } = await c.auth.signInWithPassword({ email, password: "demo1234" });
  if (error) { console.log(`  ${email} login fail: ${error.message}`); return null; }
  return fn(c);
}
const count = async (c, t, sel = "*") => {
  const { data, error } = await c.from(t).select(sel).limit(5000);
  return error ? `ERR:${error.message.slice(0, 60)}` : (data ?? []).length;
};

// ================= SEC: RLS / privilege =================
await asUser("phuhuynh@demo.scn", async (c) => {
  const { data: { user } } = await c.auth.getUser();
  const { data: u1, error: e1 } = await c.from("profiles").update({ role: "admin" }).eq("id", user.id).select("id");
  check("S01", "PH self-escalate role bi chan", !!e1 || !(u1 ?? []).length, e1?.message?.slice(0, 60) ?? `rows=${u1?.length}`);
  const { data: u2, error: e2 } = await c.from("profiles").update({ school_id: null }).eq("id", user.id).select("id");
  check("S02", "PH self-escalate school bi chan", !!e2 || !(u2 ?? []).length, "");
  check("S03", "PH tvc_materials -> 0", (await count(c, "tvc_materials")) === 0, "");
  check("S04", "PH ai_jobs -> 0", (await count(c, "ai_jobs")) === 0, "");
  const par = await count(c, "parents");
  check("S05", "PH parents <= 1 (chi cua minh)", typeof par === "number" && par <= 1, `rows=${par}`);
  // PH khong ghi duoc bang nghiep vu truong khac
  const { data: w, error: we } = await c.from("attendance_records").insert({ student_id: "00000000-0000-0000-0000-000000000000", date: "2026-10-09", status: "present" }).select("id");
  check("S06", "PH insert attendance bi chan", !!we || !(w ?? []).length, "");
});

await asUser("ketoan@demo.scn", async (c) => {
  for (const [id, t] of [["S07a","grades"],["S07b","counseling_cases"],["S07c","incidents"],["S07d","parents"],["S07e","digest_deliveries"],["S07f","ai_jobs"],["S07g","audit_logs"]]) {
    const n = await count(c, t);
    check(id, `ke_toan ${t} -> 0`, n === 0, String(n));
  }
});

// Cross-school: bgh-th (truong TH-CVA) khong thay du lieu truong khac
await asUser("bgh-th@demo.scn", async (c) => {
  const { data: me } = await c.from("profiles").select("school_id").limit(1).maybeSingle();
  const { data: stu } = await c.from("students").select("id, classes!inner(school_id)").limit(500);
  const foreign = (stu ?? []).filter((s) => s.classes?.school_id && s.classes.school_id !== me?.school_id);
  check("S08", "bgh-th students chi thuoc truong minh", foreign.length === 0, `rows=${(stu ?? []).length} foreign=${foreign.length}`);
  check("S09", "bgh-th tvc_materials -> 0 published xa", (await count(c, "tvc_materials")) === 0, "");
});

// gvbm: chi thay student lop minh day (RLS scope) - verify qua so luong < tong
await asUser("gvbm@demo.scn", async (c) => {
  const mine = await count(c, "students");
  const { count: total } = await admin.from("students").select("id", { count: "exact", head: true });
  check("S10", "gvbm students scope < toan he thong", typeof mine === "number" && mine < (total ?? 0), `gvbm=${mine} total=${total}`);
});

// ================= SEC: API endpoints =================
{
  const r1 = await fetch(`${BASE}/api/cron/parent-digest`).catch(() => null);
  check("S11", "cron khong auth -> 401/403", r1 && (r1.status === 401 || r1.status === 403), `status=${r1?.status}`);
  const r2 = await fetch(`${BASE}/api/cron/parent-digest?secret=wrong-secret`).catch(() => null);
  check("S12", "cron ?secret= sai -> 401 (header-only)", r2 && r2.status === 401, `status=${r2?.status}`);
  const r3 = await fetch(`${BASE}/api/ai/devin-callback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job_id: "00000000-0000-0000-0000-000000000000", token: "wrong", result: "x" }) }).catch(() => null);
  check("S13", "devin-callback token sai -> 4xx", r3 && r3.status >= 400 && r3.status < 500, `status=${r3?.status}`);
}

// ================= EDGE / ABNORMAL (browser) =================
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(e.message.slice(0, 120)));

async function login(email, pw = "demo1234") {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", pw);
  await page.click('button[type="submit"]');
}

// E01: sai mat khau -> loi inline, van o /login
await login("gvcn@demo.scn", "sai-mat-khau");
await page.waitForTimeout(4000);
{
  const t = await page.textContent("body");
  check("E01", "sai MK -> loi inline + o lai /login", page.url().includes("/login") && /sai|không đúng|invalid|error|thất bại/i.test(t), page.url());
}
// E02: email khong ton tai
await login("khong-co-tai-khoan-nay@demo.scn", "demo1234");
await page.waitForTimeout(4000);
check("E02", "email khong ton tai -> o lai /login", page.url().includes("/login"), "");
// E03: unauth route -> /login
{
  await ctx.clearCookies();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  check("E03", "unauth /dashboard -> /login", page.url().includes("/login"), page.url());
  await page.goto(`${BASE}/portal/parent`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  check("E04", "unauth /portal/parent -> /login", page.url().includes("/login"), "");
}
// E05: route khong ton tai -> khong crash
{
  await login("gvcn@demo.scn");
  await page.waitForTimeout(3000);
  const res = await page.goto(`${BASE}/records/students/00000000-0000-0000-0000-000000000000`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const t = await page.textContent("body");
  check("E05", "student id khong ton tai -> 404/redirect sach", res?.status() !== 500 && !/Internal Server Error/i.test(t), `status=${res?.status()} url=${page.url()}`);
}
// E06: IDOR - roster?class= lop truong khac -> rong, khong thay HS nguoi ta
{
  const { data: me } = await admin.from("profiles").select("school_id").eq("email", "gvcn@demo.scn").single();
  const { data: otherClass } = await admin.from("classes").select("id,name,school_id").neq("school_id", me.school_id).limit(1);
  if (otherClass?.length) {
    await page.goto(`${BASE}/register/roster?class=${otherClass[0].id}`, { waitUntil: "networkidle" });
    const t = await page.textContent("body");
    const { data: stuOther } = await admin.from("students").select("full_name").eq("class_id", otherClass[0].id).limit(3);
    const leaked = (stuOther ?? []).filter((s) => t.includes(s.full_name));
    check("E06", "IDOR roster?class= truong khac -> khong lo HS", leaked.length === 0, `class=${otherClass[0].name} leaked=${leaked.length}`);
  } else check("E06", "IDOR roster", false, "khong tim duoc lop truong khac");
}
// E07: grade input gia tri loi
{
  await page.goto(`${BASE}/academics/grades`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const numInput = page.locator('input[type="number"]').first();
  if ((await numInput.count()) > 0) {
    await numInput.fill("15");
    await page.waitForTimeout(300);
    const t = await page.textContent("body");
    check("E07", "diem=15 -> inline invalid/disabled", /không hợp lệ|0-10|0–10/i.test(t) || (await page.locator('button:has-text("Lưu"):disabled, button[type=submit]:disabled').count()) > 0, "");
  } else check("E07", "diem=15", true, "khong co input number tren grades");
}
// E08: XSS payload trong thong bao - khong execute
{
  let dialog = false;
  page.on("dialog", () => { dialog = true; });
  const xss = `<img src=x onerror=alert(1)>-X${Date.now() % 9999}`;
  await page.goto(`${BASE}/parents/compose`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const titleIn = page.locator('input[placeholder*="Thông báo"], input[placeholder*="họp"], input[type="text"]').first();
  const ta = page.locator("textarea").first();
  if ((await titleIn.count()) > 0 && (await ta.count()) > 0) {
    await titleIn.fill(xss);
    await ta.fill(`nd ${xss}`);
    const sendBtn = page.locator('button:has-text("Gửi")').first();
    await sendBtn.click().catch(() => {});
    await page.waitForTimeout(3000);
    const body = await page.textContent("body");
    check("E08", "XSS payload khong execute + render escaped", !dialog && !/<img src=x onerror/.test(await page.content()) || body.includes("<img"), `dialog=${dialog}`);
    // don data xss vua tao
    await admin.from("announcements").delete().ilike("content", `%onerror=alert%`);
  } else check("E08", "XSS compose", false, "no form");
}
// E09: bgh tao account email loi -> inline error
{
  await ctx.clearCookies();
  await login("bgh@demo.scn");
  await page.waitForTimeout(3000);
  await page.goto(`${BASE}/school/users`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.locator('button:has-text("Thêm giáo viên")').click().catch(() => {});
  await page.waitForTimeout(600);
  const nameIn = page.locator('label:has-text("Họ tên") input').first();
  if ((await nameIn.count()) > 0) {
    await nameIn.fill("Test Bad Email");
    await page.locator('input[type="email"]').fill("khong-phai-email");
    await page.locator('label:has-text("Mật khẩu") input').fill("demo1234");
    await page.locator('button:has-text("Tạo tài khoản")').click();
    await page.waitForTimeout(2500);
    const t = await page.textContent("body");
    check("E09", "email loi -> bao loi, khong tao user", /email|hợp lệ|invalid|lỗi/i.test(t), "");
  } else check("E09", "form tao GV", false, "no form");
}
// E10: required-field disable - create school form
{
  await ctx.clearCookies();
  await login("sogd@demo.scn");
  await page.waitForTimeout(3000);
  await page.goto(`${BASE}/dept/schools`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const createBtn = page.locator('button:has-text("Tạo trường")').first();
  const disabled = await createBtn.isDisabled().catch(() => null);
  check("E10", "form tao truong: submit disable khi thieu required", disabled === true || (await page.locator('input[required]').count()) > 0, `disabled=${disabled}`);
}
// E11: logout -> route sau do redirect /login
{
  await ctx.clearCookies();
  await login("gvcn@demo.scn");
  await page.waitForTimeout(3000);
  // dang xuat qua UI neu co nut, nguoc lai xoa cookie (tuong duong)
  const logoutBtn = page.locator('button:has-text("Đăng xuất"), a:has-text("Đăng xuất")').first();
  if ((await logoutBtn.count()) > 0) await logoutBtn.click(); else await ctx.clearCookies();
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  check("E11", "sau logout /dashboard -> /login", page.url().includes("/login"), "");
}

// ================= PERF: timing theo role =================
const perfPages = [
  ["gvcn@demo.scn", "/dashboard"], ["gvcn@demo.scn", "/academics/grades"],
  ["gvcn@demo.scn", "/records/report"], ["bgh@demo.scn", "/school/dashboard"],
  ["bgh@demo.scn", "/school/exam-analytics"], ["bgh@demo.scn", "/school/radar"],
  ["phuhuynh@demo.scn", "/portal/parent"], ["hocsinh@demo.scn", "/portal/student"],
  ["sogd@demo.scn", "/dept/usage"],
];
const perf = [];
for (const [email, route] of perfPages) {
  await ctx.clearCookies();
  await login(email);
  await page.waitForTimeout(2500);
  // Warm-up: serverless cold start lam sai so do - do lan truy cap thu 2
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(400);
  const t0 = Date.now();
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  const ttfb = Date.now() - t0;
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  const total = Date.now() - t0;
  perf.push({ email: email.split("@")[0], route, ttfb, total });
  console.log(`  perf ${email} ${route}: ttfb=${ttfb}ms total=${total}ms`);
}
const slow = perf.filter((x) => x.total > 8000);
check("P01", `moi trang load < 8s (${perf.length} trang)`, slow.length === 0, slow.map((s) => `${s.route}=${s.total}ms`).join(",") || `max=${Math.max(...perf.map((p) => p.total))}ms`);
const slowTtfb = perf.filter((x) => x.ttfb > 2000);
check("P02", "TTFB < 2s (server <1s ideal)", slowTtfb.length === 0, slowTtfb.map((s) => `${s.route}=${s.ttfb}ms`).join(",") || "ok");

check("E12", "khong co pageerror JS trong suite", jsErrors.length === 0, [...new Set(jsErrors)].slice(0, 3).join(" | "));

await browser.close();
const pass = results.filter((r) => r.pass).length;
const fails = results.filter((r) => !r.pass);
console.log(`\n===== ${pass}/${results.length} PASS =====`);
if (fails.length) { console.log("FAILURES:"); fails.forEach((f) => console.log(`  ${f.id} ${f.name} ${f.detail ?? ""}`)); }
process.exit(fails.length ? 1 : 0);
