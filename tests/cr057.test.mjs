// CR-057 coverage - scalability hardening: RLS auth.uid() wrap +
// index/search_path/EXECUTE-revoke/extension fixes.
// Chay: node --test tests/cr057.test.mjs
// Live-DB verification (bare_qual=0, InitPlan, functional role check) is
// recorded in docs/project/CR-057-scalability-hardening.md - these tests
// are static guards so the artifacts cannot silently regress.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const WRAP = read("supabase/migrations/20261025_cr057_rls_auth_uid_wrap.sql");
const HARD = read("supabase/migrations/20261025_cr057_scalability_hardening.sql");
const SNAP = read("docs/project/CR-057-pg_policies-snapshot.json");
const CR = read("docs/project/CR-057-scalability-hardening.md");

test("AC-57.1: moi auth.uid() trong policy alters deu la (select auth.uid())", () => {
  const bare = WRAP.match(/(?<!\(select )auth\.uid\(\)/g) ?? [];
  assert.equal(bare.length, 0, `${bare.length} bare auth.uid() con lai`);
});

test("AC-57.2: migration files + snapshot ton tai va tai tao duoc", () => {
  assert.ok((WRAP.match(/ALTER POLICY/g) ?? []).length >= 30);
  const snap = JSON.parse(SNAP);
  assert.ok(Array.isArray(snap) && snap.length >= 300, "snapshot policies");
  assert.match(HARD, /cr057/i);
});

test("AC-57.3: CR doc ghi nhan EXPLAIN/InitPlan verification", () => {
  assert.match(CR, /InitPlan/);
  assert.match(CR, /ANALYZE/);
});

test("AC-57.4: functional verify authenticated role duoc ghi lai", () => {
  assert.match(CR, /my_roles\(\)/);
  assert.match(CR, /anon_sd_exec=0/);
});

test("AC-57.5: security advisor fixes nam trong migration", () => {
  for (const re of [
    /set search_path = ''/g,
    /revoke execute on function/i,
    /grant execute on function .* to authenticated, service_role/i,
    /alter extension pg_trgm set schema extensions/i,
  ]) {
    assert.match(HARD, re);
  }
  // sf_login_* bi loai tru (pre-auth login flow)
  assert.match(HARD, /sf_login_attempt/);
});
