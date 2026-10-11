// CR-049 P3b: PII minimization truoc AI provider.
// Chay: node --test tests/cr049-pii.test.mjs
// Unit test cho src/lib/ai-privacy.ts + static guards dam bao moi duong
// AI deu qua lop redact (ke ca Devin fallback dung lai safePrompt).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const { redactPiiText, pseudonymizeNames, deanonymizeNames, minimizePrompt } =
  await import(join(ROOT, "src/lib/ai-privacy.ts"));

// --- redactPiiText --------------------------------------------------------
test("redact: email bi cat", () => {
  assert.equal(redactPiiText("Lien he phuhuynh@gmail.com gap"), "Lien he [email] gap");
  assert.equal(redactPiiText("a.b+tag@sub.domain.edu.vn"), "[email]");
});

test("redact: SDT VN cac dau mang bi cat", () => {
  for (const p of ["0901234567", "0987654321", "0356789123", "+84901234567", "84912345678"]) {
    assert.equal(redactPiiText(`SDT ${p}`), "SDT [sdt]", p);
  }
});

test("redact: so dinh danh 9/12 so bi cat", () => {
  assert.equal(redactPiiText("CCCD 012345678901"), "CCCD [so_dinh_danh]");
  assert.equal(redactPiiText("CMND 123456789"), "CMND [so_dinh_danh]");
});

test("redact: KHONG cat ngay thang - noi dung chuong trinh", () => {
  const s = "Ngay 20/11/1982 la ngay Nha giao, chien dich 08/03/1954";
  assert.equal(redactPiiText(s), s);
});

test("redact: KHONG cat so diem / ma lop / so thuong", () => {
  const s = "Diem 8.5, lop 6A1, nam 2026, ma 123456";
  assert.equal(redactPiiText(s), s);
});

// --- pseudonymizeNames / deanonymizeNames ---------------------------------
test("pseudonymize: ten that -> alias, longest-first", () => {
  const names = [
    { name: "Nguyen Van An", alias: "HS01" },
    { name: "Nguyen Van", alias: "HS02" },
  ];
  const out = pseudonymizeNames("HS Nguyen Van An va Nguyen Van nghi", names);
  assert.equal(out, "HS HS01 va HS02 nghi");
});

test("deanonymize: alias -> ten that trong output LLM", () => {
  const names = [{ name: "Tran Thi Be", alias: "HS07" }];
  assert.equal(deanonymizeNames("HS07 can co gang", names), "Tran Thi Be can co gang");
});

test("pseudonymize+deanonymize roundtrip", () => {
  const names = [{ name: "Le Minh Chau", alias: "GV03" }];
  const prompt = pseudonymizeNames("Co Le Minh Chau day Toan", names);
  assert.ok(!prompt.includes("Le Minh Chau"));
  assert.equal(deanonymizeNames(prompt, names), "Co Le Minh Chau day Toan");
});

// --- CR-049 r5: separator-bearing PII (Codex F15) --------------------------
test("redact r5: SDT co separator (space/dot/dash/+84) bi cat", () => {
  for (const p of [
    "090 123 4567",
    "090.123.4567",
    "090-123-4567",
    "+84 90 123 4567",
    "+84.90.123.4567",
    "84 912 345 678",
  ]) {
    assert.equal(redactPiiText(`SDT ${p}`), "SDT [sdt]", p);
  }
});

test("redact r5: so dinh danh co separator bi cat", () => {
  assert.equal(redactPiiText("CCCD 0123 4567 8901"), "CCCD [so_dinh_danh]");
  assert.equal(redactPiiText("CCCD 012.345.678.901"), "CCCD [so_dinh_danh]");
  assert.equal(redactPiiText("CMND 123.456.789"), "CMND [so_dinh_danh]");
});

// --- CR-049 r5: ma HS so khong bi redact lam mat key (Codex F16) -----------
test("minimizePrompt: ma HS so -> alias truoc khi redact", () => {
  const names = [
    { name: "012345678", alias: "HS001" },
    { name: "079123456789", alias: "HS002" },
  ];
  const out = minimizePrompt("diem cua 012345678 va 079123456789", names);
  assert.equal(out, "diem cua HS001 va HS002");
  assert.ok(!out.includes("[so_dinh_danh]"));
});

// --- CR-049 r5: alias substring collision (Codex F17) -----------------------
test("deanonymize r5: GV10 khong an vao GV100 (boundary)", () => {
  const names = [{ name: "Tran Van Muoi", alias: "GV10" }];
  assert.equal(
    deanonymizeNames("GV10 va GV100 deu day Toan", names),
    "Tran Van Muoi va GV100 deu day Toan",
  );
});

test("deanonymize r5: GV10 + GV100 cung map - longest-first", () => {
  const names = [
    { name: "Tran Van Muoi", alias: "GV10" },
    { name: "Le Thi Tram", alias: "GV100" },
  ];
  assert.equal(
    deanonymizeNames("GV100 cham GV10", names),
    "Le Thi Tram cham Tran Van Muoi",
  );
});

// --- static guards ---------------------------------------------------------
test("guard: generateTextDetailed redact truoc moi provider call", () => {
  const src = read("src/lib/ai.ts");
  assert.match(src, /redactPiiText\(prompt\)/);
  assert.match(src, /redactPiiText\(opts\.system\)/);
  // safePrompt (khong phai prompt tho) duoc truyen vao 3 provider
  for (const call of ["callGemini(cfg, safePrompt", "callOpenAI(cfg, safePrompt", "callAnthropic(cfg, safePrompt"]) {
    assert.ok(src.includes(call), `thieu ${call}`);
  }
});

test("guard: respondWithAi redact + Devin fallback dung safePrompt", () => {
  const src = read("src/lib/ai-route.ts");
  assert.match(src, /pseudonymizeNames\(p\.prompt/);
  assert.match(src, /deanonymizeNames\(clean/);
  // fallbackToDevin phai nhan safe* chu khong phai p.prompt tho
  const fb = src.slice(src.indexOf("fallbackToDevin({"), src.indexOf("});", src.indexOf("fallbackToDevin({")) + 3);
  assert.match(fb, /safeSystem\\n\\n\$\{safePrompt\}|\$\{safeSystem\}.*safePrompt/s);
  assert.ok(!fb.includes("p.prompt"), "Devin fallback con dung prompt tho");
});

test("guard: chi extract-records duoc allowRawPrompt", () => {
  const dir = join(ROOT, "src/app/api/ai");
  const offenders = [];
  for (const d of readdirSync(dir)) {
    const f = join(dir, d, "route.ts");
    try {
      const src = readFileSync(f, "utf8");
      if (src.includes("allowRawPrompt") || src.includes("skipPiiRedact")) offenders.push(d);
    } catch { /* khong phai route folder */ }
  }
  assert.deepEqual(offenders.sort(), ["extract-records"]);
});

test("guard: moi route /api/ai deu qua generateText* (lop redact)", () => {
  const dir = join(ROOT, "src/app/api/ai");
  const bad = [];
  for (const d of readdirSync(dir)) {
    if (d === "devin-callback") continue; // chi nhan ket qua, khong goi provider
    const f = join(dir, d, "route.ts");
    try {
      const src = readFileSync(f, "utf8");
      const callsAi =
        src.includes("respondWithAi") ||
        src.includes("generateTextDetailed") ||
        src.includes("generateJson") ||
        src.includes("generateDoc");
      const rawFetch = /fetch\(\s*["'`](https?:)?\/\/(?!\$\{)/.test(src);
      if (!callsAi || rawFetch) bad.push(d);
    } catch { /* skip */ }
  }
  assert.deepEqual(bad, []);
});

// --- CR-049 r8: Unicode canonical equivalence (NFD vs NFC) -----------------
test("r8 H5: ten NFD trong prompt van bi alias", () => {
  const nfc = "Nguyễn Văn An";
  const nfd = nfc.normalize("NFD");
  assert.notEqual(nfc, nfd); // pre-condition: khac codepoint
  const map = [{ name: nfc, alias: "HS001" }];
  const out = pseudonymizeNames(`Nhan xet ve ${nfd} va ${nfc}`, map);
  assert.equal(out, "Nhan xet ve HS001 va HS001");
});

test("r8 H5: roster NFD + prompt NFC cung khop", () => {
  const map = [{ name: "Trần Thị Bé".normalize("NFD"), alias: "HS002" }];
  const out = pseudonymizeNames("Diem cua Trần Thị Bé", map);
  assert.equal(out, "Diem cua HS002");
});

// --- CR-049 r8 static guards ------------------------------------------------
test("guard r8: routes gui free-text co roster pseudonymization", () => {
  // daily-digest, period-log-summary (respondWithAi pii.names) va
  // suggest-tasks (minimizePrompt truc tiep) deu phai qua schoolPiiNames.
  for (const f of [
    "src/app/api/ai/daily-digest/route.ts",
    "src/app/api/ai/period-log-summary/route.ts",
    "src/app/api/ai/suggest-tasks/route.ts",
    "src/app/api/ai/advisor/route.ts",
    "src/app/api/ai/warning-advice/route.ts",
  ]) {
    const src = read(f);
    const hasRoster =
      src.includes("schoolPiiNames") || src.includes("piiNames");
    assert.ok(hasRoster, `${f} thieu roster PII names`);
  }
});

test("guard r8: Devin fallback jobs deu mang piiMap khi co roster", () => {
  for (const f of [
    "src/app/api/ai/advisor/route.ts",
    "src/app/api/ai/warning-advice/route.ts",
    "src/app/api/ai/suggest-tasks/route.ts",
  ]) {
    const src = read(f);
    assert.match(src, /fallbackToDevin\(\{[\s\S]*?piiMap/,
      `${f}: fallbackToDevin thieu piiMap - async callback khong deanon duoc`);
  }
});

test("guard r8: scn_save_grades reject NULL/empty/null-element arrays", () => {
  const m = read("supabase/migrations/20261129_cr049_r8_fixes.sql");
  assert.match(m, /p_student_ids is null/, "thieu NULL array check");
  assert.match(m, /cardinality\(p_student_ids\) = 0/, "thieu empty check");
  assert.match(m, /array_position\(p_student_ids, null\)/, "thieu null-element check");
  assert.match(m, /is not true/, "authz phai IS TRUE (3-valued logic)");
});

test("guard r8: digest pending RPC loai email rong/khoang trang", () => {
  const m = read("supabase/migrations/20261129_cr049_r8_fixes.sql");
  assert.match(m, /nullif\(btrim\(p\.email\), ''\) is not null/,
    "blank email van chiem scan slot");
});

test("guard r8: digest retry requeue theo week_start cua delivery", () => {
  const src = read("src/app/api/cron/parent-digest/route.ts");
  assert.match(src, /select\("parent_id, attempts, week_start"\)/,
    "retry lookup phai lay week_start");
  assert.match(src, /for \(const \[week, ids\] of byWeek\)/,
    "retry phai group theo tung week");
});

test("guard r8: email deadline tuyet doi + config loi tra ket qua", () => {
  const src = read("src/lib/email.ts");
  assert.match(src, /const deadline = Date\.now\(\) \+ budgetMs/,
    "phai la deadline tuyet doi, khong per-recipient");
  assert.match(src, /deadline - Date\.now\(\)/,
    "moi recipient chi lay budget con lai");
  assert.match(src, /email_config_timeout|cfg = await Promise\.race/,
    "config timeout phai tra structured result");
});

test("guard r8: weekStart tinh theo lich VN (UTC-midnight anchor)", () => {
  const src = read("src/app/api/cron/parent-digest/route.ts");
  assert.match(src, /T00:00:00Z/, "anchor ngay VN vao UTC-midnight");
  assert.match(src, /getUTCDay\(\)/, "dow phai theo UTC cua ngay VN");
});

test("guard r8: radar loc diem theo academic_year cua lop", () => {
  const src = read("src/lib/school/radar.ts");
  assert.match(src, /academic_year_id/, "grades phai mang academic_year_id");
  assert.match(src, /yearGrades/, "phai filter yearGrades truoc lowGrade");
});

test("guard r8: grades page bracket state read truoc + sau fetch", () => {
  const src = read("src/app/(app)/academics/grades/page.tsx");
  const s0 = src.indexOf("const s0 = await readState()");
  const s1 = src.indexOf("const s1 = await readState()");
  const fetch = src.indexOf("fetchAllRows<GradeRow>");
  assert.ok(s0 >= 0 && fetch > s0 && s1 > fetch,
    "phai doc state truoc + sau fetch grades");
  assert.match(src, /if \(s0 === s1\) break/, "state doi phai retry");
});
