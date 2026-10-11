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

const { redactPiiText, pseudonymizeNames, deanonymizeNames } = await import(
  join(ROOT, "src/lib/ai-privacy.ts")
);

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
