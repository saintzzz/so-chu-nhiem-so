// QA lifecycle E2E - full school onboarding flow on production:
//   A. So GD tao truong moi (khong seed demo)
//   B. BGH tao GV, tao lop, import HS, phan cong GVCN, xem danh sach
//   C. GVCN diem danh, lien ket + cap tai khoan PH, deny-path
//   D. GVBM dang nhap, deny-path
//   E. Output verify: DB rows, audit log, portal PH, Studio AI (fallback)
//   F. Cleanup: xoa toan bo truong test + auth users
//
// Chay: node scripts/qa-lifecycle-e2e.mjs [--keep]   (--keep de giu data)
// Env doc tu .env.local (SUPABASE_SERVICE_ROLE_KEY de verify + cleanup).

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = "https://sochunhiem.vieschool.com";
const KEEP = process.argv.includes("--keep");

// ---------- env ----------
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i).trim()] ||= l.slice(i + 1).trim();
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// ---------- test data ----------
const RUN = Date.now().toString(36).slice(-4).toUpperCase();
const SCHOOL = {
  name: `THCS QA E2E ${RUN}`,
  code: `QAE${RUN}`,
  level: "THCS",
  bghEmail: `bgh.qa${RUN.toLowerCase()}@demo.scn`,
  gvcnEmail: `gvcn.qa${RUN.toLowerCase()}@demo.scn`,
  gvbmEmail: `gvbm.qa${RUN.toLowerCase()}@demo.scn`,
  parentEmail: `ph.qa${RUN.toLowerCase()}@demo.scn`,
  pass: `Qa${RUN}demo!`,
};
const STUDENTS = [
  ["Nguyễn Văn QA Một", "2014-01-15", "nam"],
  ["Trần Thị QA Hai", "2014-03-20", "nu"],
  ["Lê Minh QA Ba", "2014-06-08", "nam"],
  ["Phạm Thu QA Bốn", "2014-09-25", "nu"],
  ["Hoàng Đức QA Năm", "2014-11-30", "nam"],
  ["Vũ Ngọc QA Sáu", "2015-02-14", "nu"],
];
const csvPath = `/tmp/qa-students-${RUN}.csv`;
writeFileSync(
  csvPath,
  "ma_hs,ho_ten,ngay_sinh,gioi_tinh\n" +
    STUDENTS.map((s, i) => `QA${i + 1},${s[0]},${s[1]},${s[2]}`).join("\n"),
);

// ---------- harness ----------
const results = [];
let t0 = Date.now();
function step(stage, name, ok, detail = "") {
  const ms = Date.now() - t0;
  t0 = Date.now();
  results.push({ stage, name, ok, ms, detail });
  console.log(`${ok === true ? "PASS" : ok === null ? "SKIP" : "FAIL"} [${stage}] ${name} (${ms}ms)${detail ? " - " + detail : ""}`);
}
const browser = await chromium.launch();
let activePage = null;
async function gotoPage(p, url) {
  for (let i = 0; i < 3; i++) {
    try {
      await p.goto(url, { waitUntil: "networkidle", timeout: 90000 });
      // trang hien "Khong tai duoc du lieu" khi 1 query transient fail -> reload
      const err = await p.locator("text=Không tải được dữ liệu").count();
      if (err === 0) return;
      console.log(`  page error state at ${url} (attempt ${i + 1}) - reload`);
      await p.waitForTimeout(4000);
      await p.reload({ waitUntil: "networkidle", timeout: 90000 });
      if ((await p.locator("text=Không tải được dữ liệu").count()) === 0) return;
    } catch (e) {
      if (i === 2) throw e;
      console.log(`  retry goto ${url} (attempt ${i + 1}: ${String(e).slice(0, 80)})`);
      await p.waitForTimeout(5000);
    }
  }
}
async function login(email, pass, attempt = 1) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  p.setDefaultTimeout(90000);
  try {
    await gotoPage(p, `${BASE}/login`);
    await p.fill("input[type=text]", email);
    await p.fill("input[type=password]", pass);
    await p.click("button[type=submit]");
    // Auth burst-throttle: 400/transient lam promise pending - retry toi da 3.
    await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
    activePage = p;
    return { ctx, p };
  } catch {
    const errTxt = (await p.locator("p.text-error").allTextContents().catch(() => [])).join("|");
    await ctx.close();
    if (attempt < 3) {
      console.log(`  retry login ${email} (attempt ${attempt}${errTxt ? ", err: " + errTxt : ""})`);
      await new Promise((r) => setTimeout(r, 8000));
      return login(email, pass, attempt + 1);
    }
    throw new Error(`login ${email} failed after 3 attempts${errTxt ? ": " + errTxt : ""}`);
  }
}

// ---------- pre-clean (idempotent rerun) ----------
async function cleanup(tag = "pre-clean") {
  const { data: schools } = await sb.from("schools").select("id").like("code", "QAE%");
  for (const s of schools ?? []) {
    const { data: profs } = await sb.from("profiles").select("id").eq("school_id", s.id);
    const profIds = (profs ?? []).map((x) => x.id);
    // parents owned by school profiles -> their auth users + links
    const { data: parents } = await sb.from("parents").select("id,profile_id").in("profile_id", profIds.length ? profIds : ["00000000-0000-0000-0000-000000000000"]);
    const parentIds = (parents ?? []).map((x) => x.id);
    const { data: cls } = await sb.from("classes").select("id").eq("school_id", s.id);
    const classIds = (cls ?? []).map((c) => c.id);
    if (classIds.length) {
      const { data: studs } = await sb.from("students").select("id").in("class_id", classIds);
      const studIds = (studs ?? []).map((x) => x.id);
      if (studIds.length) {
        await sb.from("attendance_records").delete().in("student_id", studIds);
        await sb.from("student_record_history").delete().in("student_id", studIds);
        await sb.from("parent_students").delete().in("student_id", studIds);
      }
      await sb.from("students").delete().in("class_id", classIds);
      await sb.from("timetable_entries").delete().in("class_id", classIds);
    }
    if (parentIds.length) await sb.from("parent_students").delete().in("parent_id", parentIds);
    if (parentIds.length) await sb.from("parents").delete().in("id", parentIds);
    for (const t of ["classes", "subjects", "departments", "academic_years", "feature_grants"]) {
      await sb.from(t).delete().eq("school_id", s.id);
    }
    // teacher_subjects co (teacher_id, subject_id); audit_logs co actor_id
    if (profIds.length) {
      await sb.from("teacher_subjects").delete().in("teacher_id", profIds);
      await sb.from("audit_logs").delete().in("actor_id", profIds);
    }
    await sb.from("notifications").delete().in("profile_id", profIds.length ? profIds : ["00000000-0000-0000-0000-000000000000"]);
    await sb.from("profiles").delete().eq("school_id", s.id);
    // auth users: profiles + parents
    for (const uid of [...profIds, ...(parents ?? []).map((p) => p.profile_id).filter(Boolean)]) {
      await sb.auth.admin.deleteUser(uid).catch(() => {});
    }
    await sb.from("schools").delete().eq("id", s.id);
  }
  step("setup", `cleanup truong QAE* cu (${tag})`, true);
}

try {
  await cleanup();

  // ================= STAGE A: So GD tao truong =================
  {
    const { ctx, p } = await login("sovqt@demo.scn", "demo1234");
    await gotoPage(p, `${BASE}/dept/schools`);
    await p.getByRole("button", { name: "THCS", exact: true }).click();
    await p.fill('input[placeholder="Tên trường *"]', SCHOOL.name);
    await p.fill('input[placeholder^="Mã trường"]', SCHOOL.code);
    await p.fill('input[placeholder="Họ tên admin trường (BGH) *"]', "QA Hiệu trưởng");
    await p.fill('input[placeholder="Email đăng nhập admin *"]', SCHOOL.bghEmail);
    await p.fill('input[placeholder="Mật khẩu (tối thiểu 8 ký tự) *"]', SCHOOL.pass);
    const seed = p.locator('input[type=checkbox]');
    if (await seed.isChecked()) await seed.uncheck();
    await p.getByRole("button", { name: /Tạo trường/ }).click();
    await p.waitForSelector("text=Đã tạo trường", { timeout: 60000 });
    step("A-so_gd", "tao truong moi (khong seed)", true);

    const { data: sch } = await sb.from("schools").select("id").eq("code", SCHOOL.code).single();
    step("A-so_gd", "DB: schools row", !!sch?.id, sch?.id);
    const [yr, dep, sub, prof] = await Promise.all([
      sb.from("academic_years").select("id", { count: "exact" }).eq("school_id", sch.id),
      sb.from("departments").select("id", { count: "exact" }).eq("school_id", sch.id),
      sb.from("subjects").select("id", { count: "exact" }).eq("school_id", sch.id),
      sb.from("profiles").select("id,role").eq("school_id", sch.id),
    ]);
    step("A-so_gd", "DB: nam hoc + to + mon auto-seed",
      (yr.count ?? 0) >= 1 && (dep.count ?? 0) >= 2 && (sub.count ?? 0) > 0,
      `year=${yr.count} dept=${dep.count} subj=${sub.count}`);
    step("A-so_gd", "DB: profile BGH",
      prof.data?.length === 1 && prof.data[0].role === "bgh",
      JSON.stringify(prof.data));
    SCHOOL.id = sch.id;
    await ctx.close();
  }

  // ================= STAGE B: BGH setup =================
  {
    const { ctx, p } = await login(SCHOOL.bghEmail, SCHOOL.pass);
    step("B-bgh", "login BGH moi", !p.url().includes("/login"), p.url());

    // B1. tao 2 GV - form giu nguyen trang thai mo sau moi lan tao
    await gotoPage(p, `${BASE}/school/users`);
    await p.getByRole("button", { name: /Thêm giáo viên/ }).click();
    const form = p.locator("div.flex-wrap.items-end").first();
    for (const [name, email, role] of [
      ["Nguyễn QA Chủ nhiệm", SCHOOL.gvcnEmail, "gvcn"],
      ["Trần QA Bộ môn", SCHOOL.gvbmEmail, "gvbm"],
    ]) {
      await form.locator("label:has-text('Họ tên') input").first().fill(name);
      await form.locator("label:has-text('Email') input").first().fill(email);
      await form.locator("label:has-text('Mật khẩu') input").first().fill(SCHOOL.pass);
      await form.locator("label:has-text('Vai trò') select").first().selectOption(role);
      await p.getByRole("button", { name: "Tạo tài khoản" }).click();
      await p.waitForSelector("text=Đã tạo tài khoản", { timeout: 60000 });
    }
    const { data: staff } = await sb.from("profiles")
      .select("role").eq("school_id", SCHOOL.id).in("role", ["gvcn", "gvbm"]);
    step("B-bgh", "tao 2 tai khoan GV (gvcn+gvbm)", staff?.length === 2, JSON.stringify(staff));

    // B2. tao lop 6A1
    await gotoPage(p, `${BASE}/records/intake`);
    await p.getByRole("button", { name: "Tiếp nhận lớp mới" }).click();
    await p.fill("#nc-name", "6A1");
    await p.getByRole("button", { name: "Tạo lớp" }).click();
    await p.waitForTimeout(2500);
    const { data: cls } = await sb.from("classes")
      .select("id,gvcn_id").eq("school_id", SCHOOL.id).eq("name", "6A1");
    step("B-bgh", "tao lop 6A1", cls?.length === 1, JSON.stringify(cls));
    SCHOOL.classId = cls?.[0]?.id;

    // B3. import 6 HS qua CSV - 2 file inputs tren trang (AiExtract +
    // StudentUploader): phai cham input trong dropzone border-dashed.
    // Retry vi setInputFiles co the chay truoc khi React hydrate.
    await gotoPage(p, `${BASE}/records/upload`);
    const fileInput = p.locator("div.border-dashed input[type=file]");
    for (let i = 0; i < 3; i++) {
      await fileInput.setInputFiles(csvPath);
      try {
        await p.waitForSelector("text=dòng hợp lệ", { timeout: 15000 });
        break;
      } catch {
        if (i === 2) throw new Error("CSV preview never rendered (hydration?)");
      }
    }
    await p.locator("#import-class").selectOption({ label: "6A1" });
    await p.getByRole("button", { name: /Nhập \d+ học sinh/ }).click();
    await p.waitForSelector("text=Đã nhập", { timeout: 30000 });
    const { count: stuCount } = await sb.from("students")
      .select("id", { count: "exact" }).eq("class_id", SCHOOL.classId);
    step("B-bgh", "import CSV 6 HS vao 6A1", stuCount === 6, `students=${stuCount}`);

    // B4. phan cong GVCN cho 6A1
    const { data: gvcn } = await sb.from("profiles")
      .select("id").eq("school_id", SCHOOL.id).eq("role", "gvcn").single();
    SCHOOL.gvcnId = gvcn.id;
    await gotoPage(p, `${BASE}/school/assignments`);
    const row = p.locator("tr", { hasText: "6A1" }).first();
    await row.locator("select").first().selectOption(gvcn.id);
    await p.getByRole("button", { name: "Lưu phân công CN" }).click();
    await p.waitForSelector("text=Đã lưu phân công chủ nhiệm", { timeout: 30000 });
    const { data: cls2 } = await sb.from("classes").select("gvcn_id").eq("id", SCHOOL.classId).single();
    step("B-bgh", "phan cong GVCN cho 6A1", cls2?.gvcn_id === gvcn.id);

    // B5. BGH xem danh sach HS
    await gotoPage(p, `${BASE}/school/students?class=${SCHOOL.classId}`);
    const bodyTxt = await p.textContent("body");
    step("B-bgh", "BGH xem danh sach HS (6/6 ten hien)",
      STUDENTS.every((s) => bodyTxt.includes(s[0])));

    await ctx.close();
  }

  // ================= STAGE C: GVCN tac vu =================
  {
    const { ctx, p } = await login(SCHOOL.gvcnEmail, SCHOOL.pass);
    step("C-gvcn", "login GVCN", !p.url().includes("/login"), p.url());

    // C1. diem danh ngay: 1 HS vang khong phep
    await gotoPage(p, `${BASE}/attendance/daily`);
    const group = p.locator(`[role=radiogroup][aria-label="Trạng thái của ${STUDENTS[0][0]}"]`);
    await group.locator("label", { hasText: "Không phép" }).click();
    await p.locator(`textarea[aria-label="Ghi chú cho ${STUDENTS[0][0]}"]`).fill("QA vắng không phép");
    await p.getByRole("button", { name: "Xác nhận chuyên cần" }).click();
    await p.waitForSelector("text=Đã xác nhận chuyên cần", { timeout: 30000 });
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    const { data: att } = await sb.from("attendance_records")
      .select("status").in("student_id",
        (await sb.from("students").select("id").eq("class_id", SCHOOL.classId)).data.map((x) => x.id))
      .eq("date", today);
    const absent = att?.filter((a) => a.status === "unexcused").length ?? 0;
    step("C-gvcn", "diem danh 6 HS (1 vang KP)", att?.length === 6 && absent === 1,
      `rows=${att?.length} unexcused=${absent}`);

    // C2. lien ket + cap tai khoan PH
    const { data: stu1 } = await sb.from("students")
      .select("id").eq("class_id", SCHOOL.classId)
      .eq("full_name", STUDENTS[0][0]).single();
    SCHOOL.studentId = stu1.id;
    await gotoPage(p, `${BASE}/register/roster`);
    await p.locator('select:has(option:text-is("Chọn học sinh..."))')
      .selectOption(stu1.id);
    await p.fill('input[placeholder="Họ tên phụ huynh *"]', "QA Phụ huynh Một");
    await p.fill('input[placeholder="Số điện thoại"]', "0901000111");
    await p.fill('input[type=email]', SCHOOL.parentEmail);
    await p.locator('label:has-text("Cấp tài khoản đăng nhập") input[type=checkbox]').check();
    await p.fill('input[placeholder="Mật khẩu (tối thiểu 8 ký tự) *"]', SCHOOL.pass);
    await p.getByRole("button", { name: "Liên kết", exact: true }).click();
    await p.waitForSelector("text=Đã tạo phụ huynh", { timeout: 60000 });
    const { data: par } = await sb.from("parent_students")
      .select("parent_id, parents!inner(email,profile_id)")
      .eq("parents.email", SCHOOL.parentEmail);
    step("C-gvcn", "tao + lien ket + cap account PH",
      !!par?.length && !!par[0].parents.profile_id, JSON.stringify(par));

    // C3. deny path: GVCN vao /school/users -> redirect
    await gotoPage(p, `${BASE}/school/users`);
    step("C-gvcn", "deny /school/users", !p.url().includes("/school/users"), p.url());

    // C4. Studio AI (fallback chain) qua session context
    const ai = await p.evaluate(async () => {
      const r = await fetch("/api/studio/tools/A-01/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: 6, topic: "qa lifecycle smoke" }),
      });
      return { status: r.status, ok: r.ok, body: (await r.text()).slice(0, 120) };
    });
    step("C-gvcn", "Studio A-01 generate (AI fallback live)", ai.ok, `status=${ai.status}`);

    await ctx.close();
  }

  // ================= STAGE D: GVBM =================
  {
    const { ctx, p } = await login(SCHOOL.gvbmEmail, SCHOOL.pass);
    step("D-gvbm", "login GVBM", !p.url().includes("/login"), p.url());
    await gotoPage(p, `${BASE}/records/students`);
    step("D-gvbm", "deny /records/students (chi gvcn/bgh)",
      !p.url().includes("/records/students"), p.url());
    await gotoPage(p, `${BASE}/school/users`);
    step("D-gvbm", "deny /school/users", !p.url().includes("/school/users"), p.url());
    await ctx.close();
  }

  // ================= STAGE E: PH portal + outputs =================
  {
    const { ctx, p } = await login(SCHOOL.parentEmail, SCHOOL.pass);
    await gotoPage(p, `${BASE}/portal/parent`);
    const txt = await p.textContent("body");
    step("E-parent", "portal PH thay HS duoc lien ket", txt.includes(STUDENTS[0][0]));
    await ctx.close();
  }
  {
    const { data: profIds } = await sb.from("profiles")
      .select("id").eq("school_id", SCHOOL.id);
    const { data: logs } = await sb.from("audit_logs")
      .select("action").in("actor_id", (profIds ?? []).map((x) => x.id));
    step("E-output", "audit_logs ghi lai hanh dong", (logs?.length ?? 0) > 0,
      `logs=${logs?.length} actions=${JSON.stringify([...new Set((logs ?? []).map((l) => l.action))])}`);
    const { data: profs } = await sb.from("profiles")
      .select("role").eq("school_id", SCHOOL.id);
    step("E-output", "profiles school = 4 (bgh+gvcn+gvbm+ph)",
      profs?.length === 4, JSON.stringify(profs?.map((x) => x.role)));
  }
} catch (e) {
  let diag = "";
  try {
    if (activePage) {
      const txt = (await activePage.textContent("body"))?.replace(/\s+/g, " ").slice(0, 400) ?? "";
      diag = ` | url=${activePage.url()} body="${txt}"`;
    }
  } catch {}
  step("fatal", e.message?.slice(0, 200) + diag, false);
} finally {
  await browser.close();
  if (!KEEP && SCHOOL.id) await cleanup("post-test");
  mkdirSync("docs/qa", { recursive: true });
  const out = `docs/qa/lifecycle-e2e-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(out, JSON.stringify({ run: RUN, school: { ...SCHOOL, pass: "***" }, results }, null, 2));
  const fails = results.filter((r) => r.ok === false);
  console.log(`\n=== ${results.filter((r) => r.ok === true).length} pass / ${fails.length} fail ===`);
  console.log(`report -> ${out}`);
  process.exit(fails.length ? 1 : 0);
}
