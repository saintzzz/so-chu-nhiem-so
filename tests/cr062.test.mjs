// CR-062 coverage - tuyen sinh dau cap (module tuyen_sinh).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const MIG = read("supabase/migrations/20261228_cr062_admissions.sql");
const MIG2 = read("supabase/migrations/20261229_cr062_admissions_rpcs.sql");
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
  // r-adm1: write policy sieu lai - so_gd chi read, write thuoc bgh/pht/admin
  assert.match(MIG2, /drop policy if exists adm_app_write/);
  assert.doesNotMatch(
    MIG2.match(/create policy adm_app_write[\s\S]*?\);/)?.[0] ?? "",
    /so_gd/,
    "write policy khong duoc con so_gd",
  );
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

test("AC-62.5 (static): enroll qua RPC atomic + retry-safe + cung truong", () => {
  assert.match(ACTIONS, /\.rpc\("admission_enroll"/);
  assert.match(MIG2, /create or replace function public\.admission_enroll/);
  // retry-safe: find-or-create + CAS link
  assert.match(MIG2, /s\.national_id is not distinct from v_app\.id_number/);
  assert.match(MIG2, /status in \('approved', 'passed'\)\s+and student_id is null/);
  // campaign + class phai cung truong
  assert.match(MIG2, /raise exception 'school_mismatch'/);
  assert.match(ACTIONS, /Lớp đích và đợt tuyển không cùng trường/);
  // students: day du cot bat buoc theo schema that
  assert.match(MIG2, /national_id, status, positive_points/);
  // gender check constraint: nam/nu lowercase - normalize khi import
  assert.match(ACTIONS, /normGender/);
});

test("AC-62.6 (static): finalize qua RPC - chan thieu diem + quota cutoff", () => {
  assert.match(ACTIONS, /\.rpc\("admission_finalize"/);
  assert.match(MIG2, /raise exception 'missing_scores:%', v_missing/);
  // quota > benchmark: cutoff hieu luc theo hang quota, dong diem deu do
  assert.match(MIG2, /order by total_score desc, full_name, id/);
  assert.match(MIG2, /offset greatest\(v_quota - 1, 0\)/);
});

test("AC-62.7 (static): cap SBD qua RPC advisory lock - khong race", () => {
  assert.match(ACTIONS, /\.rpc\("admission_assign_exam_numbers"/);
  assert.match(MIG2, /pg_advisory_xact_lock\(hashtext\('adm_sbd_/);
  assert.match(MIG2, /row_number\(\) over \(order by full_name, id\)/);
});

test("AC-62.8 (static): score validation reject thay vi drop + CAS no-op", () => {
  assert.match(ACTIONS, /không hợp lệ \(0-10\)/);
  assert.match(ACTIONS, /Thiếu điểm môn:/);
  assert.match(ACTIONS, /Hồ sơ đã đổi trạng thái - tải lại trang/);
});
