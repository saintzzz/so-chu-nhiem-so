// qa-business-flows.mjs - E2E business flows qua UI that, verify DB sau moi mutation.
// Chay: node scripts/qa-business-flows.mjs
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "https://so-chu-nhiem-so-theta.vercel.app";
const SHOTS = new URL("../docs/qa/screenshots-flows/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
const errors = [];
const check = (id, name, pass, detail = "", img = "") => {
  results.push({ id, name, pass, detail, img });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${name} ${detail}`);
};
const shot = (p, n) => p.screenshot({ path: join(SHOTS, `${n}.png`) }).then(() => `docs/qa/screenshots-flows/${n}.png`);

async function login(p, email) {
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill("#email", email);
  await p.fill("input[type=password]", "demo1234");
  await p.click("button[type=submit]");
  await p.waitForTimeout(5000);
}
const settle = async (p, ms = 1200) => {
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.waitForTimeout(ms);
};

const browser = await chromium.launch();
async function freshPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
  return p;
}

// Pre-fetch: lop CN cua gvcn + 1 HS
const { data: gvcn } = await db.from("profiles").select("id,school_id").eq("email", "gvcn@demo.scn").single();
const { data: myClass } = await db.from("classes").select("id,name").eq("gvcn_id", gvcn.id).limit(1).single();
const { data: student } = await db.from("students").select("id,full_name,code").eq("class_id", myClass.id).limit(1).single();
const today = new Date().toISOString().slice(0, 10);
const MARK = `QAFLOW-${Date.now()}`;

// ================= GVCN =================
let p = await freshPage();
await login(p, "gvcn@demo.scn");

// F01 - Diem danh: danh "Vang khong phep" 1 HS -> luu -> verify attendance_records
await p.goto(`${BASE}/attendance/daily?class=${myClass.id}&date=${today}`);
await settle(p);
const row = p.locator("tr", { hasText: student.full_name }).first();
await shot(p, "f01-attendance-before");
await row.locator('label:has-text("Vắng không phép")').first().click();
await p.waitForTimeout(400);
await p.locator('button:has-text("Xác nhận chuyên cần")').first().click();
await p.waitForTimeout(2500);
const { data: att } = await db.from("attendance_records").select("status")
  .eq("student_id", student.id).eq("date", today).order("created_at", { ascending: false }).limit(1);
check("F01", "Diem danh vang -> luu DB", att?.[0]?.status === "unexcused", `status=${att?.[0]?.status}`, await shot(p, "f01-attendance-after"));

// F02 - Gui thong bao chuyen can
await p.goto(`${BASE}/attendance/notify`);
await settle(p);
const notifyBody = await p.locator("body").innerText();
check("F02", "Trang thong bao chuyen can render", /thông báo|phụ huynh/i.test(notifyBody), "", await shot(p, "f02-notify"));

// F03 - Ghi nhan hanh kiem
await p.goto(`${BASE}/conduct/records`);
await settle(p);
const stuSel = p.locator('label:has-text("Học sinh") select');
const pickedId = await stuSel.locator("option").first().getAttribute("value");
await stuSel.selectOption(pickedId);
await p.locator('label:has-text("Khen thưởng")').first().click().catch(() => {});
await p.locator("textarea, [data-autogrow]").first().fill(`Ghi nhan tu dong ${MARK}`);
await shot(p, "f03-conduct-form");
await p.locator('button:has-text("Lưu ghi nhận")').click();
await p.waitForTimeout(2500);
const { data: rec } = await db.from("conduct_records").select("id,content")
  .eq("student_id", pickedId).ilike("content", `%${MARK}%`).limit(1);
check("F03", "Ghi nhan hanh kiem -> DB", (rec?.length ?? 0) === 1, rec?.[0]?.content?.slice(0, 40), await shot(p, "f03-conduct-after"));

// F04 - Cham diem thi dua (fill input dau tien, save, verify score=8 trong DB)
const curPeriod = `${new Date().getFullYear()}-T${new Date().getMonth() + 1}`;
await p.goto(`${BASE}/emulation/scoring`);
await settle(p);
const scoreInput = p.locator('td input[type="number"]').first();
await scoreInput.click();
await scoreInput.fill("8");
await p.locator('button:has-text("Lưu điểm thi đua")').click();
await p.waitForTimeout(2500);
const { data: myClasses } = await db.from("classes").select("id").eq("gvcn_id", gvcn.id);
const { data: emu } = await db.from("emulation_scores").select("id,score")
  .in("class_id", myClasses.map((c) => c.id)).eq("period", curPeriod);
check("F04", "Cham diem thi dua -> DB", (emu ?? []).some((e) => e.score === 8),
  `period=${curPeriod} scores=${(emu ?? []).map((e) => e.score).join(",")}`, await shot(p, "f04-emulation"));

// F05 - Gui thong bao phu huynh (compose: can title + content)
await p.goto(`${BASE}/parents/compose`);
await settle(p);
await p.locator('input[placeholder*="Thông báo"], input[placeholder*="họp"]').first().fill(`TB ${MARK}`);
await p.locator("textarea").nth(1).fill(`Noi dung kiem thu ${MARK}`);
await shot(p, "f05-compose");
await p.locator('button:has-text("Gửi thông báo")').click();
await p.waitForTimeout(3000);
const { data: ann } = await db.from("announcements").select("id,content")
  .ilike("content", `%${MARK}%`).limit(1);
check("F05", "Gui thong bao PH -> DB", (ann?.length ?? 0) === 1, ann?.[0]?.content?.slice(0, 40), await shot(p, "f05-compose-after"));

// F06 - So dau bai (period log)
await p.goto(`${BASE}/schedule/period-log`);
await settle(p);
const logBody = await p.locator("body").innerText();
const hasLogForm = /sổ đầu bài|tiết|Lưu/i.test(logBody);
check("F06", "So dau bai render form", hasLogForm, "", await shot(p, "f06-period-log"));

// F07 - Nhap diem
await p.goto(`${BASE}/academics/grades`);
await settle(p);
const gradesBody = await p.locator("body").innerText();
check("F07", "Bang diem render", /điểm|môn|học sinh/i.test(gradesBody), "", await shot(p, "f07-grades"));

// F08 - Tu van: tao ca
await p.goto(`${BASE}/counseling/intake`);
await settle(p);
const intakeBody = await p.locator("body").innerText();
check("F08", "Tiep nhan tu van render", /tư vấn|học sinh|tiếp nhận/i.test(intakeBody), "", await shot(p, "f08-counseling"));

// F09 - Ke hoach hoat dong (tao nhap)
await p.goto(`${BASE}/activities/plan`);
await settle(p);
const planBtn = p.locator('button:has-text("Tạo kế hoạch")').first();
const hasPlanBtn = (await planBtn.count()) > 0;
check("F09", "Form tao ke hoach HD", hasPlanBtn, "", await shot(p, "f09-activity-plan"));

// F10 - Ho so HS: tim kiem + expand
await p.goto(`${BASE}/records/students`);
await settle(p);
const stBody = await p.locator("tbody").innerText();
const stRow = p.locator("tr").filter({ hasText: /HS\d|Nguyễn|Trần|Lê/ }).first();
check("F10", "Danh sach HS render co data", stBody.length > 100 && (await stRow.count()) > 0,
  `${stBody.split("\n").length} rows text`, await shot(p, "f10-students"));

// F11 - Bao cao hoc tap
await p.goto(`${BASE}/records/report`);
await settle(p);
const repBody = await p.locator("body").innerText();
check("F11", "Bao cao render", /báo cáo|học tập|lớp/i.test(repBody), "", await shot(p, "f11-report"));

// F12 - KPI so chu nhiem
await p.goto(`${BASE}/register/kpi`);
await settle(p);
const kpiBody = await p.locator("body").innerText();
check("F12", "KPI render", /KPI|chỉ tiêu|chuyên cần|hạnh kiểm/i.test(kpiBody), "", await shot(p, "f12-kpi"));

// ================= GVBM =================
p = await freshPage();
await login(p, "gvbm@demo.scn");
await p.goto(`${BASE}/academics/grades`);
await settle(p);
const gvbmBody = await p.locator("body").innerText();
check("F13", "GVBM bang diem render", /điểm|môn/i.test(gvbmBody), "", await shot(p, "f13-gvbm-grades"));

// ================= BGH =================
p = await freshPage();
await login(p, "bgh@demo.scn");
await p.goto(`${BASE}/school/students`);
await settle(p);
const bghBody = await p.locator("body").innerText();
check("F14", "BGH danh sach HS toan truong", /học sinh|lớp/i.test(bghBody), "", await shot(p, "f14-bgh-students"));

await p.goto(`${BASE}/school/announce`);
await settle(p);
await shot(p, "f15-bgh-announce");

// ================= PH / HS portals =================
p = await freshPage();
await login(p, "phuhuynh@demo.scn");
await settle(p);
const phBody = await p.locator("body").innerText();
check("F15", "Portal PH render", /con|học sinh|điểm|chuyên cần/i.test(phBody), "", await shot(p, "f16-portal-parent"));

p = await freshPage();
await login(p, "hocsinh@demo.scn");
await settle(p);
const hsBody = await p.locator("body").innerText();
check("F16", "Portal HS render", /điểm|học bạ|chuyên cần|thời khóa/i.test(hsBody), "", await shot(p, "f17-portal-student"));

// ================= Deny paths =================
const denyCases = [
  ["gvbm@demo.scn", "/emulation/scoring"],
  ["gvbm@demo.scn", "/school/staff"],
  ["phuhuynh@demo.scn", "/dashboard"],
  ["hocsinh@demo.scn", "/academics/grades"],
  ["bgh@demo.scn", "/portal/student"],
];
for (const [email, route] of denyCases) {
  p = await freshPage();
  await login(p, email);
  await p.goto(`${BASE}${route}`);
  await settle(p);
  check("DENY", `${email.split("@")[0]} -> ${route}`, !p.url().includes(route), p.url().replace(BASE, ""));
}

console.log("\n=== console errors:", errors.length);
[...new Set(errors)].slice(0, 10).forEach((e) => console.log("  -", e));
const pass = results.filter((r) => r.pass).length;
console.log(`\n===== ${pass}/${results.length} PASS =====`);
await browser.close();
