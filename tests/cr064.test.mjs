import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");

// AC-64.1: khoan_thu module registered + nav tagged.
test("AC-64.1: khoan_thu la module doc lap, nav gan flag", () => {
  const modules = read("src/lib/modules.ts");
  assert.match(modules, /key:\s*"khoan_thu"/);
  const nav = read("src/lib/nav.ts");
  assert.match(nav, /module:\s*"khoan_thu"/);
  assert.match(nav, /\/finance\/items/);
  assert.match(nav, /\/finance\/periods/);
  assert.match(nav, /\/finance\/invoices/);
  assert.match(nav, /\/finance\/reports/);
});

// AC-64.2: route guards - layout chan role + module, page chan role.
test("AC-64.2: finance layout requireRoles + requireModule", () => {
  const layout = read("src/app/(app)/finance/layout.tsx");
  assert.match(layout, /requireRoles\(\[.*"ke_toan".*"bgh".*"admin".*"so_gd"/);
  assert.match(layout, /requireModule\("khoan_thu"\)/);
  for (const p of ["items", "periods", "invoices", "reports"]) {
    const src = read(`src/app/(app)/finance/${p}/page.tsx`);
    assert.match(src, /requireRoles\(\[.*"ke_toan"/, `${p} thieu role guard`);
  }
});

// AC-64.3: server actions chan role + module truoc moi mutation.
test("AC-64.3: finance actions chan role + module + RPC atomic", () => {
  const a = read("src/app/(app)/finance/actions.ts");
  assert.match(a, /\["ke_toan",\s*"bgh",\s*"admin"\]/);
  assert.match(a, /checkActionRole\(ROLES\)/);
  assert.match(a, /assertModule\("khoan_thu"\)/);
  assert.match(a, /rpc\("fee_issue_period"/);
  assert.match(a, /rpc\("fee_collect"/);
});

// AC-64.4: migration - bang + RLS + RPC + parent scope.
test("AC-64.4: migration fee_* co RLS tenant + parent view + RPC", () => {
  const m = read("supabase/migrations/20261234_cr064_fees.sql");
  for (const t of ["fee_items", "fee_registrations", "fee_exemptions", "fee_periods", "fee_invoices", "fee_payments"]) {
    assert.match(m, new RegExp(`create table if not exists public\\.${t}`), `thieu bang ${t}`);
    assert.match(m, new RegExp(`alter table public\\.${t} enable row level security`), `${t} chua bat RLS`);
  }
  assert.match(m, /school_id = \(select my_school_id\(\)\)/);
  assert.match(m, /pa\.profile_id = \(select auth\.uid\(\)\)/);
  assert.match(m, /fee_issue_period/);
  assert.match(m, /fee_collect/);
  assert.match(m, /for update/); // lock invoice khi thu tien
  assert.match(m, /on conflict \(period_id, student_id\) do nothing/); // idempotent issue
});

// AC-64.5: UI - khong em/en dash trong copy VN, khong textarea tho.
test("AC-64.5: finance UI sach convention", () => {
  const dir = join(root, "src/components/finance");
  for (const f of readdirSync(dir)) {
    const src = readFileSync(join(dir, f), "utf8");
    assert.ok(!/[\u2014\u2013]/.test(src), `${f} chua em/en dash`);
    assert.ok(!/<textarea/.test(src), `${f} dung textarea tho`);
  }
});
