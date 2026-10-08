// ============================================================
// gen-bank/expand-ai.mjs - sinh bien the AI tu cau base.
// Moi cau gen gan vao cung YCCD cua cau goc, source=generated,
// review_state=unreviewed (GV duyet truoc khi dung).
// Dung: node scripts/gen-bank/expand-ai.mjs [--dry] [--per-std N]
// ============================================================

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#") && l.includes("http") === false || l.startsWith("OPENAI_MODEL") || l.startsWith("GEMINI_API"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);
// doc lai sach hon
const envAll = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);
const SUPA = envAll.NEXT_PUBLIC_SUPABASE_URL, KEY = envAll.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI = envAll.GEMINI_API_KEY, OR_KEY = envAll.OPENAI_API_KEY, OR_MODEL = envAll.OPENAI_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";
const DRY = process.argv.includes("--dry");
const PER_STD = +(process.argv.find((a) => a.startsWith("--per-std="))?.split("=")[1] ?? 20);

const hdr = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- providers --------------------------------------------------------------
async function callGemini(prompt) {
  if (!GEMINI) throw new Error("no gemini key");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4000, temperature: 0.9 } }) });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
async function callOpenRouter(prompt) {
  if (!OR_KEY) throw new Error("no or key");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OR_KEY}` },
    body: JSON.stringify({ model: OR_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.9 }),
  });
  if (!r.ok) throw new Error(`openrouter ${r.status}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}
async function gen(prompt) {
  try { return await callGemini(prompt); }
  catch (e) { if (String(e.message).includes("429") || String(e.message).includes("no gemini")) return callOpenRouter(prompt); throw e; }
}

// ---- prompt + validate -------------------------------------------------------
const QT = { multiple_choice: "trắc nghiệm 4 phương án A-D", true_false_4: "đúng/sai 4 ý a-d", short_answer: "trả lời ngắn", essay: "tự luận" };

function buildPrompt(std, seeds, n) {
  const ex = seeds.map((s, i) => `${i + 1}. [${s.qtype}/${s.level}] ${s.stem} -> đáp án: ${JSON.stringify(s.answer?.correct ?? "tự luận")}`).join("\n");
  return `Bạn là giáo viên tiểu học Việt Nam giàu kinh nghiệm ra đề. Nhiệm vụ: viết ${n} câu hỏi MỚI cho học sinh lớp ${std.grade}, môn ${std.subject_code}, chuẩn đầu ra ${std.code}.

Câu mẫu cùng chuẩn (chỉ để tham khảo dạng, KHÔNG chép lại):
${ex}

YÊU CẦU:
- Câu hỏi phải phù hợp lớp ${std.grade} và đúng chuẩn ${std.code}
- Đa dạng dạng: trắc nghiệm (4 phương án A-D), đúng/sai 4 ý (a-d), trả lời ngắn
- Mỗi câu phải có đáp án CHẮC CHẮN ĐÚNG + lời giải ngắn
- Tiếng Việt chuẩn, không dấu gạch em-dash
- Trả về JSON array THUẦN (không markdown):
[{"stem":"...","qtype":"multiple_choice|true_false_4|short_answer","level":"biet|hieu|van_dung","answer":{"correct":"A|a-Đúng, b-Sai,...|<đáp số>"},"solution":"..."}]`;
}

function parseJson(text) {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
function valid(q, seen) {
  if (!q?.stem || q.stem.length < 12) return false;
  if (!["multiple_choice", "true_false_4", "short_answer"].includes(q.qtype)) return false;
  const c = String(q.answer?.correct ?? "");
  if (q.qtype === "multiple_choice" && (!/ [A-D]\. /.test(q.stem) || !["A","B","C","D"].includes(c))) return false;
  if (q.qtype === "true_false_4" && !c.includes("-")) return false;
  if (q.qtype === "short_answer" && !c.trim()) return false;
  return !seen.has(norm(q.stem));
}

// ---- main -------------------------------------------------------------------
const stds = await (await fetch(`${SUPA}/rest/v1/tvc_curriculum_standards?select=id,code,grade,subject_code&grade=lte.5&order=subject_code,grade`, { headers: hdr })).json();
const [q0] = await (await fetch(`${SUPA}/rest/v1/tvc_questions?select=owner_id,school_id&limit=1`, { headers: hdr })).json();

// coverage hien tai + stem da co
let off = 0; const counts = {}, seen = new Set(), baseByStd = {};
for (;;) {
  const rows = await (await fetch(`${SUPA}/rest/v1/tvc_questions?select=stem,qtype,level,answer,standard_ids&grade=lte.5&offset=${off}&limit=1000`, { headers: hdr })).json();
  for (const r of rows) {
    seen.add(norm(r.stem));
    for (const sid of r.standard_ids) {
      counts[sid] = (counts[sid] ?? 0) + 1;
      (baseByStd[sid] ??= []).push(r);
    }
  }
  if (rows.length < 1000) break; off += 1000;
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`hien tai ${total} cau TH`);
// uu tien std it cau nhat
const order = stds.filter((s) => (counts[s.id] ?? 0) < 140).sort((a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0));
console.log(`${order.length} YCCD can bo sung`);

const out = [];
let calls = 0, fails = 0;
for (const std of order) {
  const need = Math.min(PER_STD, 150 - (counts[std.id] ?? 0));
  if (need <= 0) continue;
  const seeds = (baseByStd[std.id] ?? []).sort(() => Math.random() - 0.5).slice(0, 4);
  let got = 0, tries = 0;
  while (got < need && tries++ < 4) {
    const ask = Math.min(10, need - got + 3);
    calls++;
    try {
      const text = await gen(buildPrompt(std, seeds, ask));
      const arr = parseJson(text);
      if (!arr) { fails++; continue; }
      for (const q of arr) {
        if (got >= need) break;
        if (!valid(q, seen)) continue;
        seen.add(norm(q.stem)); got++;
        out.push({
          stem: q.stem, qtype: q.qtype, level: ["biet","hieu","van_dung","van_dung_cao"].includes(q.level) ? q.level : "hieu",
          points: q.qtype === "multiple_choice" || q.qtype === "short_answer" ? 0.5 : 1,
          answer: q.answer ?? {}, solution: q.solution ?? null, context: null,
          standard_ids: [std.id], subject_code: std.subject_code, grade: std.grade,
          source: "generated", review_state: "unreviewed",
          owner_id: q0.owner_id, school_id: q0.school_id, media: [],
        });
      }
    } catch (e) { fails++; console.log(`  ${std.code} err: ${e.message}`); await sleep(3000); }
    await sleep(1200);
  }
  console.log(`${std.code}: +${got} (tong ${out.length})`);
}
console.log(`\nAI gen xong: ${out.length} cau | ${calls} calls | ${fails} loi`);
if (!DRY && out.length) {
  for (let i = 0; i < out.length; i += 200) {
    const res = await fetch(`${SUPA}/rest/v1/tvc_questions`, { method: "POST", headers: { ...hdr, Prefer: "return=minimal" }, body: JSON.stringify(out.slice(i, i + 200)) });
    if (!res.ok) { console.error(`batch ${i}:`, await res.text()); process.exit(1); }
    console.log(`inserted ${i + 200}`);
  }
}
