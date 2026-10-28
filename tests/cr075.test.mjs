// CR-075 static: y_te_bhyt module contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mig = readFileSync("supabase/migrations/20261256_cr075_y_te_bhyt.sql", "utf8");
const page = readFileSync("src/app/(app)/school/health/page.tsx", "utf8");
const actions = readFileSync("src/app/(app)/school/health/actions.ts", "utf8");
const nav = readFileSync("src/lib/nav.ts", "utf8");
const modules = readFileSync("src/lib/modules.ts", "utf8");

test("migration: tables + RLS + RPC + gate", () => {
  for (const s of [
    "create table public.yt_health_records",
    "create table public.yt_bhyt_cards",
    "unique (school_id, student_id)",
    "yt_module_enabled",
    "enable row level security",
    "yt_can_read",
    "raise exception 'forbidden'",
    "raise exception 'module_disabled'",
    "raise exception 'invalid_student'",
    "cross_tenant",
    "yt_tenant_guard",
  ]) assert.ok(mig.includes(s), `missing ${s}`);
  assert.ok(!mig.includes("create policy yt_health_write"), "no direct write policy");
  assert.match(mig, /grant execute on function public\.yt_upsert_health.*to authenticated/);
  // r1: revoke DML + gvcn bound to school + student-school integrity
  assert.ok(mig.includes("revoke insert, update, delete on public.yt_health_records"));
  assert.ok(mig.includes("revoke insert, update, delete on public.yt_bhyt_cards"));
  assert.ok(mig.includes("and c.school_id = p_school"), "gvcn branch tenant-bound");
  assert.ok(mig.includes("cross_tenant_student"), "student-school integrity guard");
});

test("page: roles + module gate + must() + least-data", () => {
  assert.match(page, /requireRoles\(\["bgh", "admin", "pht", "gvcn"\]\)/);
  assert.ok(page.includes('requireModule("y_te_bhyt")'));
  assert.ok(page.includes('must('));
  assert.ok(page.includes(".eq(\"school_id\""));
  assert.ok(!page.includes('.order("full_name")'), "no raw full_name sort");
  assert.ok(page.includes('.in("student_id", studentIds)'), "per-class fetch");
});

test("actions: role check + module assert + rpc", () => {
  assert.ok(actions.includes('checkActionRole(["bgh", "admin"])'));
  assert.ok(actions.includes('assertModule("y_te_bhyt")'));
  assert.ok(actions.includes('"yt_upsert_health"') && actions.includes('"yt_upsert_bhyt"'));
});

test("nav + registry + suite", () => {
  assert.ok(nav.includes('"/school/health"'));
  assert.ok(modules.includes('"y_te_bhyt"'));
  assert.ok(modules.includes('"y_te_bhyt", "van_hanh_nang_cao"'));
  assert.ok(!page.includes("\u2014") && !page.includes("\u2013"), "no em/en dash");
});
