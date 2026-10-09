// Independent test-lead review via OpenRouter (free model) - fallback khi
// Devin subagent quota het. Model: nvidia/nemotron-3-ultra-550b-a55b:free
import { readFileSync } from "fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "").replace(/\r$/, "")]));
const key = env.OPENROUTER_API_KEY ?? env.OPENAI_API_KEY;
const MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

const files = {
  "COVERAGE-REPORT.md": readFileSync("docs/qa/COVERAGE-REPORT-2026-10-08.md", "utf8"),
  "run-full.txt (log)": readFileSync("docs/qa/run-full.txt", "utf8"),
  "run-sec.txt (log)": readFileSync("docs/qa/run-sec.txt", "utf8"),
  "qa-full-coverage.mjs": readFileSync("scripts/qa-full-coverage.mjs", "utf8"),
  "qa-security-edge.mjs": readFileSync("scripts/qa-security-edge.mjs", "utf8"),
  "qa-matrix.mjs": readFileSync("scripts/qa-matrix.mjs", "utf8"),
  "e2e-cr034.mjs": readFileSync("scripts/e2e-cr034.mjs", "utf8"),
};

const prompt = `You are an independent QA TEST LEAD doing a ROUND-3 review of a production QA campaign for "So Chu Nhiem So" - a multi-tenant Next.js 16 + Supabase school-management app at https://sochunhiem.vieschool.com. Demo gate: 15/10/2026.

You REJECTED this report twice:
- Round 1: Studio/TVC untested, grade-save missing, weak assertions, admin missing from matrix, console errors not gated.
- Round 2 (8 items): E13 not correlated to exact grade row; S14c/S15 needed strict 401/403 + no-persistence; S18/S19 needed marker+owner correlation; e2e-cr034 needed DB assertions + exact redirects + cleanup; spec matrix pht/admin gaps; browser hygiene gates missing; W26 needed exact signoff-id tracking.

The developer claims ALL findings closed and reports: full-coverage 49/49, security-edge 57/57, e2e 18/18.

YOUR JOB: verify claims against the ACTUAL test code - do not trust the report.
Check specifically:
1. Do the scripts implement what the report claims? (exact-id tracking, DB polling, deterministic seeds, concurrent_roles oracle, hygiene gates, strict assertions)
2. Any remaining weak/fake-pass assertions? (checks that can pass without the behavior actually working)
3. Any preconditions that silently pass when data is missing?
4. Any coverage gap that would actually matter for the demo gate?

Verdict format - start with exactly one line: "VERDICT: APPROVE" or "VERDICT: REJECT"
Then findings. For REJECT list concrete blockers with file:line evidence only - distinguish (a) true blockers, (b) acceptable residual risk already documented in the report's open-gaps section, (c) nitpicks. Do NOT re-litigate findings already closed with evidence.

===== FILES =====
${Object.entries(files).map(([n, c]) => `\n----- ${n} -----\n${c}`).join("\n")}`;

console.log("prompt chars:", prompt.length);
const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 4000,
  }),
});
const j = await res.json();
if (j.error) { console.log("API error:", JSON.stringify(j.error)); process.exit(1); }
console.log("model:", j.model, "| usage:", JSON.stringify(j.usage));
console.log("\n===== REVIEW =====\n");
console.log(j.choices[0].message.content);
