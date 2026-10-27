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

test("AC-60.1 (static): school_features co PK + RLS overlap && + grants", () => {
  assert.match(MIG, /primary key \(school_id, module\)/);
  assert.match(MIG, /enable row level security/);
  assert.match(MIG, /sf_read[\s\S]*my_school_id\(\)/);
  // overlap && - KHONG phai @> (containment): nobody co ca 2 role
  assert.match(MIG, /sf_read[\s\S]*&& array\['admin','so_gd'\]/);
  assert.match(MIG, /sf_write[\s\S]*&& array\['admin','so_gd'\]/);
  assert.doesNotMatch(MIG, /@> array\['admin','so_gd'\]/);
  assert.match(
    MIG,
    /grant select, insert, update, delete on public\.school_features to authenticated/,
  );
  assert.match(MIG, /grant all on public\.school_features to service_role/);
  assert.match(MIG, /revoke all on public\.school_features from anon/);
});

test("AC-60.2 (static): mergedNav loc section/item theo module bi tat", () => {
  assert.match(NAV, /module\?: ModuleKey/);
  assert.match(NAV, /disabled\?: ReadonlySet<string>/);
  assert.match(NAV, /sec\.module && disabled\?\.has\(sec\.module\)/);
  assert.match(NAV, /c\.module && disabled\?\.has\(c\.module\)/);
});

test("AC-60.3 (static): 9 module duoc tag vao nav", () => {
  const KEYS = [
    "chuyen_can", "hoc_ba", "ky_thi_danh_gia", "phu_huynh_hoat_dong",
    "tu_van_an_toan", "thi_dua", "to_chuyen_mon", "studio",
    "van_hanh_nang_cao",
  ];
  for (const m of KEYS) {
    assert.match(NAV, new RegExp(`module: "${m}"`), `nav thieu module ${m}`);
    assert.match(MOD, new RegExp(`key: "${m}"`), `registry thieu ${m}`);
  }
});

test("AC-60.4 (static): layout truyen disabled xuong nav + moi cay module co guard", () => {
  assert.match(APP, /disabledModules\(\)/);
  assert.match(APP, /disabledModules=\{disabled\}/);
  const dirs = readdirSync(join(ROOT, "src/app/(app)"));
  const MOD_DIRS = {
    studio: "studio", safety: "tu_van_an_toan",
    counseling: "tu_van_an_toan", emulation: "thi_dua",
    competency: "thi_dua", attendance: "chuyen_can",
    parents: "phu_huynh_hoat_dong", activities: "phu_huynh_hoat_dong",
    team: "to_chuyen_mon",
  };
  for (const [d, m] of Object.entries(MOD_DIRS)) {
    assert.ok(dirs.includes(d));
    const lay = read(`src/app/(app)/${d}/layout.tsx`);
    assert.match(lay, new RegExp(`requireModule\\("${m}"\\)`), `${d} thieu guard`);
  }
  // nav-tag phai khop route-guard: moi href co module tag phai
  // nam duoi layout cung module hoac page co requireModule cung key
  // (kiem tra thu cong tai thoi diem viet test - parent-chat la case
  // duoc phat hien thieu guard).
  assert.match(
    read("src/app/(app)/academics/parent-chat/page.tsx"),
    /requireModule\("phu_huynh_hoat_dong"\)/,
    "parent-chat thieu guard",
  );
  // page-level guards cho module tron lan trong thu muc chung
  const PAGES = {
    "academics/exams": "ky_thi_danh_gia", "academics/analysis": "ky_thi_danh_gia",
    "academics/support": "ky_thi_danh_gia", "academics/plans": "ky_thi_danh_gia",
    "school/exam-analytics": "ky_thi_danh_gia", "school/daily-reports": "chuyen_can",
    "school/substitutes": "van_hanh_nang_cao", "school/radar": "van_hanh_nang_cao",
    "school/ai-assistant": "van_hanh_nang_cao", "school/nq37": "van_hanh_nang_cao",
    "school/equipment": "van_hanh_nang_cao", "school/campuses": "van_hanh_nang_cao",
    "school/strategy": "van_hanh_nang_cao",
  };
  for (const [p, m] of Object.entries(PAGES)) {
    assert.match(
      read(`src/app/(app)/${p}/page.tsx`),
      new RegExp(`requireModule\\("${m}"\\)`),
      `${p} thieu guard`,
    );
  }
  // hoc-ba: guard trong page + export API (layout 2-segment lam validator
  // .next/types cu xung dot global LayoutProps - nem guard vao entry points)
  assert.match(read("src/app/(app)/records/hoc-ba/page.tsx"), /requireModule\("hoc_ba"\)/);
  assert.match(read("src/app/api/records/hoc-ba/export/route.ts"), /assertModule\("hoc_ba"\)/);
});

test("AC-60.5 (static): guard tren tat ca studio API + hoc-ba entry + admin page", () => {
  assert.match(ROUTE, /assertModule\("studio"\)/);
  assert.match(
    read("src/app/api/studio/tools/[code]/audio/route.ts"),
    /assertModule\("studio"\)/,
  );
  assert.match(
    read("src/app/api/studio/questions/extract/route.ts"),
    /assertModule\("studio"\)/,
  );
  assert.match(
    read("src/app/api/studio/materials/[id]/export/route.ts"),
    /assertModule\("studio"\)/,
  );
  assert.match(
    read("src/app/(app)/register/lock-records/page.tsx"),
    /requireModule\("hoc_ba"\)/,
  );
  assert.match(
    read("src/app/(app)/safety/actions.ts"),
    /assertModule\("tu_van_an_toan"\)/,
  );
  const page = read("src/app/(app)/dept/modules/page.tsx");
  assert.match(page, /requireRoles\(\["so_gd", "admin"\]\)/);
  const act = read("src/app/(app)/dept/actions.ts");
  assert.match(act, /setSchoolModule/);
  assert.match(act, /checkActionRole\(\["so_gd", "admin"\]\)/);
});
