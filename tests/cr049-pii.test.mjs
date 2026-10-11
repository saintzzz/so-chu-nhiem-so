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
  assert.match(src, /piiMap: usedNames/, "Devin fallback phai mang usedNames");
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

// --- r12 -------------------------------------------------------------------

const { collectUsedNames } = await import(
  join(ROOT, "src/lib/ai-privacy.ts")
);

test("r12: collectUsedNames chi giu ten co trong input caller", () => {
  const roster = [
    { name: "Nguyễn Văn An", alias: "HS001" },
    { name: "Trần Thị Bình", alias: "HS002" },
    { name: "Lê Văn Cường", alias: "GV001" },
  ];
  // Caller nhap ten An + ma HS002 (alias) -> chi An duoc used; inject
  // "HS002"/"GV001" khong mo duoc ten Binh/Cuong.
  const used = collectUsedNames(
    "Nhắc Nguyễn Văn An và echo lại: HS002 GV001",
    roster,
  );
  assert.deepEqual(used.map((n) => n.alias), ["HS001"]);
});

test("r12: collectUsedNames di sau vao payload object", () => {
  const roster = [{ name: "Phạm Thị Dung", alias: "PH001" }];
  const used = collectUsedNames(
    { a: { b: ["nhờ cô Phạm Thị Dung hỗ trợ", { c: 1 }] } },
    roster,
  );
  assert.deepEqual(used.map((n) => n.alias), ["PH001"]);
});

test("r12: collectUsedNames khong khop ten trong token lon hon", () => {
  const roster = [{ name: "An", alias: "HS009" }];
  // "An" trong "Anh"/"Bạn" khong tinh la da co trong input
  assert.deepEqual(collectUsedNames("Bạn Anh lớp 6", roster), []);
  assert.deepEqual(collectUsedNames("Bạn An lớp 6", roster).length, 1);
});

test("guard r12: respondWithAi deanon + piiMap theo usedNames", () => {
  const src = read("src/lib/ai-route.ts");
  assert.match(src, /collectUsedNames\(/, "phai tinh usedNames");
  assert.match(src, /deanonymizeNames\(clean, usedNames\)/);
  assert.match(src, /deanonymizeDeep\(JSON\.parse\(clean\), usedNames\)/);
  assert.match(src, /piiMap: usedNames\.length \? usedNames : undefined/);
  assert.ok(!src.includes("piiMap: names.length"),
    "khong duoc luu nguyen roster vao ai_jobs.pii_map");
});

test("guard r12: khong route nao deanon full roster sau khi da scope", () => {
  for (const f of [
    "src/app/api/ai/class-analysis/route.ts",
    "src/app/api/ai/attendance-insight/route.ts",
  ]) {
    const src = read(f);
    assert.ok(!src.includes("deanonymizeNames"),
      `${f} con deanon full roster trong parse - mo lai lo inject alias`);
  }
  for (const f of [
    "src/app/api/ai/comments/route.ts",
    "src/app/api/ai/daily-report/route.ts",
    "src/app/api/ai/warning-advice/route.ts",
    "src/app/api/ai/suggest-tasks/route.ts",
    "src/app/api/ai/advisor/route.ts",
    "src/app/api/studio/tools/[code]/generate/route.ts",
    "src/app/api/studio/questions/extract/route.ts",
  ]) {
    const src = read(f);
    assert.match(src, /collectUsedNames\(/, `${f} thieu usedNames scoping`);
    assert.ok(!/piiMap:\s*(piiNames|roster\.names|allNames)/.test(src),
      `${f} van luu full roster vao pii_map`);
  }
});

test("guard r12: scn_is_my_homeroom_class + policies bind truong", () => {
  const src = read("supabase/migrations/20261203_cr049_r12_fixes.sql");
  const fnIdx = src.indexOf("function scn_is_my_homeroom_class");
  const fnBlock = src.slice(fnIdx, fnIdx + 800);
  assert.match(fnBlock, /c\.school_id = \(select my_school_id\(\)\)/,
    "homeroom-class helper phai bind truong hien tai");
  // signoff inline exists
  const soIdx = src.indexOf("signoff_insert");
  const soBlock = src.slice(soIdx, soIdx + 900);
  assert.match(soBlock, /c\.school_id = \(select my_school_id\(\)\)/);
  // digest gvcn branch
  const dgIdx = src.indexOf("digest_deliveries_staff_read");
  const dgBlock = src.slice(dgIdx, dgIdx + 1200);
  assert.match(dgBlock, /c\.school_id = \(select my_school_id\(\)\)/);
  // cr_del recorded_by + lp_del + appt + nlpc + inc bound
  assert.match(src, /recorded_by = auth\.uid\(\)\s*\n?\s*and scn_student_in_school/);
  assert.match(src, /school_id = my_school_id\(\) or scn_class_in_school/);
  assert.match(src, /teacher_id = auth\.uid\(\)\s*\n?\s*and scn_parent_in_school/);
  assert.match(src, /evaluated_by = auth\.uid\(\)\s*\)\s*and scn_student_in_school/);
});

test("guard r12: editor chot danh sach HS luc mount", () => {
  const src = read("src/components/academics/grades-editor.tsx");
  assert.match(src, /mountStudentIdsRef/, "studentIds phai mount-bound");
  assert.match(src, /studentIds = mountStudentIdsRef\.current/);
  assert.ok(!src.includes("const studentIds = students.map"),
    "gui students live se xoa diem HS chuyen vao giua phien");
});

test("guard r13: policies self-attribution/BGH con sot bind truong", () => {
  const src = read("supabase/migrations/20261204_cr049_r13_fixes.sql");
  // signoff_insert: nhanh BGH phai bind class-in-school, admin tach rieng
  const soIdx = src.indexOf("signoff_insert");
  const soBlock = src.slice(soIdx, soIdx + 1200);
  assert.match(soBlock, /'bgh'\] and scn_class_in_school\(class_id\)/,
    "BGH khong duoc ghi signoff sang truong khac");
  // inc_ins: chot drift + student thuoc class khi ca hai co
  const incIdx = src.indexOf("create policy inc_ins");
  const incBlock = src.slice(incIdx, incIdx + 1200);
  assert.match(incBlock, /scn_class_in_school\(class_id\)/);
  assert.match(incBlock, /scn_student_in_school\(student_id\)/);
  assert.match(incBlock, /s\.class_id = incidents\.class_id/,
    "student_id phai thuoc class_id khi ca hai duoc cung cap");
  // classes_write_ins drift chot lai trong file
  const cwIdx = src.indexOf("classes_write_ins on classes for insert");
  const cwBlock = src.slice(cwIdx, cwIdx + 500);
  assert.match(cwBlock, /school_id = \(select my_school_id\(\)\)/);
  // nlpc_upd/del competency_evaluations: evaluated_by + BGH bind student school
  const nIdx = src.indexOf("nlpc_upd on competency_evaluations");
  const nBlock = src.slice(nIdx, nIdx + 2200);
  assert.match(nBlock, /evaluated_by = auth\.uid\(\) and scn_student_in_school/);
  assert.match(nBlock, /'bgh'\] and scn_student_in_school/);
  // task_upd/del: nhanh created_by bind class-in-school
  const tIdx = src.indexOf("task_upd on tasks");
  const tBlock = src.slice(tIdx, tIdx + 2400);
  assert.match(tBlock, /created_by = auth\.uid\(\) and scn_class_in_school/);
});

test("guard r13: studio usedNames gom ctx + report-analysis minimize", () => {
  const gen = read("src/app/api/studio/tools/[code]/generate/route.ts");
  assert.match(gen, /collectUsedNames\(\{ input, ctx \}/,
    "ctx (khbdText/template tu DB) phai vao usedNames de deanon restore");
  const ra = read("src/app/api/ai/report-analysis/route.ts");
  assert.match(ra, /minimizeDeep\(stats, roster\.names\)/,
    "stats[].name phai minimize truoc JSON.stringify");
  assert.match(ra, /pii: \{ names: roster\.names, source: stats \}/);
});

test("guard r14: dept_meetings + dept_head + grade_book_state bound", () => {
  const src = read("supabase/migrations/20261205_cr049_r14_fixes.sql");
  const fnIdx = src.indexOf("function public.scn_is_dept_head");
  const fnBlock = src.slice(fnIdx, fnIdx + 800);
  assert.match(fnBlock, /scn_dept_in_school\(did\)/,
    "to truong chuyen truong khong con quyen o to cu");
  const dmIdx = src.indexOf("dm_del");
  const dmBlock = src.slice(dmIdx, dmIdx + 800);
  assert.match(dmBlock, /'bgh'\] and scn_dept_in_school/);
  const gsIdx = src.indexOf("grade_book_state_read on grade_book_state");
  const gsBlock = src.slice(gsIdx, gsIdx + 500);
  assert.match(gsBlock, /split_part\(scope_key, '\|', 4\)/,
    "staff chi doc revision lop thuoc truong minh");
});

test("guard r14: minimizeDeep xu ly ca JSON key", () => {
  const src = read("src/lib/ai-privacy.ts");
  const mdIdx = src.indexOf("function minimizeDeep");
  const mdBlock = src.slice(mdIdx, mdIdx + 1200);
  assert.match(mdBlock, /out\[mk\]/, "key phai minimize truoc serialize");
  const cuIdx = src.indexOf("function collectUsedNames");
  const cuBlock = src.slice(cuIdx, cuIdx + 900);
  assert.match(cuBlock, /walk\(k\)/, "key cung dua vao haystack");
});

test("guard r14: routes minimize truoc stringify + fail-closed nguon", () => {
  const es = read("src/app/api/ai/emulation-summary/route.ts");
  assert.match(es, /JSON\.stringify\(minPerClass\)/);
  assert.match(es, /pii: \{ names: roster\.names, source:/);
  const db = read("src/app/api/ai/dept-brief/route.ts");
  assert.match(db, /JSON\.stringify\(minSchool\)/);
  const ca = read("src/app/api/ai/class-analysis/route.ts");
  assert.match(ca, /JSON\.stringify\(minimizeDeep\(facts/);
  const asg = read("src/app/api/ai/assignment-suggest/route.ts");
  assert.match(asg, /JSON\.stringify\(minimizeDeep\(facts/);
  assert.match(asg, /tErr \|\| tsErr \|\| sjErr \|\| cErr/,
    "loi nguon khong duoc bien thanh du lieu rong");
  const st = read("src/app/api/ai/suggest-tasks/route.ts");
  assert.match(st, /evErr \|\| tkErr/);
  // r19: cErr duoc tach - loi DB khac PGRST116 -> 500, !classData -> 404.
  assert.match(st, /cErr && cErr\.code !== "PGRST116"/);
  assert.match(st, /!classData/);
});

test("guard r15: mergePiiNames + preserveKeys", () => {
  const src = read("src/lib/ai-privacy.ts");
  assert.match(src, /export function mergePiiNames/);
  assert.match(src, /alias: `⟦R\$\{r\.alias/,
    "alias roster phai doi prefix trong ngoac de khong dung alias nghiep vu");
  assert.match(src, /preserveKeys\?\.has\(k\)/,
    "key schema tool phai giu nguyen cho builder");
});

test("guard r15: 3 route widen roster + dept-brief TR-alias", () => {
  const ca = read("src/app/api/ai/class-analysis/route.ts");
  assert.match(ca, /schoolPiiNames\(profile\.school_id/);
  assert.match(ca, /mergePiiNames\(piiNames, roster\.names\)/);
  const ai = read("src/app/api/ai/attendance-insight/route.ts");
  assert.match(ai, /mergePiiNames\(piiNames, roster\.names\)/);
  const asg = read("src/app/api/ai/assignment-suggest/route.ts");
  assert.match(asg, /mergePiiNames\(names, roster\.names\)/);
  const db = read("src/app/api/ai/dept-brief/route.ts");
  assert.match(db, /alias: `⟦TR\$\{String\(i \+ 1\)/,
    "ten truong phai alias TRxx - ten truong la free-text co the chua ten nguoi");
});

test("guard r15: routes fail-closed tren loi nguon con sot", () => {
  const pl = read("src/app/api/ai/period-log-summary/route.ts");
  assert.match(pl, /subjErr/);
  const wa = read("src/app/api/ai/warning-advice/route.ts");
  assert.match(wa, /clsErr/);
  const dd = read("src/app/api/ai/daily-digest/route.ts");
  assert.match(dd, /clsErr/);
  assert.match(dd, /repErr/);
});

test("guard r15: studio generate preserveKeys cho builder", () => {
  const gen = read("src/app/api/studio/tools/[code]/generate/route.ts");
  assert.match(gen, /schemaKeys/);
  assert.match(gen, /minimizeDeep\(input, roster\.names, schemaKeys\)/);
});

test("r16: bracket alias - single-pass, khong rescan/re-minimize", async () => {
  const { pseudonymizeNames, deanonymizeNames } = await import(
    "../src/lib/ai-privacy.ts"
  ).catch(() => import("../src/lib/ai-privacy.js"));
  // finding 4: nguoi ten "RHS001" + alias ⟦HS001⟧ - single pass khong
  // de alias moi sinh bi quet lai nhu ten that.
  const map = [
    { name: "Nguyễn Văn An", alias: "⟦HS001⟧" },
    { name: "HS001", alias: "⟦HS002⟧" },
  ];
  assert.equal(
    pseudonymizeNames("Nguyễn Văn An", map),
    "⟦HS001⟧",
    "alias sinh ra khong duoc bi minimize lan nua trong cung luot",
  );
  // finding 3: ten restore chua alias cua nguoi khac - 1 luot thay the.
  const m2 = [
    { name: "THCS ⟦TR02⟧", alias: "⟦TR01⟧" },
    { name: "THCS Nguyễn Du", alias: "⟦TR02⟧" },
  ];
  assert.equal(
    deanonymizeNames("⟦TR01⟧ và ⟦TR02⟧", m2),
    "THCS ⟦TR02⟧ và THCS Nguyễn Du",
    "ten vua restore khong duoc quet lai",
  );
  // finding 5: bare core KHONG restore - "ma HS001" trong source la code
  // that, restore thanh ten se corrupt output. Model bo ngoac -> alias
  // sot lai (benign), tot hon restore sai.
  const m3 = [{ name: "Nguyễn Văn An", alias: "⟦HS001⟧" }];
  assert.equal(
    deanonymizeNames("ma HS001 van giu nguyen", m3),
    "ma HS001 van giu nguyen",
    "bare core khong duoc restore - tranh false-restore code that",
  );
  // alias legacy khong ngoac (pii_map job cu) van restore duoc.
  assert.equal(
    deanonymizeNames("HS07 can co gang", [{ name: "Trần Thị Bé", alias: "HS07" }]),
    "Trần Thị Bé can co gang",
    "legacy bare alias trong job cu van restore",
  );
  assert.equal(
    deanonymizeNames("GV10 va GV100 deu day", [{ name: "Trần Văn Mười", alias: "GV10" }]),
    "Trần Văn Mười va GV100 deu day",
    "boundary Unicode: GV10 khong an vao GV100",
  );
});

test("r17: pseudonymize - sentinel-adjacent name van bi alias (F1)", async () => {
  const { pseudonymizeNames } = await import("../src/lib/ai-privacy.ts")
    .catch(() => import("../src/lib/ai-privacy.js"));
  const map = [{ name: "Nguyễn Văn An", alias: "⟦HS001·ab12⟧" }];
  // r16 boundary loai ⟦⟧ cho phep smuggle "⟦Ten That⟧" ra provider.
  assert.equal(
    pseudonymizeNames("⟦Nguyễn Văn An⟧", map),
    "⟦⟦HS001·ab12⟧⟧",
    "ten sat ngoac sentinel van phai bi alias - khong co smuggle path",
  );
});

test("r17: pseudonymize - exact-alias literal duoc bao ve cross-call (F3)", async () => {
  const { pseudonymizeNames } = await import("../src/lib/ai-privacy.ts")
    .catch(() => import("../src/lib/ai-privacy.js"));
  const map = [
    { name: "Nguyễn Văn An", alias: "⟦HS001·ab12⟧" },
    { name: "HS001", alias: "⟦HS042·ab12⟧" },
  ];
  // alias da sinh trong luot truoc phai nguyen ven, KHONG bi minimize lai.
  assert.equal(
    pseudonymizeNames("⟦HS001·ab12⟧ đã nộp", map),
    "⟦HS001·ab12⟧ đã nộp",
    "generated alias khong duoc bi minimize lai",
  );
  // nguoc lai, source chua alias "nguyen ban" (khong trung map) thi ten
  // ben trong van bi minimize binh thuong.
  assert.equal(
    pseudonymizeNames("⟦HS001⟧ đã nộp", map),
    "⟦⟦HS042·ab12⟧⟧ đã nộp",
    "source-native bracket khong duoc mien minimize",
  );
});

test("r17: pseudonymize - SCF case fold match lookup (F2)", async () => {
  const { pseudonymizeNames } = await import("../src/lib/ai-privacy.ts")
    .catch(() => import("../src/lib/ai-privacy.js"));
  const map = [{ name: "Nguyễn Văn Sơn", alias: "⟦GV007·ab12⟧" }];
  // regex iu (SCF) khop ſ~S nhung lookup toLowerCase() cu tra m ->
  // ten ra provider. Lookup bay gio qua cung phep match iu.
  assert.equal(
    pseudonymizeNames("Nguyễn Văn ſơn dạy Toán", map),
    "⟦GV007·ab12⟧ dạy Toán",
    "ſ phai fold thanh S va lay duoc alias",
  );
});

test("r17: deanon - source-native sentinel khong false-restore (F3)", async () => {
  const { deanonymizeNames } = await import("../src/lib/ai-privacy.ts")
    .catch(() => import("../src/lib/ai-privacy.js"));
  const map = [{ name: "Nguyễn Văn An", alias: "⟦HS001·ab12⟧" }];
  // provider echo "ma ⟦HS001⟧" (code that, khong co nonce) -> KHONG
  // duoc restore thanh ten.
  assert.equal(
    deanonymizeNames("ma ⟦HS001⟧ van la code", map),
    "ma ⟦HS001⟧ van la code",
    "nonced alias chi match dang chinh xac - ⟦HS001⟧ khac ⟦HS001·ab12⟧",
  );
  assert.equal(
    deanonymizeNames("⟦HS001·ab12⟧ dat gioi", map),
    "Nguyễn Văn An dat gioi",
    "nonced alias match nguyen ven van restore",
  );
});

test("guard r17: alias construction sites co nonce + RPC pack", () => {
  const roster = read("src/lib/ai-pii-roster.ts");
  assert.match(roster, /aliasNonce\(\)/, "roster alias can nonce chong source collision");
  assert.match(roster, /·\$\{nonce\}/, "alias phai nhung nonce vao trong ngoac");
  const gen = read("src/app/api/studio/tools/[code]/generate/route.ts");
  assert.match(gen, /scn_save_exam_pack/, "pack de thi phai luu qua RPC transaction");
  assert.doesNotMatch(gen, /\.from\("tvc_exams"\)\s*\.insert/, "khong con insert tvc_exams truc tiep");
  const mig = read("supabase/migrations/20261206_cr049_r17_fixes.sql");
  assert.match(mig, /security invoker/);
  assert.match(mig, /auth\.uid\(\)/, "owner_id phai lay tu auth.uid() trong RPC");
});

test("guard r17: lookup error khong che thanh 404/403", () => {
  const files = [
    "src/app/api/studio/tools/[code]/generate/route.ts",
    "src/app/api/studio/materials/[id]/export/route.ts",
    "src/app/api/ai/daily-report/route.ts",
    "src/app/api/ai/period-log-summary/route.ts",
    "src/app/api/ai/warning-advice/route.ts",
  ];
  for (const f of files) {
    const s = read(f);
    assert.match(s, /PGRST116|clsErr|wErr|matErr|mtxErr/, `${f} phai tach loi DB khoi not-found`);
  }
});

test("r18: ten bat dau truoc alias khong an vao token da sinh", async () => {
  const { pseudonymizeNames } = await import("../src/lib/ai-privacy.ts")
    .catch(() => import("../src/lib/ai-privacy.js"));
  const map = [
    { name: "Nguyễn Văn An", alias: "⟦HS001·ab12⟧" },
    { name: "Mã ⟦HS001", alias: "⟦GV002·ab12⟧" },
  ];
  // cross-call: "Mã Nguyễn Văn An" -> luot 1 "Mã ⟦HS001·ab12⟧"; luot 2
  // ten "Mã ⟦HS001" (bat dau som hon alias) KHONG duoc nuot token.
  const once = pseudonymizeNames("Mã Nguyễn Văn An", map);
  assert.equal(once, "Mã ⟦HS001·ab12⟧");
  assert.equal(
    pseudonymizeNames(once, map),
    "Mã ⟦HS001·ab12⟧",
    "ten bat dau som hon vi tri alias khong duoc an vao token da sinh",
  );
  // nguoc lai, ten do dung rieng van duoc alias binh thuong.
  assert.equal(
    pseudonymizeNames("Mã ⟦HS001 đã nộp", map),
    "⟦GV002·ab12⟧ đã nộp",
    "ten doc lap (khong phai alias da sinh) van bi minimize",
  );
});

test("guard r18: authz/callback lookup tach loi DB khoi 401/403", () => {
  const files = [
    "src/app/api/studio/context/route.ts",
    "src/app/api/studio/tools/[code]/generate/route.ts",
    "src/app/api/studio/materials/[id]/export/route.ts",
    "src/app/api/ai/devin-callback/route.ts",
  ];
  for (const f of files) {
    const s = read(f);
    assert.match(s, /profErr|jobErr/, `${f} phai check error cua lookup phan quyen/job`);
    assert.match(s, /PGRST116/, `${f} phai chi deny khi row that su vang`);
  }
});

test("guard r19: auth helpers truyen loi DB len 500, khong bien thanh null/false", () => {
  const auth = read("src/lib/auth.ts");
  assert.match(auth, /profile lookup failed/, "getProfile phai throw khi profile query loi");
  assert.match(auth, /profile retry failed/, "requireProfile retry phai throw khi query loi - khong signOut nham");
  assert.match(auth, /\.maybeSingle\(\)/, "profile lookup dung maybeSingle de tach missing row");
  const perm = read("src/lib/permissions.ts");
  assert.match(perm, /scn_has_feature failed/, "hasFeature phai throw khi RPC loi (500, khong phai 403 sai)");
});

test("guard r19: suggest-tasks + devin-callback tach loi DB", () => {
  const st = read("src/app/api/ai/suggest-tasks/route.ts");
  assert.match(st, /cErr\.code !== "PGRST116"/, "class lookup chi 404 khi row vang, loi DB khac -> 500");
  const cb = read("src/app/api/ai/devin-callback/route.ts");
  assert.match(cb, /failErr/, "bad_doc UPDATE phai check error - job khong duoc treo pending");
});

test("guard r20: fallbackToDevin + allocator + email + review notify deu fail-closed loi DB", () => {
  const dv = read("src/lib/devin.ts");
  assert.match(dv, /insErr/, "INSERT ai_jobs phai check error - khong bien thanh fallback thuong");
  assert.match(dv, /failErr/, "UPDATE status=failed phai check error - job khong treo pending");
  assert.match(dv, /linkErr/, "UPDATE session_url phai check error - job phai link duoc session");
  const tv = read("src/lib/tvc/actions.ts");
  assert.match(tv, /stdRes\.error|stdErr/, "allocateQuestionCodes phai check loi SELECT chuan");
  assert.match(tv, /pgErr/, "allocateQuestionCodes phai check loi tung trang codes");
  assert.match(tv, /"error" in alloc/, "insertQuestionsWithCodes dung truoc INSERT khi allocator loi");
  assert.match(tv, /matErr/, "reviewMaterial phai check loi lookup tac gia");
  assert.match(tv, /notiErr/, "reviewMaterial phai check loi INSERT notification");
  const em = read("src/lib/email.ts");
  assert.match(em, /get_email_config/, "email doc config qua RPC");
  assert.match(em, /lookupErr/, "loi RPC email khong duoc cache - lan sau doc lai Vault");
  assert.match(em, /email_config:/, "loi config phai tra error gui, khong phai skipped");
  const ex = read("src/app/api/studio/questions/extract/route.ts");
  assert.match(ex, /topic: deanonymizeNames/, "topic phai deanon nhu cac truong khac");
});

test("guard r21: server actions + cron khong bo loi DB truoc mutation/notification", () => {
  const safety = read("src/app/(app)/safety/actions.ts");
  assert.match(safety, /campusUnknown/, "loi campus lookup khong duoc suy ra 'khong co campus' (leak cho PHT)");
  assert.match(safety, /lpErr/, "lookup lanh dao phai check error");
  const act = read("src/app/(app)/activities/actions.ts");
  assert.match(act, /stuErr/, "students lookup phai check error truoc dang ky");
  assert.match(act, /exErr/, "attendance lookup phai check error truoc INSERT");
  const sch = read("src/app/(app)/school/actions.ts");
  assert.match(sch, /scErr|cfErr/, "conflict lookups phai check error truoc mutation");
  assert.match(sch, /delErr/, "item_acl DELETE phai check error truoc audit");
  assert.match(sch, /aclErr|profErr/, "listItemAcl phai check ca 2 SELECT");
  const radar = read("src/app/(app)/school/radar/actions.ts");
  assert.match(radar, /dedupeErr/, "dedupe lookup phai check error truoc INSERT");
  assert.match(radar, /notiErr/, "warning notify phai check error");
  const sub = read("src/app/(app)/school/substitutes/actions.ts");
  assert.match(sub, /tpErr/, "target profiles lookup phai check error");
  const lp = read("src/app/(app)/academics/lesson-plans/actions.ts");
  assert.match(lp, /hdErr|ldErr/, "heads/leaders lookup phai check error");
  assert.match(lp, /planErr/, "plan lookup phai tach loi DB khoi 'khong ton tai'");
  const pd = read("src/app/api/cron/parent-digest/route.ts");
  assert.match(pd, /outboxUpdateErrors/, "outbox status UPDATE loi phai tich luy thanh 5xx");
  assert.match(pd, /recErr/, "reconcile UPDATE phai check error");
  const sup = read("src/app/(app)/academics/support/actions.ts");
  assert.match(sup, /subErr|exErr/, "subjects+existing lookups phai check error");
  const qb = read("src/components/tvc/question-bank.tsx");
  assert.match(qb, /if \(r\.error\)/, "chip ACL chi go khi DELETE thanh cong");
});

test("guard r22: nguon loi phai chan form; committed state revalidate truoc return", () => {
  const daily = read("src/app/(app)/attendance/daily/page.tsx");
  assert.match(daily, /error: attErr/, "attendance SELECT phai check error");
  assert.match(daily, /loadError/, "page phai truyen loadError vao roster");
  const roster = read("src/components/attendance/daily-roster.tsx");
  assert.match(roster, /loadError/, "roster nhan loadError");
  assert.match(roster, /\|\| blocked/, "nut luu/import phai bi chan khi loadError");
  const report = read("src/app/(app)/attendance/daily-report/page.tsx");
  assert.match(report, /attRes\.error/, "attendance counts phai check error");
  assert.match(report, /reportRes\.error/, "report lookup phai check error");
  const form = read("src/components/attendance/daily-report-form.tsx");
  assert.match(form, /\|\| !!loadError/, "save/submit phai bi chan khi loadError");
  const act = read("src/app/(app)/activities/actions.ts");
  // r23: thay dedupe (sender,class,title) bang marker activity_announcements -
  // claim nguyen tu theo activity_id, retry khong lap announcement/email.
  assert.match(act, /activity_announcements/, "announce phai dedupe qua marker theo activity_id (retry khong lap email)");
  const sa = read("src/app/(app)/safety/actions.ts");
  assert.match(
    sa,
    /leader lookup:[\s\S]{0,300}revalidatePath/,
    "lpErr branch phai revalidate truoc return",
  );
  const rec = read("src/app/(app)/records/students/actions.ts");
  assert.match(
    rec,
    /histErr[\s\S]{0,900}revalidatePath/,
    "history loi van phai revalidate (committed)",
  );
  assert.match(rec, /old_value: h\.old_value/, "audit loi phai luu gia tri cu de dong bo lai");
  const nf = read("src/components/attendance/notify-form.tsx");
  assert.match(nf, /res\.emailError/, "notify form phai check emailError nhu compose-form");
  const inbox = read("src/components/parents/inbox-client.tsx");
  assert.match(
    inbox,
    /markMessageRead\(m\.id\)[\s\S]{0,300}next\.delete/,
    "mark-read optimistic phai rollback khi action loi",
  );
});

test("guard r23: marker nguyen tu + nguon loi chan board + client khong nuot error", () => {
  const pl = read("src/app/(app)/schedule/period-log/page.tsx");
  assert.match(pl, /error: absErr|error: logsErr/, "period_logs/absences SELECT phai check error");
  assert.match(pl, /loadError/, "page phai truyen loadError vao board");
  const board = read("src/components/schedule/period-log-board.tsx");
  assert.match(board, /if \(blocked\) return/, "editor phai bi chan khi nguon loi");
  const act = read("src/app/(app)/activities/actions.ts");
  assert.match(act, /activity_announcements/, "announce phai dung marker theo activity_id");
  assert.match(act, /scn_announce_claim/, "claim marker phai qua RPC nguyen tu");
  assert.match(act, /scn_announce_fulfill/, "chi claimer moi fulfill - RPC kiem claim owner");
  assert.match(act, /email_done/, "delivery state phai tach khoi announcement");
  const safety = read("src/app/(app)/safety/actions.ts");
  assert.match(safety, /committed: true/, "createIncident phai tra committed sau business commit");
  const form = read("src/components/safety/incident-form.tsx");
  assert.match(form, /res\.committed/, "form phai reset khi committed de khong tao incident trung");
  const sup = read("src/app/(app)/academics/support/page.tsx");
  assert.match(sup, /gradeTrunc|gradeErr/, "fetchAllRows truncated/error phai chan board");
  const qb = read("src/components/tvc/question-bank.tsx");
  assert.match(qb, /deleteQuestion\(q\.id\)[\s\S]{0,120}r\?\.error|deleteQuestion\(q\.id\)[\s\S]{0,120}r\.error/, "delete chi go row khi thanh cong");
  const chat = read("src/components/academics/chat-thread.tsx");
  assert.match(chat, /notiErr/, "chat phai check loi notification");
  const sign = read("src/components/register/signoff-client.tsx");
  assert.match(sign, /const notified = await/, "signoff phai check ket qua notify");
  const appt = read("src/components/parents/appointments-client.tsx");
  assert.match(appt, /res\?\.error|res\.error/, "appointments phai hien loi action");
  const eq = read("src/components/school/equipment-board.tsx");
  assert.match(eq, /r\?\.error|r\.error/, "equipment phai hien loi update/delete");
  const fp = read("src/components/school/feature-permissions.tsx");
  assert.match(fp, /const \[err, setErr\]/, "err phai duoc render, khong discard");
});
