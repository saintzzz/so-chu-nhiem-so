// ============================================================
// gen-bank/run.mjs - sinh ngan hang cau hoi base cap TH.
// Dung: node scripts/gen-bank/run.mjs [--dry] [--insert] [--target N]
// Doc env tu .env.local (SUPABASE url + service key).
// ============================================================

import { readFileSync } from "node:fs";
import { TOAN_GEN, makeRng } from "./toan.mjs";
import { TVIET_GEN } from "./tieng-viet.mjs";
import { ANH_GEN } from "./tieng-anh.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes("--dry");
const INSERT = process.argv.includes("--insert");
const TARGET = +(process.argv.find((a) => a.startsWith("--target="))?.split("=")[1] ?? 125);

const hdr = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

// ---- lay standards + owner/school tu DB ------------------------------------
const stds = await (await fetch(
  `${SUPA}/rest/v1/tvc_curriculum_standards?select=id,code,grade,subject_code&grade=lte.5&order=subject_code,grade,code`,
  { headers: hdr })).json();
const [q0] = await (await fetch(`${SUPA}/rest/v1/tvc_questions?select=owner_id,school_id&limit=1`, { headers: hdr })).json();
const seen = new Set();
for (let off = 0; ; off += 1000) {
  const page = await (await fetch(
    `${SUPA}/rest/v1/tvc_questions?select=stem&grade=lte.5&offset=${off}&limit=1000`,
    { headers: hdr })).json();
  for (const x of page) seen.add(norm(x.stem));
  if (page.length < 1000) break;
}

const GENS = {};
for (const [code, val] of Object.entries(TOAN_GEN)) GENS[code] = { gen: val[0], wrap: "tuple" };
for (const [code, val] of Object.entries(TVIET_GEN)) GENS[code] = { gen: val, wrap: "full" };
for (const [code, val] of Object.entries(ANH_GEN)) GENS[code] = { gen: val, wrap: "full" };

const out = [], missing = [], report = [];
for (const std of stds) {
  const g = GENS[std.code];
  if (!g) { missing.push(`${std.code} (${std.subject_code} l${std.grade})`); continue; }
  let got = 0, round = 0;
  const per = new Set();
  while (got < TARGET && round++ < 30) {
    const r = makeRng(round * 7919 + std.code.length * 31);
    for (const item of g.gen(r)) {
      if (got >= TARGET) break;
      const q = g.wrap === "tuple"
        ? { ...item[1], level: item[0] }
        : { ...item };
      q.standard_ids = [std.id];
      q.grade = std.grade;
      q.subject_code = std.subject_code;
      // validate MC: 4 phuong an khac nhau, chu dap an hop le
      if (q.qtype === "multiple_choice") {
        const opts = q.stem.match(/ [A-D]\. /g);
        const correct = q.answer?.correct;
        if (!opts || opts.length < 4 || !["A","B","C","D"].includes(correct)) continue;
      }
      if (q.qtype === "short_answer" && !String(q.answer?.correct ?? "").trim()) continue;
      const k = norm(q.stem);
      if (seen.has(k) || per.has(k)) continue;
      per.add(k); got++;
      out.push({
        stem: q.stem, qtype: q.qtype, level: q.level, points: q.points ?? 0.5,
        answer: q.answer ?? {},
        solution: q.solution ?? (q.qtype === "multiple_choice" ? `Đáp án đúng: ${q.answer?.correct ?? ""}` : null),
        context: q.context ?? null, standard_ids: [std.id],
        subject_code: std.subject_code, grade: std.grade,
        source: "imported", review_state: "approved",
        owner_id: q0.owner_id, school_id: q0.school_id, media: [],
      });
    }
  }
  report.push(`${std.code.padEnd(14)} ${std.subject_code.padEnd(11)} l${std.grade}  ${got}`);
}

console.log(report.join("\n"));
console.log(`\nTONG: ${out.length} cau | thieu generator: ${missing.length}`);
if (missing.length) console.log("MISSING:", missing.join("; "));

if (INSERT && !DRY) {
  for (let i = 0; i < out.length; i += 200) {
    const batch = out.slice(i, i + 200);
    const res = await fetch(`${SUPA}/rest/v1/tvc_questions`, {
      method: "POST", headers: { ...hdr, Prefer: "return=minimal" }, body: JSON.stringify(batch),
    });
    if (!res.ok) { console.error(`Batch ${i} FAIL:`, await res.text()); process.exit(1); }
    console.log(`inserted ${i + batch.length}/${out.length}`);
  }
}
