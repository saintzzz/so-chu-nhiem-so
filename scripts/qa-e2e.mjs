// Full-system QA for Sổ Chủ Nhiệm Số - production
// Usage: node /tmp/qa-full.mjs  (run from repo root, reads .env.local for service key)
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const BASE = "https://so-chu-nhiem-so-theta.vercel.app";
const env = readFileSync(".env.local", "utf8");
const SB_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SB_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const sb = createClient(SB_URL, SB_KEY);

const results = [];
let cur = "";
function section(name) { cur = name; console.log(`\n===== ${name} =====`); }
function check(name, ok, detail = "") {
  results.push({ section: cur, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  | " + detail : ""}`);
}

const ROLES = {
  gvcn: "gvcn@demo.scn",
  gvbm: "gvbm@demo.scn",
  totruong: "totruong@demo.scn",
  bgh: "bgh@demo.scn",
  pht: "pht@demo.scn",
  ketoan: "ketoan@demo.scn",
  phuhuynh: "phuhuynh@demo.scn",
  hocsinh: "hocsinh@demo.scn",
  sogd: "sogd@demo.scn",
  phonggd: "phonggd@demo.scn",
  ubnd: "ubnd@demo.scn",
};

const browser = await chromium.launch();
const contexts = {};

async function login(role) {
  if (contexts[role]) return contexts[role];
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") page.consoleErrors.push(m.text()); });
  page.pageErrors = [];
  page.on("pageerror", (e) => page.pageErrors.push(String(e)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", ROLES[role]);
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });
  contexts[role] = { ctx, page };
  return contexts[role];
}

async function visit(role, path) {
  const { page } = await login(role);
  const t0 = Date.now();
  page.consoleErrors.length = 0;
  page.pageErrors.length = 0;
  // TTFB: streamed Suspense boundaries (AI cards) keep the document open -
  // "commit" resolves when response headers arrive, the fair server metric.
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: "commit" }).catch(() => null);
  const ms = Date.now() - t0;
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  // wait for client-side redirects: poll until URL stable 2 polls in a row
  let last = page.url();
  let stable = 0;
  for (let i = 0; i < 30 && stable < 2; i++) {
    await page.waitForTimeout(300);
    if (page.url() === last) stable++;
    else { stable = 0; last = page.url(); }
  }
  const finalUrl = page.url();
  const redirected = !finalUrl.includes(path.split("?")[0]);
  let bodyText = "";
  try {
    bodyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  } catch { bodyText = ""; }
  const errText = /đã xảy ra|error|something went wrong/i.test(bodyText) && !/error/i.test(path);
  return { ms, status: resp?.status(), redirected, finalUrl, errText, consoleErrs: [...page.consoleErrors], pageErrs: [...page.pageErrors], bodyText };
}

// ---------- A. route smoke ----------
const SMOKE = {
  gvcn: ["/dashboard","/register/roster","/register/seating","/records/students","/conduct/records","/conduct/evaluation","/conduct/student-chat","/attendance/daily","/attendance/leaves","/attendance/notify","/attendance/daily-report","/attendance/tracking","/attendance/history","/schedule/timetable","/schedule/period-log","/academics/grades","/academics/lesson-plans","/academics/exams","/academics/analysis","/academics/support","/academics/plans","/academics/parent-chat","/academics/teacher-chat","/parents/portal","/parents/compose","/parents/inbox","/parents/cmhs","/parents/appointments","/counseling/intake","/counseling/assessment","/counseling/referral","/safety/report","/safety/followup","/safety/archive","/records/intake","/records/upload","/register/year-events","/register/plans","/register/kpi","/register/signoff","/register/lock-records","/register/export","/register/seating-history","/register/audit","/records/report","/register/suggestions","/emulation/ranking","/emulation/scoring","/activities/plan","/activities/announce","/activities/attendance","/profile"],
  gvbm: ["/academics/grades","/schedule/timetable","/schedule/period-log","/academics/lesson-plans","/academics/teacher-chat","/profile"],
  totruong: ["/team/home","/team/teachers","/team/lesson-plans","/team/meetings","/team/review","/schedule/timetable","/schedule/period-log","/academics/grades","/profile"],
  bgh: ["/school/dashboard","/school/approvals","/school/daily-reports","/school/substitutes","/school/radar","/school/ai-assistant","/school/campuses","/school/staff","/school/nq37","/school/assignments","/academics/exams","/parents/cmhs","/school/users","/school/students","/school/strategy","/school/equipment","/school/announce","/schedule/manage","/safety/bgh","/register/signoff","/register/lock-records","/schedule/timetable","/school/journals","/school/exam-analytics","/emulation/ranking","/register/audit","/profile"],
  pht: ["/school/dashboard","/school/approvals","/school/daily-reports","/school/substitutes","/school/radar","/school/ai-assistant","/school/staff","/school/nq37","/school/students","/school/strategy","/school/equipment","/school/announce","/schedule/manage","/safety/bgh","/schedule/timetable","/school/journals","/school/exam-analytics","/profile"],
  ketoan: ["/school/equipment","/profile"],
  phuhuynh: ["/portal/parent"],
  hocsinh: ["/portal/student","/portal/student/hoc-ba"],
  sogd: ["/dept/dashboard","/dept/wards","/dept/reports","/dept/facilities","/dept/data","/dept/users"],
  phonggd: ["/dept/dashboard","/dept/wards","/dept/reports","/dept/facilities"],
  ubnd: ["/dept/dashboard","/dept/wards","/dept/reports","/dept/facilities"],
};

section("A. Route smoke (load + perf + console)");
const perf = [];
for (const [role, paths] of Object.entries(SMOKE)) {
  for (const p of paths) {
    const r = await visit(role, p);
    const label = `${role} ${p}`;
    if (r.redirected) { check(label, false, `unexpected redirect -> ${r.finalUrl}`); continue; }
    check(label, r.status === 200 && !r.errText, `status=${r.status} ${r.ms}ms${r.errText ? " ERROR-TEXT" : ""}`);
    if (r.ms > 3000) check(`${label} perf`, false, `${r.ms}ms > 3s`);
    perf.push({ label, ms: r.ms });
    if (r.consoleErrs.length || r.pageErrs.length)
      check(`${label} console`, false, [...r.consoleErrs, ...r.pageErrs].slice(0, 2).join(" | ").slice(0, 200));
  }
}

// ---------- B. deny paths ----------
section("B. RBAC deny paths");
const DENY = [
  ["gvbm", "/register/audit"], ["gvbm", "/conduct/student-chat"], ["gvbm", "/school/dashboard"],
  ["hocsinh", "/dashboard"], ["hocsinh", "/register/audit"], ["phuhuynh", "/school/users"],
  ["gvcn", "/school/users"], ["gvcn", "/dept/dashboard"], ["pht", "/register/roster"],
  ["totruong", "/academics/lesson-plans"], ["hocsinh", "/academics/support"],
  ["phonggd", "/dept/data"], ["phonggd", "/dept/users"],
  ["ubnd", "/dept/data"], ["ubnd", "/dept/users"],
  ["ketoan", "/register/roster"], ["ubnd", "/school/dashboard"], ["totruong", "/register/audit"],
];
for (const [role, path] of DENY) {
  const { page } = await login(role);
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }).catch(() => null);
  let changed = !page.url().includes(path.split("?")[0]);
  if (!changed) {
    await page
      .waitForURL((u) => !u.pathname.includes(path.split("?")[0]), { timeout: 10000 })
      .then(() => { changed = true; })
      .catch(() => {});
  }
  check(`${role} denied ${path}`, changed, `final=${new URL(page.url()).pathname}`);
}

// ---------- C. cross-module data linkage ----------
section("C. Cross-module data linkage (DB vs UI)");

// C1: roster count == dashboard count == DB
{
  const { data: cls } = await sb.from("classes").select("id,name,gvcn_id").eq("name", "6A3").limit(1);
  const classId = cls[0].id;
  const { count } = await sb.from("students").select("*", { count: "exact", head: true }).eq("class_id", classId).eq("status", "active");
  const r = await visit("gvcn", `/register/roster?class=${classId}`);
  const m = r.bodyText.match(/(\d+) học sinh/);
  check("roster count = DB", Number(m?.[1]) === count, `ui=${m?.[1]} db=${count}`);
}

// C2: timetable weekday -> period-log entries same day
{
  const { data: cls } = await sb.from("classes").select("id").eq("name", "6A3").limit(1);
  const date = "2026-09-18"; // Friday -> weekday 6
  const wd = new Date(date + "T00:00:00").getDay() + 1;
  const { data: tt } = await sb.from("timetable_entries").select("id").eq("class_id", cls[0].id).eq("weekday", wd);
  const r = await visit("gvcn", `/schedule/period-log?date=${date}&class=${cls[0].id}`);
  const nTiets = (r.bodyText.match(/Tiết \d+/g) ?? []).length;
  check("period-log entries = TKB count", nTiets === tt.length, `ui=${nTiets} tkb=${tt.length}`);
}

// C3: conduct_records sum == students.positive_points for a sample student
{
  // positive_points = tổng điểm DƯƠNG từ conduct_records (vi phạm không trừ điểm tuyên dương)
  // aggregate client-side over all records (paginated)
  const posSum = {};
  let off = 0;
  for (;;) {
    const { data: cr } = await sb.from("conduct_records").select("student_id,points").range(off, off + 999);
    if (!cr?.length) break;
    for (const c of cr) if (c.points > 0) posSum[c.student_id] = (posSum[c.student_id] ?? 0) + c.points;
    if (cr.length < 1000) break;
    off += 1000;
  }
  const sids = Object.keys(posSum);
  const { data: studs } = await sb.from("students").select("id,positive_points").in("id", sids);
  const bad = (studs ?? []).filter((st) => (st.positive_points ?? 0) !== posSum[st.id]);
  check("positive_points = sum(positive conduct)", bad.length === 0, `${sids.length} HS có điểm dương, ${bad.length} lệch`);
}

// C4: school-wide announcement visible on student + parent portals
{
  const { data: ann } = await sb.from("announcements").select("id,title").is("class_id", null).not("school_id", "is", null).order("created_at", { ascending: false }).limit(1);
  if (ann?.length) {
    const rs = await visit("hocsinh", "/portal/student");
    const rp = await visit("phuhuynh", "/portal/parent");
    check("announcement on student portal", rs.bodyText.includes(ann[0].title.slice(0, 30)), ann[0].title.slice(0, 40));
    check("announcement on parent portal", rp.bodyText.includes(ann[0].title.slice(0, 30)), ann[0].title.slice(0, 40));
  } else check("announcement portals", false, "no school-wide announcement in DB");
}

// C5: parent-chat count = parent_students linked parents of the class
{
  const { data: cls } = await sb.from("classes").select("id").eq("name", "6A3").limit(1);
  const { data: studs } = await sb.from("students").select("id").eq("class_id", cls[0].id).eq("status", "active");
  const { data: ps } = await sb.from("parent_students").select("parent_id").in("student_id", studs.map((s) => s.id));
  const uniqueParents = new Set((ps ?? []).map((p) => p.parent_id)).size;
  const { page: pc } = await login("gvcn");
  await pc.goto(`${BASE}/academics/parent-chat?class=${cls[0].id}`, { waitUntil: "domcontentloaded" });
  await pc.waitForTimeout(800);
  const uiCount = await pc.evaluate(() => {
    const aside = [...document.querySelectorAll("aside")].pop();
    return aside ? aside.querySelectorAll("li").length : -1;
  });
  check("parent-chat count = DB links", uiCount === uniqueParents, `ui=${uiCount} db=${uniqueParents}`);
}

// C6: period-log absence -> attendance_records synced
{
  const { data: pa } = await sb.from("period_absences").select("student_id,status,period_log_id").limit(20);
  let synced = 0, checked = 0;
  for (const a of pa ?? []) {
    const { data: log } = await sb.from("period_logs").select("date").eq("id", a.period_log_id).limit(1);
    if (!log?.length) continue;
    checked++;
    const { data: ar } = await sb.from("attendance_records").select("status,source").eq("student_id", a.student_id).eq("date", log[0].date);
    if (ar?.some((r) => r.source === "period_log" || r.status === a.status)) synced++;
  }
  check("period_absences -> attendance sync", checked > 0 && synced === checked, `${synced}/${checked} synced`);
}

// C7: student portal hoc-ba grades exist in DB
{
  const r = await visit("hocsinh", "/portal/student/hoc-ba");
  const hasGrades = /HK1|HK2|ĐTB|Đạt|Chưa đạt/i.test(r.bodyText);
  const { data: g } = await sb.from("grades").select("id").limit(1);
  check("hoc-ba renders grade data", hasGrades && (g?.length ?? 0) > 0, "portal shows TT22 structure");
}

// ---------- D. real mutations via UI ----------
section("D. Mutations via UI + DB verify");

// D1: daily attendance mutation via UI -> attendance_records
{
  const { page } = await login("gvcn");
  const { data: cls } = await sb.from("classes").select("id").eq("name", "6A3").limit(1);
  const classId = cls[0].id;
  const date = "2026-09-18";
  // pick a student currently "present" in DB
  const { data: pres } = await sb.from("attendance_records").select("student_id,status")
    .eq("date", date).eq("status", "present")
    .in("student_id", (await sb.from("students").select("id").eq("class_id", classId)).data.map(s=>s.id))
    .limit(1);
  const sid = pres?.[0]?.student_id;
  if (!sid) {
    check("attendance mutation", false, "no present student to flip");
  } else {
    await page.goto(`${BASE}/attendance/daily?class=${classId}&date=${date}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    // flip to "late" via the row's radio then save
    const flipped = await page.evaluate((sid) => {
      const radio = document.querySelector(`input[type=radio][name*="${sid}"][value="late"], input[type=radio][data-student="${sid}"][value="late"]`);
      if (radio) { radio.click(); return "radio"; }
      // fallback: find the student row by walking cells
      const cells = [...document.querySelectorAll("td, div")];
      const row = cells.find((c) => c.querySelector(`[data-student-id="${sid}"]`));
      return row ? "row" : null;
    }, sid);
    if (flipped === "radio") {
      const saveBtn = await page.$('button:has-text("Xác nhận chuyên cần"), button:has-text("Lưu")');
      if (saveBtn) { await saveBtn.click(); await page.waitForTimeout(2500); }
      const { data: rec } = await sb.from("attendance_records").select("status").eq("student_id", sid).eq("date", date).limit(1);
      check("attendance present->late via UI", rec?.[0]?.status === "late", `db=${rec?.[0]?.status}`);
      // restore
      await sb.from("attendance_records").update({ status: "present" }).eq("student_id", sid).eq("date", date);
      const { data: rec2 } = await sb.from("attendance_records").select("status").eq("student_id", sid).eq("date", date).limit(1);
      check("attendance restored", rec2?.[0]?.status === "present", "");
    } else {
      check("attendance mutation", false, `no radio found (${flipped})`);
    }
  }
}

// D1b: dashboard card count == attendance_records for same class+date
{
  const { data: cls } = await sb.from("classes").select("id").eq("name", "6A3").limit(1);
  const date = "2026-09-18";
  const { data: studs } = await sb.from("students").select("id").eq("class_id", cls[0].id).eq("status", "active");
  const { data: recs } = await sb.from("attendance_records").select("status").eq("date", date).in("student_id", studs.map(s=>s.id));
  const dbPresent = (recs ?? []).filter(r=>r.status==="present").length;
  const { page: dp } = await login("gvcn");
  await dp.goto(`${BASE}/dashboard?class=${cls[0].id}&date=${date}`, { waitUntil: "domcontentloaded" });
  await dp.waitForTimeout(800);
  const uiVal = await dp.evaluate(() => {
    const els = [...document.querySelectorAll("*")].filter(
      (e) => e.children.length === 0 && /có mặt/i.test(e.textContent ?? ""),
    );
    const card = els.find((e) => e.closest("a,div")?.parentElement);
    if (!card) return null;
    const box = card.closest("a") ?? card.parentElement?.parentElement;
    const ps = box ? [...box.querySelectorAll("p")] : [];
    const val = ps[ps.length - 1]?.textContent?.match(/(\d+)/);
    return val ? Number(val[1]) : null;
  });
  check("dashboard present count = DB", uiVal === dbPresent, `ui=${uiVal} db=${dbPresent}`);
}

// D2: BGH school announcement -> verify DB + portals
{
  const { page } = await login("bgh");
  const title = `QA thông báo ${Date.now() % 100000}`;
  await page.goto(`${BASE}/school/announce`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const titleInput = await page.$('input[placeholder*="Tiêu đề"]');
  const contentArea = await page.$("textarea");
  if (titleInput && contentArea) {
    await titleInput.fill(title);
    await contentArea.fill("Nội dung QA tự động - kiểm tra liên kết portal");
    const btn = await page.$('button:has-text("Gửi"), button:has-text("Đăng"), button[type=submit]');
    if (btn) {
      await page.waitForFunction((b) => !b.disabled, btn, { timeout: 5000 }).catch(() => {});
      await btn.click();
      await page.waitForTimeout(2500);
    }
  }
  const { data: ann } = await sb.from("announcements").select("id,title").eq("title", title).order("created_at", { ascending: false }).limit(1);
  check("BGH announce -> DB", !!ann?.length, title);
  if (ann?.length) {
    const rs = await visit("hocsinh", "/portal/student");
    check("new announcement on student portal", rs.bodyText.includes(title.slice(0, 25)), "");
    // cleanup
    await sb.from("announcements").delete().eq("id", ann[0].id);
  }
}

// ---------- summary ----------
section("SUMMARY");
const fails = results.filter((r) => !r.ok);
console.log(`\nTotal: ${results.length} | PASS: ${results.length - fails.length} | FAIL: ${fails.length}`);
for (const f of fails) console.log(`  FAIL [${f.section}] ${f.name} | ${f.detail}`);
const slow = perf.filter((p) => p.ms > 1500).sort((a, b) => b.ms - a.ms).slice(0, 8);
console.log("\nSlowest routes:", slow.map((s) => `${s.label} ${s.ms}ms`).join(" | ") || "none >1.5s");

await browser.close();
process.exit(fails.length ? 1 : 0);
