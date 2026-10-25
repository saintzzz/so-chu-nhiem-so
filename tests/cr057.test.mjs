// CR-057 coverage - scalability hardening: RLS auth.uid() wrap +
// index/search_path/EXECUTE-revoke/extension fixes.
// Chay: node --test tests/cr057.test.mjs
// Live-DB verification (bare_qual=0, InitPlan, functional role check) is
// recorded in docs/project/CR-057-scalability-hardening.md - these tests
// guard the artifacts: reproducibility, ordering, and snapshot coverage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const WRAP = read("supabase/migrations/20261224_cr057_rls_auth_uid_wrap.sql");
const HARD = read("supabase/migrations/20261225_cr057_scalability_hardening.sql");
const RB2 = read("docs/project/CR-057-rollback-part2.sql");
const SNAP = JSON.parse(read("docs/project/CR-057-pg_policies-snapshot.json"));
const CR = read("docs/project/CR-057-scalability-hardening.md");

test("AC-57.1: moi auth.uid() trong policy alters deu la (select auth.uid())", () => {
  // bo qua comment lines - chi quet SQL statements
  const sql = WRAP.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const bare = sql.match(/(?<!\(select )auth\.uid\(\)/g) ?? [];
  assert.equal(bare.length, 0, `${bare.length} bare auth.uid() con lai`);
});

test("AC-57.1b: moi altered policy deu nam trong snapshot (rollback-able)", () => {
  const snapKeys = new Set(SNAP.map((p) => `${p.schemaname}.${p.tablename}.${p.policyname}`));
  const altered = [...WRAP.matchAll(/ALTER POLICY "([^"]+)" ON (\w+)\."(\w+)"/g)]
    .map((m) => `${m[2]}.${m[3]}.${m[1]}`);
  assert.ok(altered.length >= 30, `chi ${altered.length} ALTER statements`);
  const missing = altered.filter((k) => !snapKeys.has(k));
  assert.deepEqual(missing, [], "policy khong co trong snapshot");
});

test("AC-57.2: migration version sort SAU dependencies", () => {
  const files = readdirSync(join(ROOT, "supabase/migrations")).sort();
  const wrapIdx = files.indexOf("20261224_cr057_rls_auth_uid_wrap.sql");
  const hardIdx = files.indexOf("20261225_cr057_scalability_hardening.sql");
  assert.ok(wrapIdx > -1 && hardIdx > -1, "migration files ton tai");
  // cac bang indexed trong HARD phai duoc tao truoc khi HARD chay
  for (const dep of ["20261124_cr049_digest_outbox.sql", "20261214_cr053_year_end_decisions.sql"]) {
    assert.ok(files.indexOf(dep) > -1 && files.indexOf(dep) < hardIdx,
      `${dep} phai dung truoc hardening migration`);
  }
  // wrap phai dung truoc hardening
  assert.ok(wrapIdx < hardIdx);
});

test("AC-57.2b: rollback part-2 phu dung tap funcs bi revoke (60 funcs)", () => {
  const restores = RB2.match(/GRANT EXECUTE ON FUNCTION/g) ?? [];
  assert.equal(restores.length, 60);
  assert.match(RB2, /reset search_path/);
  assert.match(RB2, /alter extension pg_trgm set schema public/);
  assert.equal((RB2.match(/drop index if exists/g) ?? []).length, 24);
});

test("AC-57.3: CR doc ghi nhan EXPLAIN evidence cho ca 2 query", () => {
  // attendance + grades plans phai duoc ghi lai voi so lieu that
  assert.match(CR, /InitPlan/);
  assert.match(CR, /ANALYZE/);
  assert.match(CR, /idx_grades_year|Bitmap Index Scan/);
  assert.match(CR, /48\.7|323/);
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
  assert.match(HARD, /sf_login_attempt/);
});
