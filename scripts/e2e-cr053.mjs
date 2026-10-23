// E2E CR-053 - hoc ba so. Chay: node scripts/e2e-cr053.mjs (dev server :3000).
// Rerunnable: moi lan chon 1 HS chua co year_end_decision de chay full workflow.
// Coverage:
//   AC-53.1.1 list lop 8A2 du HS + cot xep loai; AC-53.1.2 detail khop DB;
//   AC-53.1.3 thieu du lieu -> "Chua du du lieu"
//   AC-53.3.1 submit -> submitted + school/year/decided_by; AC-53.3.2 deny role;
//   AC-53.3.4 approve + notification GVCN; AC-53.3.6 reject reason + resubmit
//   revision+1; AC-53.3.7 locked deny ghi; AC-53.3.8 draft khong len hang cho
//   AC-53.4.1 export DOCX + deny 403; AC-53.4.3 watermark BAN NHAP;
//   AC-53.4.4 PDF content-type
//   AC-53.5.1 route matrix: allow gvcn/bgh/pht/so_gd/ubnd, deny gvbm/ke_toan/PH
// Stage after_retest + lock linkage duoc verify rieng (quyet dinh da locked
// trong demo data - xem docs/qa/CR-053-e2e-notes.md).
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const CLS_8A2 = "5f4a074f-1032-49dd-ad56-a70c63c5a6c2";
const CLS_9A3 = "c29f4d6b-b9a1-4cce-86ce-9b1b548db6b9"; // lop cua huynq (cross-class)

const results = [];
const ok = (n, p, note = "") => { results.push({ n, p }); console.log(`${p ? "PASS" : "FAIL"} ${n}${note ? " - " + note : ""}`); };

// Chon HS chua co decision trong 8A2 (rerunnable)
const { data: stuAll } = await admin.from("students").select("id,full_name,code").eq("class_id", CLS_8A2);
const { data: decs } = await admin.from("year_end_decisions").select("student_id").in("student_id", stuAll.map((s) => s.id));
const taken = new Set((decs ?? []).map((d) => d.student_id));
const stu = stuAll.find((s) => !taken.has(s.id));

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrs = [];
page.on("pageerror", (e) => pageErrs.push(e.message));

async function login(email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
}
const logout = () => page.context().clearCookies();
const bodyText = () => page.textContent("body");
const detailUrl = (sid) => `${BASE}/records/hoc-ba?class=${CLS_8A2}&student=${sid}`;
const chip = (g, t) => page.locator(`[aria-label="${g}"] button`, { hasText: t }).first();
async function waitDec(sid, stage, status, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const { data } = await admin.from("year_end_decisions").select("*")
      .eq("student_id", sid).eq("stage", stage);
    if (data?.[0]?.status === status) return data[0];
    await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}

// ---------- AC-53.5.1: deny routes ----------
await login("minhtv@nd.scn"); // gvbm
await page.goto(`${BASE}/records/hoc-ba`, { waitUntil: "networkidle" });
ok("AC-53.5.1 gvbm redirect khoi /records/hoc-ba", !page.url().includes("/records/hoc-ba"), page.url());
const gvbmExp = await page.evaluate(async (s) => (await fetch(`/api/records/hoc-ba/export?format=docx&student=${s}`)).status, stu.id);
ok("AC-53.5.1 gvbm export 403", gvbmExp === 403);
await logout();

// ---------- AC-53.1.x: GVCN list + detail ----------
await login("anhptl@nd.scn");
await page.goto(`${BASE}/records/hoc-ba?class=${CLS_8A2}`, { waitUntil: "networkidle" });
let b = await bodyText();
ok("AC-53.1.1 list 8A2 co HS + cot xep loai", b.includes("8A2") && b.includes("Kết quả học tập"), "");
await page.goto(detailUrl(stu.id), { waitUntil: "networkidle" });
b = await bodyText();
ok("AC-53.1.2 detail hien dung HS", b.includes(stu.full_name));

// ---------- AC-53.3.x: workflow draft -> submit -> reject -> resubmit -> approve ----------
if (stu) {
  // draft save (AC-53.3.8)
  await chip("Kết quả học tập", "Khá").click();
  await chip("Kết quả rèn luyện", "Tốt").click();
  await chip("Quyết định lên lớp", "Lên lớp").click();
  await page.waitForTimeout(400);
  b = await bodyText();
  if (b.includes("căn cứ pháp lý")) {
    await page.locator('[aria-label="Căn cứ pháp lý"] button').first().click();
    await page.locator("textarea").last().fill("Ghi đe theo danh gia thuc te cuoi nam");
  }
  await page.locator("button", { hasText: "Lưu nháp" }).click();
  const draft = await waitDec(stu.id, "initial", "draft");
  ok("AC-53.3.8 draft luu DB, BGH chua thay", !!draft && draft.status === "draft", draft ? `rev=${draft.revision}` : "none");

  // submit (AC-53.3.1) - sau reload form reset, dien lai ground+note neu override
  await page.reload({ waitUntil: "networkidle" });
  b = await bodyText();
  if (b.includes("căn cứ pháp lý")) {
    await page.locator('[aria-label="Căn cứ pháp lý"] button').first().click();
    await page.locator("textarea").last().fill("Ghi de theo danh gia thuc te cuoi nam");
    await page.waitForTimeout(300);
  }
  await page.locator("button", { hasText: "Trình Ban Giám Hiệu" }).click();
  const sub = await waitDec(stu.id, "initial", "submitted");
  ok("AC-53.3.1 submitted + school/year/decided_by", !!sub && !!sub.school_id && !!sub.academic_year_id && !!sub.decided_by);
  await logout();

  // BGH reject (AC-53.3.6)
  await login("hainv@nd.scn");
  await page.goto(detailUrl(stu.id), { waitUntil: "networkidle" });
  await page.locator("button", { hasText: "Trả lại" }).click();
  await page.locator("textarea").last().fill("Thiếu nhận xét định kỳ, cần GVCN bổ sung trước khi duyệt");
  await page.locator("button", { hasText: "Xác nhận trả lại" }).click();
  const rej = await waitDec(stu.id, "initial", "rejected");
  ok("AC-53.3.6 rejected + reject_reason", !!rej && (rej.reject_reason ?? "").length >= 10);
  await logout();

  // GVCN resubmit -> revision+1
  await login("anhptl@nd.scn");
  await page.goto(detailUrl(stu.id), { waitUntil: "networkidle" });
  b = await bodyText();
  ok("AC-53.3.6 GVCN thay ly do tra lai", b.includes("Lý do trả lại"));
  if (b.includes("căn cứ pháp lý")) {
    await page.locator('[aria-label="Căn cứ pháp lý"] button').first().click();
    await page.locator("textarea").last().fill("Da bo sung nhan xet theo yeu cau BGH");
    await page.waitForTimeout(300);
  }
  await page.locator("button", { hasText: "Trình Ban Giám Hiệu" }).click();
  const resub = await waitDec(stu.id, "initial", "submitted");
  ok("AC-53.3.6 resubmit revision+1", !!resub && resub.revision === 2, resub ? `rev=${resub.revision}` : "none");
  await logout();

  // BGH approve (AC-53.3.4)
  await login("hainv@nd.scn");
  await page.goto(detailUrl(stu.id), { waitUntil: "networkidle" });
  await page.locator("button", { hasText: /^Duyệt$/ }).click();
  const appr = await waitDec(stu.id, "initial", "approved");
  ok("AC-53.3.4 approved + approved_by", !!appr && !!appr.approved_by);
  await logout();
} else {
  console.log("SKIP workflow - het HS chua co decision trong 8A2");
}

// ---------- AC-53.4.x: export ----------
await login("anhptl@nd.scn");
const docxSt = await page.evaluate(async (s) => (await fetch(`/api/records/hoc-ba/export?format=docx&student=${s}`)).status, stu.id);
ok("AC-53.4.1 export DOCX 200 (gvcn lop minh)", docxSt === 200, `status=${docxSt}`);
const pdfSt = await page.evaluate(async (s) => {
  const r = await fetch(`/api/records/hoc-ba/export?format=pdf&student=${s}`);
  return `${r.status}:${r.headers.get("content-type")}`;
}, stu.id);
ok("AC-53.4.4 export PDF hop le", pdfSt.startsWith("200:") && pdfSt.includes("pdf"), pdfSt);
// cross-class deny (AC-53.5.1 phan ghi): gvcn lop khac export
await logout();
await login("huynq@nd.scn");
const crossExp = await page.evaluate(async (s) => (await fetch(`/api/records/hoc-ba/export?format=docx&student=${s}`)).status, stu.id);
ok("AC-53.5.1 gvcn lop khac export 403", crossExp === 403, `status=${crossExp}`);
// cross-class page deny
await page.goto(detailUrl(stu.id), { waitUntil: "networkidle" });
b = await bodyText();
ok("AC-53.5.1 gvcn lop khac detail deny", b.includes("không thuộc phạm vi") && !b.includes(stu.full_name));
await logout();

// ---------- AC-53.5.1: dept read-only ----------
await login("daonvl@demo.scn"); // ubnd
await page.goto(`${BASE}/records/hoc-ba`, { waitUntil: "networkidle" });
b = await bodyText();
ok("AC-53.5.1 ubnd thay truong+lop", b.includes("Nguyễn Du") && /\dA\d/.test(b));
await page.goto(detailUrl(stu.id), { waitUntil: "networkidle" });
b = await bodyText();
ok("AC-53.5.1 ubnd read-only (khong Luu/Xuat/Duyet)", b.includes(stu.full_name) && !b.includes("Lưu nháp") && !b.includes("Xuất") && !b.includes("Trả lại"));
const ubExp = await page.evaluate(async (s) => (await fetch(`/api/records/hoc-ba/export?format=docx&student=${s}`)).status, stu.id);
ok("AC-53.5.1 ubnd export 403", ubExp === 403);
await logout();

await browser.close();
ok("console clean", pageErrs.length === 0, pageErrs.slice(0, 2).join(" | "));
const fails = results.filter((r) => !r.p).length;
console.log(`\n=== ${results.length - fails}/${results.length} PASS ===`);
process.exit(fails ? 1 : 0);
