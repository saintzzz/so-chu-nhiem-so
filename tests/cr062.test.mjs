// CR-062 coverage - tuyen sinh dau cap (module tuyen_sinh).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const MIG = read("supabase/migrations/20261228_cr062_admissions.sql");
const ACTIONS = read("src/app/(app)/school/admissions/actions.ts");
const NAV = read("src/lib/nav.ts");
const MOD = read("src/lib/modules.ts");

test("AC-62.1 (static): migration tao 2 bang + RLS theo truong", () => {
  assert.match(MIG, /create table if not exists public\.admission_campaigns/);
  assert.match(MIG, /create table if not exists public\.admission_applications/);
  assert.match(MIG, /level in \('khoi_6','khoi_10'\)/);
  assert.match(MIG, /exam_number text/);
  assert.match(MIG, /unique \(campaign_id, exam_number\)/);
  assert.match(MIG, /enable row level security/);
  assert.match(MIG, /school_id = \(select my_school_id\(\)\)/);
  assert.match(MIG, /&& array\['admin','so_gd'\]::text\[\]/);
});

test("AC-62.2 (static): status flow day du 2 cap", () => {
  assert.match(MIG, /'submitted','approved','rejected','exam_registered',/);
  assert.match(MIG, /'passed','failed','enrolled'/);
});

test("AC-62.3 (static): module key + nav tag + route guard", () => {
  assert.match(MOD, /key: "tuyen_sinh"/);
  assert.match(NAV, /href: "\/school\/admissions", module: "tuyen_sinh"/);
  const layout = read("src/app/(app)/school/admissions/layout.tsx");
  assert.match(layout, /requireModule\("tuyen_sinh"\)/);
});

test("AC-62.4 (static): actions co role + module guard", () => {
  assert.match(ACTIONS, /checkActionRole\(ROLES\)/);
  assert.match(ACTIONS, /assertModule\("tuyen_sinh"\)/);
  for (const fn of [
    "createCampaign", "addApplications", "reviewApplication",
    "assignExamNumbers", "saveScores", "finalizeResults", "enrollApplications",
  ]) {
    assert.match(ACTIONS, new RegExp(`export async function ${fn}`), `thieu ${fn}`);
  }
});

test("AC-62.5 (static): enroll tao students + national_id + positive_points", () => {
  assert.match(ACTIONS, /from\("students"\)\s*\.insert/);
  assert.match(ACTIONS, /national_id: app\.id_number/);
  assert.match(ACTIONS, /positive_points: 0/);
  assert.match(ACTIONS, /status: "enrolled", student_id: st\.id/);
  // gender check constraint: nam/nu lowercase - normalize khi import
  assert.match(ACTIONS, /normGender/);
});
