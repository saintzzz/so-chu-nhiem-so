// CR-014 UI test - tat ca thao tac qua giao dien web, chup screenshot tung buoc.
// Chay: node scripts/qa-ui-cr014.mjs
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "https://so-chu-nhiem-so-theta.vercel.app";
const SHOTS = new URL("../docs/qa/screenshots-cr014/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const results = [];
const shot = async (page, name) => {
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false });
  return `docs/qa/screenshots-cr014/${name}.png`;
};
const check = (id, name, pass, detail = "", img = "") => {
  results.push({ id, name, pass, detail, img });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} ${name} ${detail}`);
};

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("input[type=password]", "demo1234");
  await page.click("button[type=submit]");
  await page.waitForTimeout(5000);
}
const settle = async (page) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
};

const browser = await chromium.launch();
const errors = [];
let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 150));
});
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

// Moi role 1 context moi - session cu se redirect khoi /login
async function freshPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 150));
  });
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
  return p;
}

// ============ GVCN ============
await login(page, "gvcn@demo.scn");

// T1. Dashboard + nav groups
await settle(page);
const navText = await page.locator("body").innerText();
const navOrder = [
  "Chuyên cần",
  "Quản lý học sinh",
  "Giảng dạy",
  "Phụ huynh",
  "Tư vấn",
  "Sổ chủ nhiệm",
  "Thi đua",
];
const idx = navOrder.map((s) => navText.indexOf(s));
check(
  "T01",
  "GVCN nav theo business flow",
  idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1])),
  idx.join(","),
  await shot(page, "01-dashboard-gvcn-nav"),
);

// T2. Roster chips nhieu lop
await page.goto(`${BASE}/register/roster`);
await settle(page);
const chipCount = await page.locator('a[href*="class="]').count();
check(
  "T02",
  "Roster co class chips",
  chipCount >= 3,
  `${chipCount} chips`,
  await shot(page, "02-roster-chips"),
);

// T3. Seating praise mode + ly do
await page.goto(`${BASE}/register/seating`);
await settle(page);
await page.locator('button:has-text("Tuyên dương")').first().click();
await page.waitForTimeout(1500);
const praiseUrl = page.url().includes("praise=1");
const praiseReason = await page
  .locator("text=/\\+\\d+ điểm/")
  .first()
  .innerText()
  .catch(() => "");
check(
  "T03",
  "Praise mode persist URL + ly do duoi HS",
  praiseUrl && /điểm/.test(praiseReason),
  `url_praise=${praiseUrl}, reason="${praiseReason.slice(0, 50)}"`,
  await shot(page, "03-seating-praise"),
);

// T4. Doi lop giu praise
const clsLink = page.locator('a[href*="class="]').nth(1);
await clsLink.click();
await settle(page);
check(
  "T04",
  "Doi lop giu ?praise=1",
  page.url().includes("praise=1"),
  page.url().split("/").pop(),
);

// T5. Sua ho so HS qua modal
await page.goto(`${BASE}/records/students`);
await settle(page);
await page.locator("tbody tr").first().click();
await page.waitForTimeout(800);
const editBtn = page.locator('button:has-text("Sửa hồ sơ")').first();
check(
  "T05",
  "Nut Sua ho so hien thi",
  (await editBtn.count()) === 1,
  "",
  await shot(page, "05-student-expand-edit-btn"),
);
await editBtn.click();
await page.waitForTimeout(500);
const modal = page.locator("div.fixed").last();
await shot(page, "06-student-edit-modal");
await modal.locator('label:has-text("Địa chỉ") input').fill("Xã Tân Hòa, Huyện Châu Thành, Trà Vinh");
await modal.locator('button:has-text("Lưu thay đổi")').click();
await page.waitForTimeout(3000);
const { data: st1 } = await db
  .from("students")
  .select("id,full_name,address")
  .eq("address", "Xã Tân Hòa, Huyện Châu Thành, Trà Vinh")
  .limit(1);
check("T06", "Edit HS persist DB", (st1 ?? []).length === 1, st1?.[0]?.full_name);
const { data: hist } = await db
  .from("student_record_history")
  .select("field,old_value,new_value")
  .eq("student_id", st1?.[0]?.id ?? "")
  .eq("field", "address")
  .order("changed_at", { ascending: false })
  .limit(1);
check(
  "T07",
  "History ghi old/new",
  (hist ?? []).length === 1 && hist[0].new_value.includes("Tân Hòa"),
  hist?.[0] ? `${hist[0].old_value?.slice(0, 30)} -> ${hist[0].new_value?.slice(0, 30)}` : "none",
);

// T6. Signoff - tim vi tri menu + trang
await page.goto(`${BASE}/register/signoff`);
await settle(page);
const signoffText = await page.locator("body").innerText();
check(
  "T08",
  "Trang Nop & ky so hien thi",
  /Nộp|Ký duyệt|signoff|Đã ký/i.test(signoffText),
  "",
  await shot(page, "07-signoff-gvcn"),
);

// T7. Flow 2 buoc: reset 1 lop ve pending -> GVCN nop -> BGH ky
const { data: myClasses } = await db
  .from("classes")
  .select("id,name")
  .eq("name", "8A2");
const cls8a2 = myClasses?.[0]?.id;
await db
  .from("register_signoffs")
  .update({ status: "pending", submitted_by: null, submitted_at: null, signed_by: null, signed_at: null })
  .eq("class_id", cls8a2)
  .eq("period", "2026-09")
  .eq("type", "so_chu_nhiem");
await page.goto(`${BASE}/register/signoff`);
await settle(page);
const submitBtn = page.locator('button:has-text("Nộp sổ")').first();
const hasSubmit = (await submitBtn.count()) > 0;
await shot(page, "08-signoff-pending");
if (hasSubmit) {
  await submitBtn.click();
  await page.waitForTimeout(2500);
}
const { data: so1 } = await db
  .from("register_signoffs")
  .select("status,submitted_by")
  .eq("class_id", cls8a2)
  .eq("period", "2026-09")
  .eq("type", "so_chu_nhiem")
  .limit(1);
check(
  "T09",
  "GVCN nop so -> submitted",
  so1?.[0]?.status === "submitted" && !!so1?.[0]?.submitted_by,
  `status=${so1?.[0]?.status}`,
  await shot(page, "09-signoff-submitted"),
);

// T8. Period log filter lop
await page.goto(`${BASE}/schedule/period-log`);
await settle(page);
await shot(page, "10-period-log");

// T9. Parent chat: day du PH (ke ca chua co TK) + link chat cho PH co TK
await page.goto(`${BASE}/academics/parent-chat`);
await settle(page);
const contactsDefault = await page.locator("aside li").count();
// Di thang toi lop 8A2 (lop co PH demo account)
await page.goto(`${BASE}/academics/parent-chat?class=${cls8a2}`);
await settle(page);
const contacts8a2 = await page.locator("aside li").count();
const phLinks = await page.locator('a[href*="to="]').count();
check(
  "T10",
  "Trao doi PH day du",
  contactsDefault >= 10 && contacts8a2 >= 10 && phLinks > 0,
  `6A3=${contactsDefault} lien he, 8A2=${contacts8a2} lien he, ${phLinks} link chat`,
  await shot(page, "11-parent-chat"),
);

// T10. Support board multi-select
await page.goto(`${BASE}/academics/support`);
await settle(page);
await shot(page, "12-support-board");

// T11. Emulation scoring - editable vs readonly (readonly la span, khong phai input)
await page.goto(`${BASE}/emulation/scoring`);
await settle(page);
const editable = await page
  .locator('td input[type="number"]')
  .count();
const readonlyCells = await page
  .locator("td span.text-muted-foreground")
  .count();
check(
  "T11",
  "Emulation: GVCN chi sua lop CN",
  editable > 0 && readonlyCells > editable,
  `edit=${editable} readonly=${readonlyCells}`,
  await shot(page, "13-emulation-scoring"),
);

// T12. Audit gop + filter
await page.goto(`${BASE}/register/audit`);
await settle(page);
const auditText = await page.locator("body").innerText();
check(
  "T12",
  "Nhat ky & lich su gop + filter",
  /Lịch sử|thao tác|hồ sơ/i.test(auditText),
  "",
  await shot(page, "14-audit-merged"),
);

// T13. Export xlsx
await page.goto(`${BASE}/register/export`);
await settle(page);
const dl = page.waitForEvent("download", { timeout: 20000 }).catch(() => null);
await page.locator('button:has-text("Xuất"), button:has-text("Tải")').first().click();
const dlObj = await dl;
check(
  "T13",
  "Export xlsx",
  dlObj?.suggestedFilename()?.endsWith(".xlsx") ?? false,
  dlObj?.suggestedFilename(),
  await shot(page, "15-export"),
);

// ============ BGH (context moi) ============
page = await freshPage();
await login(page, "bgh@demo.scn");
await page.goto(`${BASE}/register/signoff`);
await settle(page);
const signBtn = page.locator('button:has-text("Ký duyệt")').first();
const hasSign = (await signBtn.count()) > 0;
await shot(page, "16-signoff-bgh");
if (hasSign) {
  await signBtn.click();
  await page.waitForTimeout(2500);
}
const { data: so2 } = await db
  .from("register_signoffs")
  .select("status,signed_by")
  .eq("class_id", cls8a2)
  .eq("period", "2026-09")
  .eq("type", "so_chu_nhiem")
  .limit(1);
check(
  "T14",
  "BGH ky duyet -> signed",
  so2?.[0]?.status === "signed" && !!so2?.[0]?.signed_by,
  `status=${so2?.[0]?.status}`,
  await shot(page, "17-signoff-signed"),
);

// BGH nav groups
await page.goto(`${BASE}/`);
await settle(page);
const bghNav = await page.locator("body").innerText();
const bghGroups = ["Điều hành", "Nhân sự", "Học sinh", "Giám sát"];
check(
  "T15",
  "BGH nav 4 nhom",
  bghGroups.every((g) => bghNav.includes(g)),
  "",
  await shot(page, "18-bgh-nav"),
);

// ============ Deny paths ============
page = await freshPage();
await login(page, "gvbm@demo.scn");
await page.goto(`${BASE}/records/students`);
await settle(page);
check(
  "T16",
  "GVBM bi chan /records/students",
  !page.url().includes("/records/students"),
  page.url().replace(BASE, ""),
);

page = await freshPage();
await login(page, "phuhuynh@demo.scn");
await page.goto(`${BASE}/register/signoff`);
await settle(page);
check(
  "T17",
  "PH bi chan /register/signoff",
  !page.url().includes("/register/signoff"),
  page.url().replace(BASE, ""),
);

console.log("\n=== console errors:", errors.length);
errors.slice(0, 8).forEach((e) => console.log("  -", e));
const pass = results.filter((r) => r.pass).length;
console.log(`\n===== ${pass}/${results.length} PASS =====`);
readFileSync;
await browser.close();
