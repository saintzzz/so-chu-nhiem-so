// Independent DEV lead review cho CR-053 (hoc ba so) qua OpenRouter.
// Chay: node scripts/lead-review-cr053.mjs
import { readFileSync } from "fs";
import { execSync } from "child_process";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "").replace(/\r$/, "")]));
const key = env.OPENROUTER_API_KEY ?? env.OPENAI_API_KEY;
const MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return "(missing)"; } };
const files = {
  "migration.sql": read("supabase/migrations/20261214_cr053_year_end_decisions.sql"),
  "migration-attribution.sql": read("supabase/migrations/20261223_cr053_yed_guard_attribution.sql"),
  "actions.ts": read("src/app/(app)/records/hoc-ba/actions.ts"),
  "page.tsx": read("src/app/(app)/records/hoc-ba/page.tsx"),
  "hoc-ba-explorer.tsx": read("src/components/records/hoc-ba-explorer.tsx"),
  "hocba.ts": read("src/lib/hocba.ts"),
  "hocba-docx.ts (result model)": read("src/lib/hocba-docx.ts").split("\n").slice(0, 130).join("\n"),
  "tt22.ts (year-end fns)": read("src/lib/tt22.ts").split("\n").slice(-260).join("\n"),
  "export/route.ts": read("src/app/api/records/hoc-ba/export/route.ts"),
  "portal page.tsx": read("src/app/portal/student/hoc-ba/page.tsx"),
};

const prompt = `You are an independent DEV LEAD reviewing CR-053 "Hoc ba so" (digital transcript) for a multi-tenant Next.js 16 + Supabase school app (Vietnamese K-12, TT22/2021 regulations).

Feature: GVCN (homeroom teacher) drafts year-end decisions per student (kqht/kqrl/danh_hieu/promotion + legal-ground override), submits to BGH (principal) who approves/rejects (rejection >=10 chars reason, resubmission bumps revision). Stages: initial -> after_retest (needs approved initial w/ promotion=kiem_tra_danh_gia_lai) -> after_summer (needs ren_luyen_he). Lock linkage: register_signoffs type=so_hoc_ba status->locked locks all approved decisions of that class+year. Roles: gvcn write own class, bgh approve, pht campus-scoped read, so_gd/ubnd dept read-only. Export DOCX/PDF (gvcn own class + bgh only). Shared buildSubjectRows feeds staff + student portal.

ROUND 2 CONTEXT: a prior review round forced these fixes - verify them AND hunt regressions:
(a) saveYearEndDecision now recomputes kqht/kqrl/danhHieu/promotion server-side via getStudentYearEndBundle; deviations need override_legal_ground+note; computed_snapshot column now stores the SERVER comp (no longer client input).
(b) pickField seeds all 4 form fields from effective decision/computed values on first chip touch; submit requires kqht+kqrl+promotion non-null.
(c) Staleness checks (list + detail) now include danhHieu + absentTotal.
(d) Migration 20261223 adds decided_by/decided_at to the BGH immutable-field guard.
(e) buildHocBaModel: existing decision -> stored values verbatim (null danh_hieu renders "Khong"); computed only as "(goi y)" pre-decision.
(f) loadBundleShared: awaits hoisted out of Promise.all array for real concurrency.

Review the ACTUAL code for:
1. Security/RBAC: RLS leakage, missing role checks, tenant isolation, privilege escalation via crafted input.
2. State machine correctness: can any invalid transition slip through? Field ownership (gvcn vs bgh fields).
3. TT22 logic correctness in the year-end functions.
4. Data integrity: race conditions, missing CAS, orphaned data.
5. Reliability: unchecked reads, unbounded queries, error swallowing.

OUTPUT FORMAT (strict): your VERY FIRST LINE must be exactly "VERDICT: APPROVE" or "VERDICT: REJECT". Do NOT write analysis, reasoning, or file walkthroughs before the verdict. After the verdict line, list at most 12 findings as "- (a|b|c) file:line - issue - fix" where a=blocker, b=residual risk, c=nitpick. Keep total output under 1500 words. Only real issues.

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
    max_tokens: 8000,
  }),
});
const j = await res.json();
const out = j.choices?.[0]?.message?.content ?? JSON.stringify(j).slice(0, 2000);
console.log(out);
