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

const STAMP = Date.now() % 1000000;
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
await asUser("annv@nd.scn", async (c) => {
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

await asUser("trangpt@nd.scn", async (c) => {
  for (const [id, t] of [["S07a","grades"],["S07b","counseling_cases"],["S07c","incidents"],["S07d","parents"],["S07e","digest_deliveries"],["S07f","ai_jobs"],["S07g","audit_logs"]]) {
    const n = await count(c, t);
    check(id, `ke_toan ${t} -> 0`, n === 0, String(n));
  }
});

// Cross-school: bgh truong TH-CVA khong thay du lieu truong khac
await asUser("phuongttm@cva.scn", async (c) => {
  const { data: me } = await c.from("profiles").select("school_id").limit(1).maybeSingle();
  const { data: stu } = await c.from("students").select("id, classes!inner(school_id)").limit(500);
  const foreign = (stu ?? []).filter((s) => s.classes?.school_id && s.classes.school_id !== me?.school_id);
  check("S08", "bgh-cva students chi thuoc truong minh", foreign.length === 0, `rows=${(stu ?? []).length} foreign=${foreign.length}`);
  // tvc_mat_published_read: published = shared library cho user co tvc.profiles;
  // boundary dung: chi 'published' xa duoc thay, draft/review khong leak.
  const { data: mats } = await c.from("tvc_materials").select("id,status,school_id");
  const foreignMats = (mats ?? []).filter((m) => m.school_id && m.school_id !== me?.school_id);
  const leakedDrafts = foreignMats.filter((m) => m.status !== "published");
  check("S09", "bgh-cva materials xa: chi 'published', 0 draft/review", leakedDrafts.length === 0,
    `foreign=${foreignMats.length} drafts_leaked=${leakedDrafts.length}`);
});

// gvbm: chi thay student lop minh day (RLS scope) - verify qua so luong < tong
await asUser("minhtv@nd.scn", async (c) => {
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

// S23: tai khoan per-truong (gvcn/gvbm cua tung truong) - tenant isolation thuc te.
// Moi truong co account gvcn/gvbm rieng - gan nhat voi kich ban demo gate
// (truong tu dung account cua minh, khong share).
{
  const { data: schools } = await admin.from("schools").select("id,name");
  const { data: cls } = await admin.from("classes").select("id,school_id").limit(100);
  for (const sch of schools ?? []) {
    const { data: prof } = await admin.from("profiles").select("email")
      .eq("school_id", sch.id).in("role", ["gvcn", "gvbm"]).limit(1);
    const email = (prof ?? [])[0]?.email;
    if (!email) { check(`S23-${sch.name.slice(0, 12)}`, "co account gvcn/gvbm", false, "no account"); continue; }
    await asUser(email, async (c) => {
      const { data: stus } = await c.from("students").select("id,classes!inner(school_id)").limit(500);
      const foreign = (stus ?? []).filter((s) => s.classes?.school_id !== sch.id).length;
      const { count: schoolStu } = await admin.from("students").select("id", { count: "exact", head: true })
        .in("class_id", (cls ?? []).filter((x) => x.school_id === sch.id).map((x) => x.id));
      const hasData = (schoolStu ?? 0) > 0;
      check(`S23-${sch.name.slice(0, 14)}`, `${email} chi thay HS truong minh`,
        foreign === 0 && (!hasData || (stus ?? []).length > 0),
        `rows=${(stus ?? []).length} foreign=${foreign}${hasData ? "" : " (truong chua co HS)"}`);
      // truy cap hoc sinh lop truong khac -> 0
      const foreignCls = (cls ?? []).find((x) => x.school_id !== sch.id);
      if (foreignCls) {
        const { data: leak } = await c.from("students").select("id").eq("class_id", foreignCls.id).limit(10);
        check(`S24-${sch.name.slice(0, 14)}`, "query HS lop truong khac -> 0", (leak ?? []).length === 0, `leak=${(leak ?? []).length}`);
      }
    });
  }
}

// ================= EDGE / ABNORMAL (browser) =================
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(`pageerror: ${e.message.slice(0, 120)}`));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  // 4xx tu cac negative test (deny probes) la ket qua mong doi - khong tinh loi
  if (/Failed to load resource.*status of 4\d\d/.test(t)) return;
  jsErrors.push(`console: ${t.slice(0, 120)}`);
});
page.on("requestfailed", (r) => { const err = r.failure()?.errorText ?? ""; if (!err.includes("ERR_ABORTED")) jsErrors.push(`reqfail: ${r.url().slice(0, 70)} ${err}`); });
page.on("response", (r) => { if (r.status() >= 500) jsErrors.push(`5xx: ${r.url().slice(0, 70)}`); });

async function login(email, pw = "demo1234") {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", pw);
  await page.click('button[type="submit"]');
}

// E01: sai mat khau -> loi inline, van o /login
await login("anhptl@nd.scn", "sai-mat-khau");
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
  await login("anhptl@nd.scn");
  await page.waitForTimeout(3000);
  const res = await page.goto(`${BASE}/records/students/00000000-0000-0000-0000-000000000000`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const t = await page.textContent("body");
  check("E05", "student id khong ton tai -> 404/redirect sach", res?.status() !== 500 && !/Internal Server Error/i.test(t), `status=${res?.status()} url=${page.url()}`);
}
// E06: IDOR - roster?class= lop truong khac -> rong, khong thay HS nguoi ta
{
  const { data: me } = await admin.from("profiles").select("school_id").eq("email", "anhptl@nd.scn").single();
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
    const saveBtn = page.locator('button:has-text("Lưu"), button[type=submit]').first();
    const saveDisabled = await saveBtn.isDisabled().catch(() => false);
    if (!saveDisabled) await saveBtn.click().catch(() => {});
    await page.waitForTimeout(2000);
    const t = await page.textContent("body");
    check("E07", "diem=15 + Luu -> inline invalid hoac disabled", saveDisabled || /không hợp lệ|0-10|0–10/i.test(t), `disabled=${saveDisabled}`);
  } else check("E07", "diem=15", false, "PRECONDITION: khong co input number tren grades");
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
    void body;
    check("E08", "XSS payload khong execute (dialog)", !dialog, `dialog=${dialog}`);
    // don data xss vua tao
    await admin.from("announcements").delete().ilike("content", `%onerror=alert%`);
  } else check("E08", "XSS compose", false, "no form");
}
// E09: bgh tao account email loi -> inline error
{
  await ctx.clearCookies();
  await login("hainv@nd.scn");
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
    const shown = await page.waitForSelector("text=Email không hợp lệ", { timeout: 15000 }).then(() => true).catch(() => false);
    check("E09", "email loi -> 'Email không hợp lệ' + khong tao user", shown, "");
    const { data: bad } = await admin.from("profiles").select("id").eq("email", "khong-phai-email").limit(1);
    check("E09b", "user email loi khong ton tai trong DB", (bad ?? []).length === 0, "");
  } else check("E09", "form tao GV", false, "no form");
}
// E10: required-field disable - create school form
{
  await ctx.clearCookies();
  await login("sovqt@demo.scn");
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
  await login("anhptl@nd.scn");
  // doi session set xong (roi /login) roi moi vao dashboard - tranh race cookie
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }).catch(() => {});
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  // dang xuat qua nut that (icon-only, aria-label) - that bai thi FAIL, khong fallback
  const logoutBtn = page.locator('button[aria-label="Đăng xuất"]').first();
  await logoutBtn.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  check("E11a", "nut dang xuat ton tai", (await logoutBtn.count()) > 0, `url=${page.url()}`);
  if ((await logoutBtn.count()) > 0) await logoutBtn.click();
  await page.waitForURL((u) => u.pathname.includes("/login"), { timeout: 15000 }).catch(() => {});
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  check("E11", "sau logout /dashboard -> /login", page.url().includes("/login"), page.url());
}

// ============ API ROLE MATRIX: role sai -> 401/403 ============
{
  // login PH qua browser ctx de co session cookie
  await ctx.clearCookies();
  await login("annv@nd.scn");
  await page.waitForTimeout(3000);
  const apiChecks = [
    ["S14a", "POST", "/api/ai/dept-brief", { weeks: 1 }],
    ["S14b", "POST", "/api/ai/draft-message", { purpose: "x" }],
    // DC-01 = tool code that - 404 chi khi code khong ton tai; PH phai an 401/403
    ["S14c", "POST", "/api/studio/tools/DC-01/generate", { subject: "toan", grade: "6", lesson: `DENY-${STAMP}` }],
  ];
  for (const [id, method, path, body] of apiChecks) {
    const r = await ctx.request.fetch(`${BASE}${path}`, {
      method, data: body, headers: { "content-type": "application/json" },
    }).catch(() => null);
    const st = r?.status();
    check(id, `phu_huynh ${method} ${path} -> 401/403`, !!r && (st === 401 || st === 403), `status=${st}`);
  }
  // hoc_sinh cung bi chan AI + studio routes
  await ctx.clearCookies();
  await login("baong@nd.scn");
  await page.waitForTimeout(3000);
  for (const [id, path] of [["S15a", "/api/ai/dept-brief"], ["S15b", "/api/studio/tools/DC-01/generate"]]) {
    const r = await ctx.request.fetch(`${BASE}${path}`, {
      method: "POST", data: { weeks: 1, subject: "toan", lesson: `DENY-${STAMP}` }, headers: { "content-type": "application/json" },
    }).catch(() => null);
    const st = r?.status();
    check(id, `hoc_sinh POST ${path} -> 401/403`, !!r && (st === 401 || st === 403), `status=${st}`);
  }
  // verify khong co generation nao duoc ghi boi role bi chan
  const { data: denyGens } = await admin.from("tvc_generations").select("id")
    .contains("input", { lesson: `DENY-${STAMP}` });
  check("S15c", "denied generate khong ghi tvc_generations", (denyGens ?? []).length === 0, `rows=${(denyGens ?? []).length}`);
}

// ============ ADMIN ROLE end-to-end ============
{
  const admEmail = `adm.test${Date.now() % 100000}@demo.scn`;
  const { data: created, error: ce } = await admin.auth.admin.createUser({
    email: admEmail, password: "demo1234", email_confirm: true,
  });
  if (ce || !created?.user) {
    check("S16", "tao admin user", false, ce?.message ?? "no user");
  } else {
    await admin.from("profiles").update({ role: "admin", full_name: "Admin Test" }).eq("id", created.user.id);
    await ctx.clearCookies();
    await login(admEmail);
    await page.waitForTimeout(3500);
    const res = await ctx.request.get(`${BASE}/dept/schools`, { maxRedirects: 0 }).catch(() => null);
    const body = res ? await res.text() : "";
    const onPage = res?.ok() || body.includes("Tạo trường");
    check("S16", "admin role -> /dept/schools accessible", !!onPage, `status=${res?.status()}`);
    // admin KHONG vao duoc nghiep vu lop
    const r2 = await ctx.request.get(`${BASE}/register/roster`, { maxRedirects: 0 }).catch(() => null);
    const loc2 = r2?.headers()["location"] ?? "";
    const body2 = r2 ? await r2.text() : "";
    const denied = loc2.includes("/dept") || body2.includes("__next-page-redirect");
    check("S17", "admin -> /register/roster denied", !!denied, `status=${r2?.status()} loc=${loc2.slice(0, 60)}`);
    await admin.auth.admin.deleteUser(created.user.id);
  }
}

// ============ E13: GVBM nhap diem -> DB (exact key correlation) ============
// Replicate page defaults: class=taught[0], subject="Toán"|subjects[0], term=hk1;
// first number input = students[0] (VN-name sort) x txCols[0] (first kind present, else mieng-s1)
{
  await ctx.clearCookies();
  await login("minhtv@nd.scn");
  await page.waitForTimeout(3000);
  const { data: gvbmProf } = await admin.from("profiles").select("id,school_id").eq("email", "minhtv@nd.scn").single();
  const { data: teaching } = await admin.from("timetable_entries").select("class_id,subject_id").eq("teacher_id", gvbmProf.id);
  const { data: subs } = await admin.from("subjects").select("id,name,assessment_method").eq("school_id", gvbmProf.school_id)
    .in("id", [...new Set((teaching ?? []).map((t) => t.subject_id))]).order("name");
  // Pair that te: class+subject phai cung 1 timetable_entry (RLS grades theo phan cong)
  const toanId = (subs ?? []).find((s) => s.name === "Toán")?.id;
  const pair = (teaching ?? []).find((t) => t.subject_id === toanId) ?? (teaching ?? [])[0];
  const classId = pair?.class_id;
  const subject = (subs ?? []).find((s) => s.id === pair?.subject_id);
  const term = "hk1";
  if (!classId || !subject || subject.assessment_method === "comment") {
    check("E13", "GVBM nhap diem", false, `PRECONDITION: class=${!!classId} subject=${subject?.name ?? "none"} method=${subject?.assessment_method ?? ""}`);
  } else {
    const { data: studs } = await admin.from("students").select("id,full_name").eq("class_id", classId);
    const lastTok = (n) => (n ?? "").trim().split(/\s+/).pop();
    const s0 = (studs ?? []).sort((a, b) => lastTok(a.full_name).localeCompare(lastTok(b.full_name), "vi") || a.full_name.localeCompare(b.full_name, "vi"))[0];
    // first tx col: first kind in [mieng,kt15,kt1t,tx] having grades, else "mieng"
    const { data: txg } = await admin.from("grades").select("subtype,seq")
      .eq("subject_id", subject.id).eq("term", term).eq("assessment_type", "ddg_tx")
      .in("student_id", (studs ?? []).map((s) => s.id));
    const KIND_ORDER = ["mieng", "kt15", "kt1t", "tx"];
    const kinds = new Set((txg ?? []).map((g) => KIND_ORDER.includes(g.subtype) ? g.subtype : "tx"));
    const kind = KIND_ORDER.find((k) => kinds.has(k)) ?? "mieng";
    const key = { student_id: s0?.id, subject_id: subject.id, term, assessment_type: "ddg_tx", subtype: kind === "tx" ? "" : kind, seq: 1 };
    const getRow = async () => {
      const { data } = await admin.from("grades").select("id,score,entered_by")
        .eq("student_id", key.student_id).eq("subject_id", key.subject_id).eq("term", key.term)
        .eq("assessment_type", key.assessment_type).eq("subtype", key.subtype).eq("seq", key.seq)
        .maybeSingle();
      return data;
    };
    const before = await getRow();
    // negative control: chon score dam bao khac before -> neu save khong chay thi assert FAIL
    const testScore = before?.score === 4.5 ? "3.5" : "4.5";
    // URL params: ep page render dung pair day that (tranh cap class+subject khong phan cong)
    await page.goto(`${BASE}/academics/grades?class=${classId}&subject=${subject.id}&term=${term}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const gridInput = page.locator('tbody input[type="number"]').first();
    if (s0 && (await gridInput.count()) > 0) {
      await gridInput.fill(testScore);
      const saveBtn = page.locator('button:has-text("Lưu")').first();
      if ((await saveBtn.count()) > 0 && !(await saveBtn.isDisabled())) {
        await saveBtn.click();
        await page.waitForSelector("text=Đã lưu điểm", { timeout: 15000 }).catch(() => null);
        const after = await getRow();
        check("E13", `GVBM nhap ${testScore} -> exact row (student+subject+term+ddg_tx/${key.subtype}#1) = ${testScore}`,
          !!after && after.score === Number(testScore) && after.entered_by === gvbmProf.id,
          `before=${before?.score ?? "none"} after=${after?.score ?? "none"} student=${s0.full_name}`);
      } else check("E13", "GVBM nhap diem", false, "no save btn / disabled");
    } else check("E13", "GVBM nhap diem", false, `PRECONDITION: student=${!!s0} input=${await gridInput.count()}`);
  }
}

// ============ STUDIO happy path: generate -> tvc_generations ============
{
  await ctx.clearCookies();
  await login("minhtv@nd.scn");
  await page.waitForTimeout(3000);
  const { data: gvbmP } = await admin.from("profiles").select("id").eq("email", "minhtv@nd.scn").single();
  const { data: sub } = await admin.from("tvc_subjects").select("code").eq("code", "toan").maybeSingle();
  const { data: std } = await admin.from("tvc_curriculum_standards").select("id").limit(1);
  if (!sub || !(std ?? [])[0]) {
    check("S18", "Studio generate", false, "PRECONDITION: thieu tvc_subjects/standards");
  } else {
    const marker = `TEST-${STAMP}`;
    const r = await ctx.request.fetch(`${BASE}/api/studio/tools/DC-01/generate`, {
      method: "POST",
      data: { subject: "toan", grade: "6", standard_ids: std[0].id, lesson: marker, duration: "1 tiết" },
      headers: { "content-type": "application/json" },
      timeout: 120000,
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    // chi chap nhan doc hoan chinh - pending job khong tinh la generate xong
    check("S18", "gvbm POST DC-01/generate -> 200 + doc", !!r?.ok() && !!j?.doc, `status=${r?.status()} usedFallback=${j?.usedFallback ?? ""} pending=${j?.pending ?? false}`);
    await new Promise((res) => setTimeout(res, 1500));
    // correlate theo owner + marker duy nhat cua request nay
    const { data: gens } = await admin.from("tvc_generations").select("id,user_id,input,output")
      .contains("input", { lesson: marker });
    const mine = (gens ?? []).find((g) => g.user_id === gvbmP?.id);
    check("S19", "tvc_generations row moi: owner=gvbm + lesson=marker", !!mine, `matched=${(gens ?? []).length}`);
    if (mine) {
      const hasOutput = !!mine.output && Object.keys(mine.output).length > 0;
      check("S19b", "generation co output content", hasOutput, "");
      await admin.from("tvc_generations").delete().eq("id", mine.id);
    }
  }
}

// ============ STUDIO export: IDOR + role denial ============
{
  const { data: mats } = await admin.from("tvc_materials").select("id,author_id,status,title").limit(10);
  const mat = (mats ?? [])[0];
  if (!mat) {
    check("S20", "Studio export", false, "PRECONDITION: khong co tvc_materials nao");
  } else {
    // gvbm (staff cung truong) export -> 200 + file non-empty
    await ctx.clearCookies();
    await login("minhtv@nd.scn");
    await page.waitForTimeout(2500);
    const r = await ctx.request.get(`${BASE}/api/studio/materials/${mat.id}/export?fmt=docx`, { timeout: 60000 }).catch(() => null);
    const buf = r?.ok() ? await r.body() : Buffer.alloc(0);
    check("S20", `export docx material "${String(mat.title).slice(0, 30)}"`, !!r?.ok() && buf.length > 1000, `status=${r?.status()} bytes=${buf.length}`);
    // ke_toan KHONG duoc export (khong phai staff studio + neu published thi day la finding)
    await ctx.clearCookies();
    await login("trangpt@nd.scn");
    await page.waitForTimeout(2500);
    const r2 = await ctx.request.get(`${BASE}/api/studio/materials/${mat.id}/export?fmt=docx`, { timeout: 60000 }).catch(() => null);
    check("S21", "ke_toan export material -> 401/403/404", !!r2 && [401, 403, 404].includes(r2.status()), `status=${r2?.status()} (published=${mat.status === "published"})`);
    // phu_huynh export -> 4xx
    await ctx.clearCookies();
    await login("annv@nd.scn");
    await page.waitForTimeout(2500);
    const r3 = await ctx.request.get(`${BASE}/api/studio/materials/${mat.id}/export?fmt=docx`, { timeout: 60000 }).catch(() => null);
    check("S22", "phu_huynh export material -> 401/403/404", !!r3 && [401, 403, 404].includes(r3.status()), `status=${r3?.status()}`);
  }
}

// ================= PERF: timing theo role =================
const perfPages = [
  ["anhptl@nd.scn", "/dashboard"], ["anhptl@nd.scn", "/academics/grades"],
  ["anhptl@nd.scn", "/records/report"], ["hainv@nd.scn", "/school/dashboard"],
  ["hainv@nd.scn", "/school/exam-analytics"], ["hainv@nd.scn", "/school/radar"],
  ["annv@nd.scn", "/portal/parent"], ["baong@nd.scn", "/portal/student"],
  ["sovqt@demo.scn", "/dept/usage"],
];
const perf = [];
for (const [email, route] of perfPages) {
  await ctx.clearCookies();
  await login(email);
  await page.waitForTimeout(2500);
  // Lan 1 = cold start serverless (rieng). Lan 2+ = warm (assert o day).
  // 4 warm runs + min: lambda rotate khien 1 hit van co the roi vao
  // instance moi -> 2 mau khong du de tach cold-noise.
  const tCold0 = Date.now();
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  const coldTtfb = Date.now() - tCold0;
  const runs = [];
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(400);
    const t0 = Date.now();
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    const ttfb = Date.now() - t0;
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    runs.push({ ttfb, total: Date.now() - t0 });
  }
  const ttfb = Math.min(...runs.map((r) => r.ttfb));
  const total = Math.min(...runs.map((r) => r.total));
  perf.push({ email: email.split("@")[0], route, ttfb, total, coldTtfb });
  console.log(`  perf ${email} ${route}: cold=${coldTtfb}ms warm-ttfb=${ttfb}ms warm-total=${total}ms`);
}
const slow = perf.filter((x) => x.total > 8000);
check("P01", `warm load < 8s (${perf.length} trang)`, slow.length === 0, slow.map((s) => `${s.route}=${s.total}ms`).join(",") || `max=${Math.max(...perf.map((p) => p.total))}ms`);
const slowTtfb = perf.filter((x) => x.ttfb > 2000);
check("P02", "warm TTFB < 2s", slowTtfb.length === 0, slowTtfb.map((s) => `${s.route}=${s.ttfb}ms`).join(",") || "ok");
const slowCold = perf.filter((x) => x.coldTtfb > 15000);
check("P03", "cold start < 15s (lambda init)", slowCold.length === 0, slowCold.map((s) => `${s.route}=${s.coldTtfb}ms`).join(",") || `max=${Math.max(...perf.map((p) => p.coldTtfb))}ms`);

check("E12", "khong co pageerror JS trong suite", jsErrors.length === 0, [...new Set(jsErrors)].slice(0, 3).join(" | "));

await browser.close();
const pass = results.filter((r) => r.pass).length;
const fails = results.filter((r) => !r.pass);
console.log(`\n===== ${pass}/${results.length} PASS =====`);
if (fails.length) { console.log("FAILURES:"); fails.forEach((f) => console.log(`  ${f.id} ${f.name} ${f.detail ?? ""}`)); }
process.exit(fails.length ? 1 : 0);
