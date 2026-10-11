// QA Studio E2E - cong cu soan hoc lieu TVC360 tren production:
//   T1. GV mo hub 13 tools -> DC-01 sinh KHBD qua UI (AI that) -> luu -> gui duyet
//        -> export DOCX -> DC-02 ma tran -> DC-03 sinh de tu ngan hang -> A-01 -> bank
//   T2. To truong duyet (in_review -> totruong_ok)
//   T3. BGH duyet - xuat ban (totruong_ok -> published)
//   T4. Deny-path: PH hoc sinh bi chan khoi /studio
//   C. Cleanup: xoa material/matrix tag QA
//
// Chay: node scripts/qa-studio-e2e.mjs [--keep]

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = "https://sochunhiem.vieschool.com";
const KEEP = process.argv.includes("--keep");

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

const RUN = Date.now().toString(36).slice(-4).toUpperCase();
const TAG = `QA-${RUN}`;

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

async function login(email, pass = "demo1234", attempt = 1) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  p.setDefaultTimeout(90000);
  p.on("dialog", (d) => d.accept("QA duyet")); // review note prompt
  try {
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90000 });
    await p.fill("input[type=text]", email);
    await p.fill("input[type=password]", pass);
    await p.click("button[type=submit]");
    await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
    activePage = p;
    return { ctx, p };
  } catch {
    await ctx.close();
    if (attempt < 3) {
      console.log(`  retry login ${email} (${attempt})`);
      await new Promise((r) => setTimeout(r, 8000));
      return login(email, pass, attempt + 1);
    }
    throw new Error(`login ${email} failed`);
  }
}

async function gotoPage(p, url) {
  for (let i = 0; i < 3; i++) {
    try {
      await p.goto(url, { waitUntil: "networkidle", timeout: 90000 });
      const err = await p.locator("text=Không tải được dữ liệu").count();
      if (err === 0) return;
      console.log(`  page error state at ${url} - reload (${i + 1})`);
      await p.waitForTimeout(4000);
    } catch (e) {
      if (i === 2) throw e;
      console.log(`  retry goto ${url} (${i + 1})`);
      await p.waitForTimeout(5000);
    }
  }
}

// fill subject -> grade -> first standard checkbox, roi bam Sinh hoc lieu.
// Chi toan/tieng_anh/ngu_van/tieng_viet co YCCD -> phai chon mon cu the.
async function runTool(p, code, { subject = "toan", grade = "6", pickLesson } = {}) {
  await gotoPage(p, `${BASE}/studio/${code}`);
  const form = p.locator("div.rounded-xl.border.bg-card.p-5").first();
  const selects = form.locator("select");
  await selects.nth(0).selectOption(subject);
  await p.waitForTimeout(1200); // grades load
  await selects.nth(1).selectOption(grade);
  // standards checkbox list (load async theo mon+khoi)
  const cb = form.locator('input[type=checkbox]').first();
  await cb.waitFor({ state: "visible", timeout: 30000 });
  await cb.check();
  if (pickLesson) {
    const lesson = form.locator('input[placeholder*="VD"], input[placeholder*="bài"]').first();
    if (await lesson.count()) await lesson.fill(`${TAG} ${pickLesson}`);
  }
  await form.getByRole("button", { name: /Sinh học liệu|Rút câu hỏi/ }).click();
  // AI generate co the toi ~120s
  await p.getByRole("button", { name: "Lưu học liệu" }).waitFor({ timeout: 150000 });
}

const created = { materials: [], matrices: [] };

async function cleanup(tag = "pre-clean") {
  const { data: qaMats } = await sb.from("tvc_materials")
    .select("id").like("title", "QA-%");
  const ids = (qaMats ?? []).map((m) => m.id);
  if (ids.length) {
    await sb.from("tvc_reviews").delete().in("material_id", ids);
    await sb.from("tvc_materials").delete().in("id", ids);
  }
  const { data: mx } = await sb.from("tvc_matrices").select("id").like("title", "QA-%");
  if (mx?.length) await sb.from("tvc_matrices").delete().in("id", mx.map((x) => x.id));
  step("setup", `cleanup QA-% materials/matrices (${tag})`, true, `mats=${ids.length} mx=${mx?.length ?? 0}`);
}

try {
  await cleanup();

  // ================= STAGE T1: GV soan =================
  let gvcnProfile, matId, matrixId, examId;
  {
    const { ctx, p } = await login("anhptl@nd.scn");
    step("T1-gv", "login GV", true, p.url());
    gvcnProfile = (await sb.from("profiles").select("id").eq("email", "anhptl@nd.scn").single()).data.id;

    // hub 13 tools
    await gotoPage(p, `${BASE}/studio`);
    const bodyTxt = await p.textContent("body");
    const codes = ["DC-01","DC-02","DC-03","DC-04","DC-05","DC-06","T-01","T-02","V-01","V-02","A-01","A-02","A-03"];
    step("T1-gv", "hub /studio hien du 13 tools", codes.every((c) => bodyTxt.includes(c)),
      codes.filter((c) => !bodyTxt.includes(c)).join(",") || "all");

    // DC-01 sinh KHBD qua UI + luu
    await runTool(p, "DC-01", { pickLesson: "Present simple" });
    await p.getByRole("button", { name: "Lưu học liệu" }).click();
    await p.waitForSelector("text=Đã lưu", { timeout: 30000 });
    const { data: mat } = await sb.from("tvc_materials")
      .select("id,type,tool_code,status,content")
      .eq("author_id", gvcnProfile).eq("tool_code", "DC-01")
      .order("created_at", { ascending: false }).limit(1).single();
    matId = mat?.id;
    if (matId) {
      await sb.from("tvc_materials").update({ title: `${TAG}-khbd` }).eq("id", matId);
      created.materials.push(matId);
    }
    const secs = mat?.content?.sections?.length ?? 0;
    step("T1-gv", "DC-01 sinh KHBD + luu material", !!matId && secs > 0,
      `id=${matId} sections=${secs} status=${mat?.status}`);

    // mo trong thu vien -> gui duyet
    await gotoPage(p, `${BASE}/studio/library/${matId}`);
    await p.getByRole("button", { name: "Gửi duyệt" }).click();
    await p.waitForTimeout(2500);
    const { data: mat2 } = await sb.from("tvc_materials").select("status").eq("id", matId).single();
    step("T1-gv", "gui duyet -> status in_review", mat2?.status === "in_review", `status=${mat2?.status}`);

    // export DOCX - bytes that
    const exp = await p.evaluate(async (id) => {
      const r = await fetch(`/api/studio/materials/${id}/export?fmt=docx`);
      const b = await r.arrayBuffer();
      const head = new Uint8Array(b.slice(0, 2));
      return { status: r.status, size: b.byteLength, pk: head[0] === 0x50 && head[1] === 0x4b };
    }, matId);
    step("T1-gv", "export DOCX (file that, PK zip)", exp.status === 200 && exp.pk && exp.size > 5000,
      `status=${exp.status} size=${exp.size} pk=${exp.pk}`);

    // DC-02 ma tran -> luu -> verify tvc_matrices (cot owner_id)
    await runTool(p, "DC-02");
    await p.getByRole("button", { name: "Lưu học liệu" }).click();
    await p.waitForSelector("text=Đã lưu", { timeout: 30000 });
    const { data: mx } = await sb.from("tvc_matrices")
      .select("id,title,cells").eq("owner_id", gvcnProfile)
      .order("created_at", { ascending: false }).limit(1).single();
    matrixId = mx?.id;
    if (matrixId) {
      await sb.from("tvc_matrices").update({ title: `${TAG}-matrix` }).eq("id", matrixId);
      created.matrices.push(matrixId);
    }
    // material DC-02 cung tag de cleanup
    const { data: m2 } = await sb.from("tvc_materials")
      .select("id").eq("author_id", gvcnProfile).eq("tool_code", "DC-02")
      .order("created_at", { ascending: false }).limit(1).single();
    if (m2?.id) {
      await sb.from("tvc_materials").update({ title: `${TAG}-dc02` }).eq("id", m2.id);
      created.materials.push(m2.id);
    }
    step("T1-gv", "DC-02 sinh ma tran + luu", !!matrixId && (mx?.cells?.length ?? 0) > 0,
      `id=${matrixId} cells=${mx?.cells?.length ?? 0}`);

    // DC-03 sinh de tu ma tran (question bank that)
    if (matrixId) {
      await gotoPage(p, `${BASE}/studio/DC-03`);
      const mform = p.locator("div.rounded-xl.border.bg-card.p-5").first();
      await mform.locator("select").first().selectOption(matrixId);
      await mform.getByRole("button", { name: /Rút câu hỏi/ }).click();
      await p.getByRole("button", { name: "Lưu học liệu" }).waitFor({ timeout: 150000 });
      const preview = await p.textContent("body");
      const hasQ = /Câu \d+[:.]/.test(preview) && preview.includes("PHẦN");
      await p.getByRole("button", { name: "Lưu học liệu" }).click();
      await p.waitForSelector("text=Đã lưu", { timeout: 30000 });
      // retry: transient PostgREST error co the tra null ngay sau commit
      let exam = null;
      for (let i = 0; i < 4 && !exam; i++) {
        exam = (await sb.from("tvc_materials")
          .select("id,type,title").eq("author_id", gvcnProfile).eq("tool_code", "DC-03")
          .order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
        if (!exam) await p.waitForTimeout(2000);
      }
      examId = exam?.id;
      if (examId) {
        await sb.from("tvc_materials").update({ title: `${TAG}-exam` }).eq("id", examId);
        created.materials.push(examId);
      }
      step("T1-gv", "DC-03 sinh de tu ngan hang 22k cau", !!examId && hasQ,
        `exam=${examId} preview_has_questions=${hasQ}`);
    }

    // A-01 sinh bai doc tieng Anh qua API (AI fallback chain) - retry 1 lan cho 5xx transient
    let ai = { status: 0, sections: 0, provider: "?" };
    for (let i = 0; i < 2; i++) {
      ai = await p.evaluate(async () => {
        const r = await fetch("/api/studio/tools/A-01/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: "tieng_anh", grade: "6", cefr: "A2", topic: "school life" }),
        });
        const j = await r.json().catch(() => ({}));
        return { status: r.status, sections: j?.doc?.sections?.length ?? 0, provider: j?.provider ?? "?" };
      });
      if (ai.status === 200) break;
      await p.waitForTimeout(3000);
    }
    step("T1-gv", "A-01 sinh bai doc A2 (AI that)", ai.status === 200 && ai.sections > 0,
      `status=${ai.status} sections=${ai.sections} provider=${ai.provider}`);

    // ngan hang cau hoi
    await gotoPage(p, `${BASE}/studio/questions`);
    const qTxt = await p.textContent("body");
    step("T1-gv", "ngan hang /studio/questions render", /câu hỏi|Câu hỏi/i.test(qTxt));

    // thu vien liet ke material vua tao
    await gotoPage(p, `${BASE}/studio/library`);
    const libTxt = await p.textContent("body");
    step("T1-gv", "thu vien hien material QA", libTxt.includes("QA-") || libTxt.includes(TAG));

    await ctx.close();
  }

  // ================= STAGE T2: To truong duyet =================
  {
    const { ctx, p } = await login("linhnm@nd.scn");
    step("T2-totruong", "login to_truong", true);
    await gotoPage(p, `${BASE}/studio/library/${matId}`);
    await p.getByRole("button", { name: "Tổ duyệt" }).click();
    await p.waitForTimeout(2500);
    const { data: m } = await sb.from("tvc_materials").select("status").eq("id", matId).single();
    step("T2-totruong", "to truong duyet -> totruong_ok", m?.status === "totruong_ok", `status=${m?.status}`);
    await ctx.close();
  }

  // ================= STAGE T3: BGH xuat ban =================
  {
    const { ctx, p } = await login("hainv@nd.scn");
    step("T3-bgh", "login BGH", true);
    // click co the truot khi hydration chua xong -> retry theo status DB
    let st = null;
    for (let i = 0; i < 3; i++) {
      await gotoPage(p, `${BASE}/studio/library/${matId}`);
      await p.getByRole("button", { name: /BGH duyệt/ }).click().catch(() => {});
      await p.waitForTimeout(4000);
      st = (await sb.from("tvc_materials").select("status").eq("id", matId).single()).data?.status;
      if (st === "published") break;
      console.log(`  BGH approve attempt ${i + 1}: status=${st}`);
    }
    step("T3-bgh", "BGH duyet -> published", st === "published", `status=${st}`);
    await ctx.close();
  }

  // ================= STAGE T4: deny paths =================
  {
    const { ctx, p } = await login("annv@nd.scn");
    await gotoPage(p, `${BASE}/studio`);
    step("T4-deny", "PH bi chan khoi /studio", !p.url().includes("/studio"), p.url());
    await ctx.close();
  }
} catch (e) {
  let diag = "";
  try {
    if (activePage) {
      const txt = (await activePage.textContent("body"))?.replace(/\s+/g, " ").slice(0, 400) ?? "";
      diag = ` | url=${activePage.url()} body="${txt}"`;
    }
  } catch {}
  step("fatal", String(e).slice(0, 200) + diag, false);
} finally {
  await browser.close();
  if (!KEEP) await cleanup("post-test");
  mkdirSync("docs/qa", { recursive: true });
  const out = `docs/qa/studio-e2e-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(out, JSON.stringify({ run: RUN, created, results }, null, 2));
  const fails = results.filter((r) => r.ok === false);
  console.log(`\n=== ${results.filter((r) => r.ok === true).length} pass / ${fails.length} fail ===`);
  console.log(`report -> ${out}`);
  process.exit(fails.length ? 1 : 0);
}
