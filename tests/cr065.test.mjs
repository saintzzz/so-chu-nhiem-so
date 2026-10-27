// CR-065: lms-lite - HS lam bai trac nghiem truc tuyen.
// Static-contract checks: module flag, route guards, RPC hardening,
// khong lo dap an ra client, conventions VN.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");

test("AC-65.1: lms_lite la module doc lap, nav gan flag", () => {
  const mods = read("src/lib/modules.ts");
  assert.match(mods, /key: "lms_lite"/);
  const nav = read("src/lib/nav.ts");
  assert.match(nav, /"Bài tập trực tuyến", href: "\/lms", module: "lms_lite"/);
});

test("AC-65.2: lms layout requireRoles + requireModule", () => {
  const layout = read("src/app/(app)/lms/layout.tsx");
  assert.match(layout, /requireRoles\(\[/);
  assert.match(layout, /requireModule\("lms_lite"\)/);
});

test("AC-65.3: start_attempt khong tra dap an cho HS", () => {
  const m = read("supabase/migrations/20261240_cr065_lms_lite.sql");
  const g = read("supabase/migrations/20261241_cr065_lms_grants.sql");
  // column-grant: questions (chua 'correct') khong doc duoc truc tiep
  assert.match(g, /revoke all on public\.lms_sessions from authenticated, anon/);
  const grant = g.match(/grant select \(([^)]*)\)\s*on public\.lms_sessions/);
  assert.ok(grant, "select column grant ton tai");
  assert.ok(!grant[1].includes("questions"), "questions khong duoc grant");
  assert.match(g, /revoke insert, update, delete on public\.lms_submissions/);
  const fn = m.slice(m.indexOf("function public.lms_start_attempt"), m.indexOf("function public.lms_submit_attempt"));
  // phai strip khoi 'correct' khi tra cau hoi
  assert.match(fn, /el\.value - 'correct'/);
  // khong tra truong nao khac chua dap an
  assert.doesNotMatch(fn, /'correct',/);
  assert.match(fn, /not_open/);
  assert.match(fn, /already_submitted/);
  assert.match(fn, /forbidden/);
});

test("AC-65.4: submit cham server-side + deadline + nop mot lan", () => {
  const m = read("supabase/migrations/20261240_cr065_lms_lite.sql");
  const fn = m.slice(m.indexOf("function public.lms_submit_attempt"));
  assert.match(fn, /for update/);
  assert.match(fn, /already_submitted/);
  assert.match(fn, /time_expired/);
  // TF4 cham ty le CV7991
  assert.match(fn, /when 1 then 0\.1 when 2 then 0\.25 when 3 then 0\.5 when 4 then 1/);
  assert.match(fn, /essay_pending/);
  // mot HS mot bai
  assert.match(m, /unique \(session_id, student_id\)/);
});

test("AC-65.5: module flag kiem o moi RPC + write policy", () => {
  const m = read("supabase/migrations/20261240_cr065_lms_lite.sql");
  assert.match(m, /lms_module_enabled/);
  const rpcBodies = m.match(/module_disabled/g) ?? [];
  assert.ok(rpcBodies.length >= 4, `can >=4 cho module_disabled, co ${rpcBodies.length}`);
  assert.match(m, /lms_sessions_write[\s\S]*lms_module_enabled\(school_id\)/);
});

test("AC-65.6: actions chan role + UI sach convention", () => {
  const act = read("src/app/(app)/lms/actions.ts");
  assert.match(act, /checkActionRole/);
  assert.match(act, /assertModule\("lms_lite"\)/);
  const stu = read("src/app/portal/student/actions.ts");
  assert.match(stu, /checkActionRole\(\["hoc_sinh"\]\)/);
  const dir = join(root, "src/components/lms");
  for (const f of readdirSync(dir)) {
    const src = readFileSync(join(dir, f), "utf8");
    assert.ok(!/[—–]/.test(src), `${f} chua em/en dash`);
    assert.ok(!/<textarea/.test(src), `${f} dung textarea tho`);
  }
});
