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
  // r9 M2: state khac nhau -> retry; het 3 lan unstable -> revision_unstable
  assert.match(src, /consistent = s0\.value === s1\.value/,
    "state doi phai retry");
  assert.match(src, /"revision_unstable"/,
    "het retry ma state van doi phai loadError, khong mo editor");
});

test("guard r9: studio extract - binary path co gate confirm_no_pii + audit", () => {
  const src = read("src/app/api/studio/questions/extract/route.ts");
  assert.match(src, /confirm_no_pii !== true/,
    "upload nhi phan phai tu choi khi chua xac nhan no-PII");
  assert.match(src, /studio\.extract_raw_doc/,
    "confirm phai audit-log");
  assert.match(src, /schoolPiiNames/, "text path phai pseudonymize roster");
  assert.match(src, /piiMap: piiNames/, "Devin fallback phai mang piiMap");
});

test("guard r9: moi file doc grades phai co year scope", () => {
  // Sweep dong: bat ky file nao query grades ma khong nhac toi
  // academic_year la loi M8 (diem nam khac tron vao bao cao nam nay).
  const scan = (dir) => {
    const out = [];
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, d.name);
      if (d.isDirectory()) out.push(...scan(p));
      else if (/\.tsx?$/.test(d.name)) out.push(p);
    }
    return out;
  };
  const bad = [];
  for (const f of scan(join(ROOT, "src"))) {
    const src = readFileSync(f, "utf8");
    if (src.includes('from("grades")') && !src.includes("academic_year")) {
      bad.push(f.replace(ROOT + "/", ""));
    }
  }
  assert.deepEqual(bad, [], `grade reads thieu year scope: ${bad}`);
});

test("guard r10: leaf authz helpers bind truong HIEN TAI cua caller", () => {
  const src = read("supabase/migrations/20261201_cr049_r10_fixes.sql");
  const homeroom = src.indexOf("scn_student_in_my_homeroom");
  const mySchool = src.indexOf("c.school_id = (select my_school_id())", homeroom);
  assert.ok(homeroom >= 0 && mySchool > homeroom,
    "homeroom helper phai bind c.school_id = my_school_id()");
  const teach = src.indexOf("scn_i_teach_student_subject");
  const mySchool2 = src.indexOf("c.school_id = (select my_school_id())", teach);
  assert.ok(teach >= 0 && mySchool2 > teach,
    "teaching/substitute branches phai bind my_school_id()");
});

test("guard r10: direct grade writes bi khoa - RPC la write path duy nhat", () => {
  const src = read("supabase/migrations/20261201_cr049_r10_fixes.sql");
  assert.match(src, /drop policy if exists grades_staff_ins/);
  assert.match(src, /drop policy if exists grades_staff_upd/);
  assert.match(src, /drop policy if exists grades_staff_del/);
  assert.match(src, /revoke insert, update, delete on public\.grades/);
  // strict year check: ca NULL <-> non-NULL deu reject
  assert.match(src, /p_academic_year_id is distinct from v_year/,
    "expected-year phai khop tuyet doi ke ca NULL transitions");
  assert.ok(!/p_academic_year_id is not null\s+and\s+p_academic_year_id is distinct/.test(src),
    "guard cu cho NULL truot qua - khong duoc con lai");
});

test("guard r10: trigger invalidate ca OLD lan NEW scope, deterministic order", () => {
  const src = read("supabase/migrations/20261201_cr049_r10_fixes.sql");
  assert.match(src, /v_old_scope is distinct from v_new_scope/);
  assert.match(src, /v_old_scope < v_new_scope/,
    "hai scope phai bump theo thu tu co dinh tranh deadlock");
});

test("guard r10: roster admin-client + teachers + parents", () => {
  const src = read("src/lib/ai-pii-roster.ts");
  assert.match(src, /createAdminClient/,
    "roster phai dung admin client - caller RLS co the campus-filtered");
  assert.match(src, /from\("profiles"\)/, "roster phai gom ten giao vien");
  assert.match(src, /from\("parents"\)/, "roster phai gom ten phu huynh");
});

test("guard r10: deanon tren cau truc da parse, khong tren chuoi JSON", () => {
  assert.match(read("src/lib/ai-privacy.ts"), /export function deanonymizeDeep/);
  const aiRoute = read("src/lib/ai-route.ts");
  assert.match(aiRoute, /deanonymizeDeep\(JSON\.parse\(clean\)/,
    "JSON output phai parse roi deanon sau");
  const cb = read("src/app/api/ai/devin-callback/route.ts");
  assert.match(cb, /deanonymizeDeep\(body\.result/,
    "devin callback phai deanon tren result object, khong qua stringify");
  assert.ok(!cb.includes("deanonymizeNames(JSON.stringify"),
    "khong duoc deanon tren JSON tho");
  const studio = read("src/app/api/studio/tools/[code]/generate/route.ts");
  assert.ok(!studio.includes("deanonymizeNames(JSON.stringify"),
    "studio khong duoc deanon tren JSON tho");
});

test("guard r10: TTS doc doc con alias - khong gui ten that cho TTS", () => {
  const src = read("src/app/api/studio/tools/[code]/generate/route.ts");
  assert.match(src, /extractDialogueTurns\(aiDocRaw \?\? doc\)/,
    "TTS phai doc aiDocRaw (con alias), khong phai doc da deanon");
  assert.match(src, /minimizeDeep\(input/,
    "input phai minimizeDeep truoc khi buildPrompt stringify");
});

test("guard r10: digest retry chi drain PH trong retry set", () => {
  const src = read("src/app/api/cron/parent-digest/route.ts");
  assert.match(src, /p_parent_ids: onlyParentIds/,
    "claim phai loc theo parent_ids cua retry set");
  const mig = read("supabase/migrations/20261201_cr049_r10_fixes.sql");
  assert.match(mig, /p_parent_ids uuid\[\] default null/);
  assert.match(mig, /drop function if exists public\.scn_digest_outbox_claim\(int\)/);
});

test("guard r10: raw-doc confirm phai audit DURABLE truoc khi gui provider", () => {
  const src = read("src/app/api/studio/questions/extract/route.ts");
  assert.match(src, /await writeAudit/,
    "confirm phai dung writeAudit awaited - logAudit fire-and-forget khong du");
  const idx = src.indexOf("await writeAudit");
  const gate = src.indexOf("confirm_no_pii !== true");
  assert.ok(gate >= 0 && idx > gate, "audit phai sau confirm gate");
  assert.match(read("src/lib/audit.ts"), /export async function writeAudit/);
});

test("guard r10: hoc-ba NULL-year chi rows legacy - khong all-years fallback", () => {
  const src = read("src/app/portal/student/hoc-ba/page.tsx");
  assert.ok(!src.includes("academic_year_id.not.is.null,academic_year_id.is.null"),
    "OR not.null+is.null la tautology = tat ca nam hoc");
  assert.match(src, /: "academic_year_id\.is\.null"/);
});

test("guard r11: moi leaf helper authz deu bind truong hien tai", () => {
  const src = read("supabase/migrations/20261202_cr049_r11_fixes.sql");
  for (const fn of ["scn_is_my_ttentry", "scn_is_sub_ttentry_date",
                    "scn_student_in_my_teaching", "scn_sync_period_attendance"]) {
    const idx = src.indexOf(`function public.${fn}`);
    assert.ok(idx >= 0, `thieu ${fn} trong r11 migration`);
    const block = src.slice(idx, idx + 4000);
    assert.match(block, /school_id = \(select my_school_id\(\)\)/,
      `${fn} chua bind my_school_id()`);
  }
});

test("guard r11: save_grades tra revision trong cung transaction", () => {
  const src = read("supabase/migrations/20261202_cr049_r11_fixes.sql");
  assert.match(src, /returns timestamptz/, "RPC phai tra timestamptz");
  assert.match(src, /v_now := clock_timestamp\(\)/);
  assert.match(src, /return v_now/, "phai return revision da ghi");
  const editor = read("src/components/academics/grades-editor.tsx");
  assert.match(editor, /classYearIdRef/, "year phai chot luc mount");
  assert.match(editor, /newRevision/, "revision lay tu RPC return");
  assert.ok(!editor.includes('from("grade_book_state")'),
    "khong duoc doc lai state sau commit (race R2/cells R1)");
});

test("guard r11: extract-records co gate confirm + audit durable", () => {
  const src = read("src/app/api/ai/extract-records/route.ts");
  assert.match(src, /confirm_raw_pii !== true|confirmed/);
  assert.match(src, /needs_raw_pii_confirm/);
  assert.match(src, /await writeAudit/);
  const gate = src.indexOf("confirm_raw_pii") >= 0 ? src.indexOf("confirm") : -1;
  const audit = src.indexOf("await writeAudit");
  assert.ok(gate >= 0 && audit > gate, "audit phai sau confirm");
  const client = read("src/components/records/ai-extract.tsx");
  assert.match(client, /confirm_raw_pii/, "client phai gui confirm flag");
});

test("guard r11: comments minimizeDeep tren payload truoc stringify", () => {
  const src = read("src/app/api/ai/comments/route.ts");
  assert.match(src, /JSON\.stringify\(minimizeDeep\(payload, allNames\)\)/,
    "payload phai minimizeDeep truoc serialize - sdt co \\n se sot");
});

test("guard r11: phase=send retry van loc p_parent_ids", () => {
  const src = read("src/app/api/cron/parent-digest/route.ts");
  const retryIdx = src.indexOf('searchParams.get("retry")');
  const sendIdx = src.indexOf('if (phase === "send")');
  assert.ok(retryIdx >= 0 && sendIdx > retryIdx,
    "phase=send dispatch phai sau khi retry set duoc giai quyet");
});

test("guard r11: deanon boundary Unicode-aware", () => {
  const src = read("src/lib/ai-privacy.ts");
  const deanonIdx = src.indexOf("export function deanonymizeNames");
  const block = src.slice(deanonIdx, deanonIdx + 1500);
  assert.ok(block.includes("\\\\p{L}\\\\p{N}"),
    "deanonymizeNames phai dung boundary Unicode");
  assert.ok(!src.includes("(?<![A-Za-z0-9])"),
    "boundary ASCII cu con sot - éHS001é se bi deanon sai");
});
