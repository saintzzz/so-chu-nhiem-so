// CR-069: hoc ba XML + ky so - static contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const M = read("supabase/migrations/20261252_cr069_hb_xml.sql");
const M1 = read("supabase/migrations/20261253_cr069_hb_r1.sql");
const DOC = read("docs/project/CR-069-hocba-xml.md");

test("AC-69.1: CR doc + module reuse + nav", () => {
  assert.match(DOC, /QD 3016|ky so/i);
  assert.match(read("src/lib/nav.ts"), /href: "\/records\/exports", module: "hoc_ba"/);
});

test("AC-69.2: schema - hb_exports + signature cols + RLS", () => {
  assert.match(M, /create table public\.hb_exports/);
  assert.match(M, /unique \(student_id, academic_year_id\)/);
  assert.match(M, /gvcn_sig text/);
  assert.match(M, /bgh_sig text/);
  assert.match(M, /check \(sha256 ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(M, /cross_school_student/);
  assert.match(M, /hb_module_enabled\(school_id\)/);
  assert.match(M, /scn_student_in_my_homeroom/);
  assert.match(M, /revoke insert, update, delete on public\.hb_exports/);
});

test("AC-69.3: RPC - role gates + state machine + immutable signed", () => {
  const store = M.slice(M.indexOf("function public.hb_store"), M.indexOf("$$;", M.indexOf("function public.hb_store")));
  assert.match(store, /forbidden/);
  assert.match(store, /module_disabled/);
  assert.match(store, /already_signed/, "da ky BGH khong tao lai");
  const sign = M.slice(M.indexOf("function public.hb_sign"), M.indexOf("$$;", M.indexOf("function public.hb_sign")));
  assert.match(sign, /invalid_state/, "sai trinh tu ky");
  assert.match(sign, /scn_student_in_my_homeroom/, "gvcn chi ky lop minh");
  // r1: transition atomic + sig hex - race-safe state machine.
  assert.match(M1, /where id = p_id and status = 'generated'/);
  assert.match(M1, /where id = p_id and status = 'gvcn_signed'/);
  assert.match(M1, /where public\.hb_exports\.status <> 'bgh_signed'/);
  assert.match(M1, /p_sig !~ '\^\[0-9a-f\]\{64\}\$'/);
  for (const fn of ["hb_store(uuid, uuid, text, text)", "hb_sign(uuid, text, text)"]) {
    assert.match(M, new RegExp(`revoke all on function public\\.${fn.replace("(", "\\(").replace(")", "\\)")} from public, anon`));
  }
});

test("AC-69.4: XML builder + signing + actions", () => {
  const X = read("src/lib/hbxml.ts");
  assert.match(X, /SCN-QD3016-v1/);
  assert.match(X, /HocBaDienTu/);
  assert.match(X, /createHmac/);
  assert.match(X, /HB_SIGNING_SECRET/);
  // r1: khong fallback secret cong khai - fail closed khi thieu env.
  assert.doesNotMatch(X, /scn-hb-dev-secret/);
  assert.match(X, /throw new Error\("HB_SIGNING_SECRET/);
  const AC = read("src/app/(app)/records/exports/actions.ts");
  assert.match(AC, /checkActionRole/);
  assert.match(AC, /assertModule\("hoc_ba"\)/);
  assert.match(AC, /createHash\("sha256"\)/);
  const PG = read("src/app/(app)/records/exports/page.tsx");
  assert.match(PG, /requireRoles\(\["bgh", "admin", "gvcn"\]\)/);
  assert.match(PG, /requireModule\("hoc_ba"\)/);
  const BD = read("src/components/exports/board.tsx");
  assert.match(BD, /compareVietnameseName/);
  assert.match(BD, /relative overflow-x-auto/);
  assert.doesNotMatch(BD, /—|–/);
});
