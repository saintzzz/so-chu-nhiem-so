// CR-060 coverage - feature flags theo truong (module hoa ban kem).
// Chay: node --test tests/cr060.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const NAV = read("src/lib/nav.ts");
const MOD = read("src/lib/modules.ts");
const MIG = read("supabase/migrations/20261227_cr060_school_features.sql");
const APP = read("src/app/(app)/layout.tsx");
const ROUTE = read("src/app/api/studio/tools/[code]/generate/route.ts");

test("AC-60.1: school_features co PK + RLS read own-school / write admin+so_gd", () => {
  assert.match(MIG, /primary key \(school_id, module\)/);
  assert.match(MIG, /enable row level security/);
  assert.match(MIG, /sf_read[\s\S]*my_school_id\(\)/);
  assert.match(MIG, /sf_write[\s\S]*'admin','so_gd'/);
  assert.match(MIG, /revoke all on public\.school_features from anon/);
});

test("AC-60.2: mergedNav loc section/item theo module bi tat", () => {
  assert.match(NAV, /module\?: string/);
  assert.match(NAV, /disabled\?: ReadonlySet<string>/);
  assert.match(NAV, /sec\.module && disabled\?\.has\(sec\.module\)/);
  assert.match(NAV, /c\.module && disabled\?\.has\(c\.module\)/);
});

test("AC-60.3: 4 module duoc tag vao nav", () => {
  for (const m of ["studio", "hoc_ba", "tu_van_an_toan", "thi_dua"]) {
    assert.match(NAV, new RegExp(`module: "${m}"`), `nav thieu module ${m}`);
  }
  for (const m of ["studio", "hoc_ba", "tu_van_an_toan", "thi_dua"]) {
    assert.match(MOD, new RegExp(`key: "${m}"`), `registry thieu ${m}`);
  }
});

test("AC-60.4: layout truyen disabled xuong nav + moi cay module co guard", () => {
  assert.match(APP, /disabledModules\(\)/);
  assert.match(APP, /disabledModules=\{disabled\}/);
  const dirs = readdirSync(join(ROOT, "src/app/(app)"));
  for (const d of ["studio", "safety", "counseling", "emulation", "competency"]) {
    assert.ok(dirs.includes(d));
    const lay = read(`src/app/(app)/${d}/layout.tsx`);
    assert.match(lay, /requireModule\("(studio|tu_van_an_toan|thi_dua)"\)/, `${d} thieu guard`);
  }
  // hoc-ba: guard trong page + export API (layout 2-segment lam validator
  // .next/types cu xung dot global LayoutProps - nem guard vao entry points)
  assert.match(read("src/app/(app)/records/hoc-ba/page.tsx"), /requireModule\("hoc_ba"\)/);
  assert.match(read("src/app/api/records/hoc-ba/export/route.ts"), /assertModule\("hoc_ba"\)/);
});

test("AC-60.5: route DC-03 chan theo module flag + trang quan tri ton tai", () => {
  assert.match(ROUTE, /assertModule\("studio"\)/);
  const page = read("src/app/(app)/dept/modules/page.tsx");
  assert.match(page, /requireRoles\(\["so_gd", "admin"\]\)/);
  const act = read("src/app/(app)/dept/actions.ts");
  assert.match(act, /setSchoolModule/);
  assert.match(act, /checkActionRole\(\["so_gd", "admin"\]\)/);
});
