// CR-070: dieu dong GV gan timetable_entry - static contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const M = read("supabase/migrations/20261254_cr070_dieu_dong.sql");
const DOC = read("docs/project/CR-070-dieu-dong-tkb.md");

test("AC-70.1: CR doc + module key + nav", () => {
  assert.match(DOC, /overlay|timetable_entries/i);
  assert.match(read("src/lib/modules.ts"), /key: "dieu_dong"/);
  assert.match(read("src/lib/nav.ts"), /href: "\/schedule\/mobilization", module: "dieu_dong"/);
});

test("AC-70.2: schema - dd_assignments overlay + RLS + tenant", () => {
  assert.match(M, /create table public\.dd_assignments/);
  assert.match(M, /timetable_entry_id uuid not null references public\.timetable_entries/);
  assert.match(M, /check \(status in \('pending','active','ended','cancelled'\)\)/);
  assert.match(M, /cross_school_entry/);
  assert.match(M, /invalid_teacher/);
  assert.match(M, /dd_module_enabled\(school_id\)/);
  assert.match(M, /teacher_id = auth\.uid\(\)/);
  assert.match(M, /revoke insert, update, delete on public\.dd_assignments/);
});

test("AC-70.3: overlap + state machine + notify + resolution", () => {
  assert.match(M, /overlapping_assignment/);
  assert.match(M, /for update of e/, "lock entry serialize overlap");
  const ap = M.slice(M.indexOf("function public.dd_approve"), M.indexOf("$$;", M.indexOf("function public.dd_approve")));
  assert.match(ap, /dd_assert_no_overlap/, "recheck overlap khi duyet");
  assert.match(ap, /insert into public\.notifications/, "notify GV duoc dieu dong");
  const end = M.slice(M.indexOf("function public.dd_end"), M.indexOf("$$;", M.indexOf("function public.dd_end")));
  assert.match(end, /status = 'active'/, "end chi tren active");
  assert.match(M, /function public\.dd_effective_teacher\(p_entry uuid, p_date date\)/);
  for (const fn of ["dd_create(uuid, uuid, date, date, text)", "dd_approve(uuid)", "dd_end(uuid)", "dd_cancel(uuid)"]) {
    assert.match(M, new RegExp(`revoke all on function public\\.${fn.replace("(", "\\(").replace(")", "\\)")} from public, anon`));
  }
});

test("AC-70.4: app layer - guard + must + UI", () => {
  const AC = read("src/app/(app)/schedule/mobilization/actions.ts");
  assert.match(AC, /checkActionRole\(ROLES\)/);
  assert.match(AC, /assertModule\("dieu_dong"\)/);
  const PG = read("src/app/(app)/schedule/mobilization/page.tsx");
  assert.match(PG, /requireRoles\(\["bgh", "admin", "pht"\]\)/);
  assert.match(PG, /requireModule\("dieu_dong"\)/);
  const BD = read("src/components/mobilization/board.tsx");
  assert.doesNotMatch(BD, /—|–/);
  assert.match(BD, /relative overflow-x-auto/);
});
