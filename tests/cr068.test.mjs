// CR-068: xet tot nghiep - static contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const M = read("supabase/migrations/20261250_cr068_tot_nghiep.sql");
const M2 = read("supabase/migrations/20261251_cr068_tn_r1.sql");
const DOC = read("docs/project/CR-068-xet-tot-nghiep.md");

test("AC-68.1: CR doc + module key + nav", () => {
  assert.match(DOC, /xet|tot nghiep/i);
  assert.match(read("src/lib/modules.ts"), /key: "xet_tot_nghiep"/);
  assert.match(read("src/lib/nav.ts"), /href: "\/school\/graduation", module: "xet_tot_nghiep"/);
});

test("AC-68.2: schema - campaigns + decisions + tenant + RLS", () => {
  assert.match(M, /create table public\.tn_campaigns/);
  assert.match(M, /create table public\.tn_decisions/);
  assert.match(M, /unique \(school_id, academic_year_id, level\)/);
  assert.match(M, /unique \(campaign_id, student_id\)/);
  assert.match(M, /check \(exam_score >= 0 and exam_score <= 10\)/);
  assert.match(M, /cross_school_campaign/);
  assert.match(M, /tn_module_enabled\(school_id\)/);
  assert.match(M, /scn_student_in_my_homeroom/);
  assert.match(M, /revoke insert, update, delete on public\.tn_campaigns, public\.tn_decisions/);
});

test("AC-68.3: RPC guards - role + module + transitions", () => {
  for (const fn of ["tn_open_campaign", "tn_set_exam", "tn_set_decision", "tn_finalize"]) {
    const body = M.slice(M.indexOf(`function public.${fn}`), M.indexOf("$$;", M.indexOf(`function public.${fn}`)));
    assert.match(body, /forbidden/, `${fn} check role`);
  }
  assert.match(M, /c\.grade = v_grade/, "seed chi lay lop khoi cuoi cap");
  assert.match(M, /d\.status in \('approved','locked'\)/, "snapshot tu quyet dinh da duyet");
  assert.match(M, /students set status = 'graduated'/, "finalize cap nhat trang thai");
  assert.match(M, /student_record_history/, "ghi lich su ho so");
  assert.match(M, /notifications/, "thong bao GVCN");
  for (const fn of ["tn_open_campaign(text, text, numeric, boolean)", "tn_set_exam(uuid, numeric)", "tn_set_decision(uuid, text, text)", "tn_finalize(uuid)"]) {
    assert.match(M, new RegExp(`revoke all on function public\\.${fn.replace("(", "\\(").replace(")", "\\)")} from public, anon`));
  }
});

test("AC-68.4: page + actions + board conventions", () => {
  const PG = read("src/app/(app)/school/graduation/page.tsx");
  assert.match(PG, /requireRoles\(\["bgh", "admin", "gvcn"\]\)/);
  assert.match(PG, /requireModule\("xet_tot_nghiep"\)/);
  assert.match(PG, /\.eq\("school_id", profile\.school_id\)/);
  const AC = read("src/app/(app)/school/graduation/actions.ts");
  assert.match(AC, /checkActionRole/);
  assert.match(AC, /assertModule\("xet_tot_nghiep"\)/);
  const BD = read("src/components/graduation/board.tsx");
  assert.match(BD, /compareVietnameseName/);
  assert.match(BD, /relative overflow-x-auto/);
  assert.doesNotMatch(BD, /—|–/);
});

test("AC-68.5: r1 - finalize preserve override", () => {
  assert.match(M2, /d\.decision = 'pending'[\s\S]*d\.decided_by is null/,
    "finalize chi tinh lai dong chua override");
  assert.match(M2, /p_value = 'pending' then null/, "pending = huy override");
});
