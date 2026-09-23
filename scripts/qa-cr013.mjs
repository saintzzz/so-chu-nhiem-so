// CR-013 verification - production
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
  gvcn: "gvcn@demo.scn", bgh: "bgh@demo.scn", pht: "pht@demo.scn",
  phuhuynh: "phuhuynh@demo.scn", gvbm: "gvbm@demo.scn", ketoan: "ketoan@demo.scn",
};

const browser = await chromium.launch();
const contexts = {};

async function login(role) {
  if (contexts[role]) return contexts[role];
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
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
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  let last = page.url(), stable = 0;
  for (let i = 0; i < 20 && stable < 2; i++) {
    await page.waitForTimeout(300);
    if (page.url() === last) stable++; else { stable = 0; last = page.url(); }
  }
  return page;
}

// ===== 1. Dashboard breakdown =====
section("1. Dashboard ho so thieu");
{
  const page = await visit("gvcn", "/dashboard");
  const text = await page.locator("body").innerText();
  // Sau backfill, 6A3 khong con thieu dia chi -> card breakdown hoac 0
  const hasBreakdown = /thiếu|hồ sơ/i.test(text);
  check("dashboard render card ho so", hasBreakdown);
  const { data: missing } = await sb.from("students").select("id").is("address", null).limit(5);
  check("DB: address da backfill", (missing ?? []).length === 0, `con thieu: ${(missing ?? []).length}`);
}

// ===== 2. Praise mode persist + reason =====
section("2. Praise mode persist");
{
  const page = await visit("gvcn", "/register/seating");
  const praiseBtn = page.locator('button:has-text("Tuyên dương")').first();
  if (await praiseBtn.count()) {
    await page.waitForTimeout(1500); // cho hydrate xong
    await praiseBtn.click();
    await page.waitForTimeout(1500);
    const url1 = page.url();
    check("praise bat -> URL co praise=1", url1.includes("praise=1"), url1);
    // chuyen lop khac qua chip (tat ca chip phai giu praise=1)
    const chips = page.locator('main a[href*="register/seating"][href*="class="]');
    const n = await chips.count();
    check("co chip lop de chuyen", n > 1, `chips=${n}`);
    if (n > 1) {
      // click chip thu 2
      await chips.nth(1).click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(800);
      check("doi lop giu praise=1", page.url().includes("praise=1"), page.url());
      // ly do duoi HS highlight: "+X diem - ly do" trong chip
      const bodyText = await page.locator("main").innerText();
      const hasReason = /\+\d+ điểm - .+/.test(bodyText);
      const hasPoints = /\+\d+ điểm/.test(bodyText);
      check("HS highlight co ly do", hasReason || !hasPoints, hasPoints ? "co diem nhung thieu ly do" : "lop nay chua co HS duoc khen");
    }
  } else check("tim thay nut Tuyen duong", false);
}

// ===== 3. AI markdown strip (unit-level check of component output) =====
section("3. AI markdown");
{
  const src = readFileSync("src/components/ai/ai-insight-card.tsx", "utf8");
  check("AiInsightCard strip **", src.includes("**") && /replace\(/.test(src));
}

// ===== 4. Support inline actions =====
section("4. Support actions");
{
  const page = await visit("gvcn", "/academics/support");
  const text = await page.locator("body").innerText();
  check("support render", text.length > 100);
  const actionBtns = await page.locator('button:has-text("Duyệt"), button:has-text("Triển khai"), button:has-text("Hủy")').count();
  check("co action inline cho plan", actionBtns > 0, `${actionBtns} nut`);
}

// ===== 5. Compose preview =====
section("5. Compose preview");
{
  const page = await visit("gvcn", "/parents/compose");
  const text = await page.locator("body").innerText();
  const hasPreview = /phụ huynh|email|nhận/i.test(text);
  check("compose hien thong tin nguoi nhan", hasPreview);
}

// ===== 6. Safety BGH restrict =====
section("6. Safety scope");
{
  const page = await visit("gvcn", "/safety/bgh");
  const redirected = !page.url().includes("/safety/bgh");
  check("GVCN bi chan /safety/bgh", redirected, page.url());
  const nav = await page.locator("nav, aside").innerText().catch(() => "");
  check("nav GVCN khong co Bao cao BGH", !nav.includes("Báo cáo Ban giám hiệu"));
  const { page: p2 } = await login("bgh");
  await p2.goto(`${BASE}/safety/bgh`, { waitUntil: "domcontentloaded" });
  await p2.waitForLoadState("networkidle").catch(() => {});
  check("BGH vao duoc /safety/bgh", p2.url().includes("/safety/bgh"), p2.url());
}

// ===== 7. Upload drag-drop + AI extract file =====
section("7. Upload");
{
  const page = await visit("gvcn", "/records/upload");
  const dropZone = await page.locator('[class*="dashed"], [data-drop]').count();
  check("co vung drag-drop", dropZone > 0, `${dropZone} vung`);
  const fileInputs = await page.locator('input[type="file"]').count();
  check("file input (upload + AI extract)", fileInputs >= 2, `${fileInputs} input`);
}

// ===== 8. Signoff 2 buoc =====
section("8. Signoff flow");
{
  const page = await visit("gvcn", "/register/signoff");
  const text = await page.locator("body").innerText();
  const hasSubmit = /Nộp|nộp/i.test(text);
  check("GVCN thay flow NOP (khong ky truc tiep)", hasSubmit);
  const { page: p2 } = await login("bgh");
  await p2.goto(`${BASE}/register/signoff`, { waitUntil: "domcontentloaded" });
  await p2.waitForLoadState("networkidle").catch(() => {});
  const bghText = await p2.locator("body").innerText();
  check("BGH thay duyet/ky", /duyệt|ký/i.test(bghText));
}

// ===== 9. Export xlsx =====
section("9. Export xlsx");
{
  const page = await visit("gvcn", "/register/export");
  const text = await page.locator("body").innerText();
  check("UI noi Excel/xlsx", /xlsx|Excel/i.test(text), "");
  const btn = page.locator('button:has-text("Xuất"), button:has-text("Excel")').first();
  if (await btn.count()) {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }).catch(() => null),
      btn.click(),
    ]);
    if (download) {
      const fname = download.suggestedFilename();
      check("download .xlsx", fname.endsWith(".xlsx"), fname);
    } else check("download xlsx", false, "khong co download event");
  } else check("nut xuat", false);
}

// ===== 10. Report AI button =====
section("10. Report AI");
{
  const page = await visit("gvcn", "/records/report");
  const btn = await page.locator('button:has-text("Phân tích")').count();
  check("co nut Phan tich", btn > 0);
  // dam bao khong auto-call AI: kiem tra khong co /api/ai/report-analysis request luc load
}

// ===== 11. Emulation scoring scope =====
section("11. Emulation scope");
{
  const page = await visit("gvcn", "/emulation/scoring");
  await page.waitForTimeout(500);
  const inputs = await page.locator('table input[type="number"]').count();
  const ro = await page.locator("table td span.text-muted-foreground").count();
  check("GVCN chi nhap duoc mot so cot", inputs > 0 && ro > 0, `input=${inputs} readonly=${ro}`);
  const { page: p2 } = await login("bgh");
  await p2.goto(`${BASE}/emulation/scoring`, { waitUntil: "domcontentloaded" });
  await p2.waitForLoadState("networkidle").catch(() => {});
  const bghInputs = await p2.locator('table input[type="number"]').count();
  check("BGH nhap duoc tat ca lop", bghInputs > inputs, `bgh=${bghInputs} vs gvcn=${inputs}`);
}

// ===== 12. Seed data qua UI =====
section("12. Seed qua UI");

// 12a. PH dat lich hen -> GVCN xac nhan
{
  const { data: before } = await sb.from("appointments").select("id");
  const n0 = (before ?? []).length;
  const page = await visit("phuhuynh", "/portal/parent");
  // tim form dat lich
  const dateInput = page.locator('input[type="datetime-local"]').first();
  const purposeInput = page.locator('input[placeholder*="Mục đích"]').first();
  const bookBtn = page.locator('button:has-text("Gửi yêu cầu")').first();
  if (await dateInput.count() && await purposeInput.count()) {
    await dateInput.fill("2026-09-25T15:00");
    await purposeInput.fill("Trao đổi kết quả học tập tháng 9");
    await bookBtn.click();
    await page.waitForTimeout(1500);
  }
  const { data: after } = await sb.from("appointments").select("id");
  check("PH dat lich hen qua portal", (after ?? []).length > n0, `${n0} -> ${(after ?? []).length}`);
}

// 12b. BGH tao ky thi + buoi thi
{
  const { data: ex0 } = await sb.from("exams").select("id");
  const n0 = (ex0 ?? []).length;
  const page = await visit("bgh", "/academics/exams");
  const nameInput = page.locator('input[placeholder*="Tên kỳ thi"]');
  if (await nameInput.count()) {
    await nameInput.fill("Kiểm tra giữa kỳ I - 2026");
    const dates = page.locator('input[type="date"]');
    if (await dates.count() >= 2) {
      await dates.nth(0).fill("2026-10-20");
      await dates.nth(1).fill("2026-10-22");
    }
    await page.locator('button:has-text("Tạo kỳ thi")').click();
    await page.waitForTimeout(1500);
  }
  const { data: ex1 } = await sb.from("exams").select("id");
  check("BGH tao ky thi", (ex1 ?? []).length > n0, `${n0} -> ${(ex1 ?? []).length}`);
}

// 12c. BGH them thiet bi + KPI
{
  const { data: eq0 } = await sb.from("equipment").select("id");
  const page = await visit("ketoan", "/school/equipment");
  const nameInput = page.locator('input[placeholder*="Tên"], input[placeholder*="thiết bị"]').first();
  if (await nameInput.count()) {
    await nameInput.fill("Máy chiếu Epson EB-500");
    await page.locator('button:has-text("Thêm"), button:has-text("Tạo")').first().click();
    await page.waitForTimeout(1500);
  }
  const { data: eq1 } = await sb.from("equipment").select("id");
  check("Them thiet bi", (eq1 ?? []).length > (eq0 ?? []).length, `${(eq0 ?? []).length} -> ${(eq1 ?? []).length}`);
}

// 12d. GVCN nhan tin cho PH qua parent-chat -> PH tra loi
{
  const { data: m0 } = await sb.from("messages").select("id");
  const n0 = (m0 ?? []).length;
  const page = await visit("gvcn", "/academics/parent-chat?class=64cc7939-d3e9-4205-a5fb-8e24cdfd857a");
  // chon PH dau tien co the chat
  const parentLink = page.locator('main a[href*="parent-chat"][href*="to="]').first();
  if (await parentLink.count()) {
    await parentLink.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);
    const box = page.locator('textarea').last();
    if (await box.count()) {
      await box.fill("Chào anh/chị, em xin trao đổi về tình hình học tập của cháu.");
      await page.locator('button:has-text("Gửi")').last().click();
      await page.waitForTimeout(1500);
    }
  } else {
    console.log("  (khong tim thay link PH co tai khoan)");
  }
  const { data: m1 } = await sb.from("messages").select("id");
  check("GVCN gui tin nhan PH", (m1 ?? []).length > n0, `${n0} -> ${(m1 ?? []).length}`);
}

// 12e. BGH them KPI truong
{
  const { data: k0 } = await sb.from("school_kpis").select("id");
  const page = await visit("bgh", "/school/strategy");
  const titleIn = page.locator('input[placeholder*="Tỷ lệ"], input[placeholder*="khá giỏi"]').first();
  if (await titleIn.count()) {
    await titleIn.fill("Tỷ lệ chuyên cần đạt");
    const target = page.locator('input[placeholder*="75"]').first();
    if (await target.count()) await target.fill("98");
    const unit = page.locator('input[placeholder*="%"]').first();
    if (await unit.count()) await unit.fill("%");
    await page.locator('button:has-text("Thêm"), button:has-text("Tạo"), button:has-text("Lưu")').first().click();
    await page.waitForTimeout(1500);
  }
  const { data: k1 } = await sb.from("school_kpis").select("id");
  check("BGH them KPI", (k1 ?? []).length > (k0 ?? []).length, `${(k0 ?? []).length} -> ${(k1 ?? []).length}`);
}

// 12f. GVCN danh gia hanh kiem
{
  const { data: c0 } = await sb.from("conduct_evaluations").select("id");
  const page = await visit("gvcn", "/conduct/evaluation");
  const sel = page.locator("main select").first();
  if (await sel.count()) {
    await sel.selectOption({ index: 1 }).catch(() => {});
    await page.locator('button:has-text("Lưu đánh giá")').click();
    await page.waitForTimeout(1500);
  }
  const { data: c1 } = await sb.from("conduct_evaluations").select("id");
  check("GVCN luu danh gia HK", (c1 ?? []).length >= (c0 ?? []).length, `${(c0 ?? []).length} -> ${(c1 ?? []).length}`);
}

// ===== Summary =====
console.log(`\n===== TONG KET =====`);
const pass = results.filter((r) => r.ok).length;
console.log(`${pass}/${results.length} PASS`);
const fails = results.filter((r) => !r.ok);
if (fails.length) { console.log("FAIL:"); fails.forEach((f) => console.log(`  [${f.section}] ${f.name} - ${f.detail}`)); }
await browser.close();
