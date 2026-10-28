// CR-067: bien dong hoc sinh - static contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const M = read("supabase/migrations/20261246_cr067_bien_dong_hs.sql");
const DOC = read("docs/project/CR-067-bien-dong-hs.md");

test("AC-67.1: CR doc + module key + nav 2 vai tro", () => {
  assert.match(DOC, /chuyen/i);
  const MOD = read("src/lib/modules.ts");
  assert.match(MOD, /key: "bien_dong_hs"/);
  const NAV = read("src/lib/nav.ts");
  assert.ok((NAV.match(/href: "\/movements"/g) ?? []).length >= 2, "nav cho gvcn + bgh");
});

test("AC-67.2: schema sm_requests + status check + tenant trigger", () => {
  assert.match(M, /create table public\.sm_requests/);
  assert.match(M, /check \(type in \('transfer_out','transfer_in','reserve','return'\)\)/);
  assert.match(M, /check \(status in \('pending','approved','rejected','cancelled'\)\)/);
  assert.match(M, /'reserved'/); // status students mo rong
  assert.match(M, /cross_school_student/);
  assert.match(M, /cross_school_class/);
  assert.match(M, /sm_req_read on public\.sm_requests/);
  assert.match(M, /sm_module_enabled\(school_id\)/);
  assert.match(M, /revoke insert, update, delete on public\.sm_requests/);
});

test("AC-67.3: RPC guard - role + module + state transitions", () => {
  for (const fn of ["sm_create", "sm_decide", "sm_cancel"]) {
    const body = M.slice(M.indexOf(`function public.${fn}`), M.indexOf("$$;", M.indexOf(`function public.${fn}`)));
    assert.match(body, /sm_module_enabled/, `${fn} check module`);
    assert.match(body, /forbidden/, `${fn} check role`);
  }
  const decide = M.slice(M.indexOf("function public.sm_decide"));
  assert.match(decide, /status = 'transferred'/);
  assert.match(decide, /status = 'reserved'/);
  assert.match(decide, /set status = 'active', class_id = coalesce/);
  assert.match(decide, /pg_advisory_xact_lock\(hashtext\('sm_code'\)\)/);
  assert.match(decide, /student_record_history/);
  assert.match(decide, /public\.notifications/);
  assert.match(decide, /not_pending/);
  const create = M.slice(M.indexOf("function public.sm_create"), M.indexOf("function public.sm_decide"));
  assert.match(create, /gvcn_id <> auth\.uid\(\)/);
  assert.match(create, /pending_exists/);
  assert.match(create, /v_st\.status <> 'active'/);
  assert.match(create, /v_st\.status <> 'reserved'/);
  assert.match(create, /payload_incomplete/);
});

test("AC-67.4: grants - mutating RPC revoke public/anon, grant authenticated", () => {
  for (const fn of ["sm_create", "sm_decide", "sm_cancel"]) {
    assert.ok(new RegExp(`revoke all on function public\\.${fn}\\(`).test(M), `${fn} revoke`);
    assert.ok(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated`).test(M), `${fn} grant`);
  }
});

test("AC-67.5: app layer - route guard + actions + UI conventions", () => {
  const LAY = read("src/app/(app)/movements/layout.tsx");
  assert.match(LAY, /requireRoles\(\["gvcn", "bgh", "admin"\]\)/);
  assert.match(LAY, /requireModule\("bien_dong_hs"\)/);
  const ACT = read("src/app/(app)/movements/actions.ts");
  assert.match(ACT, /assertModule\("bien_dong_hs"\)/);
  assert.match(ACT, /checkActionRole/);
  const PG = read("src/app/(app)/movements/page.tsx");
  assert.match(PG, /\.eq\("school_id", profile\.school_id\)/);
  assert.match(PG, /gvcn_id === profile\.id/);
  const BD = read("src/components/movements/requests-board.tsx");
  assert.match(BD, /AutoGrowTextarea/);
  assert.match(BD, /fmtDateVN/);
  assert.doesNotMatch(BD, /—|–/);
  assert.doesNotMatch(BD, /Date\.now\(\)/);
});
