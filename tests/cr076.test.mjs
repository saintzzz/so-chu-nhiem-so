// CR-076 static: van_thu module contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mig = readFileSync("supabase/migrations/20261257_cr076_van_thu.sql", "utf8");
const page = readFileSync("src/app/(app)/school/documents/page.tsx", "utf8");
const actions = readFileSync("src/app/(app)/school/documents/actions.ts", "utf8");
const board = readFileSync("src/components/documents/board.tsx", "utf8");
const nav = readFileSync("src/lib/nav.ts", "utf8");
const modules = readFileSync("src/lib/modules.ts", "utf8");

test("migration: table + RLS + RPC + gate + revoke", () => {
  for (const s of [
    "create table public.vt_documents",
    "unique (school_id, direction, doc_no)",
    "vt_module_enabled",
    "enable row level security",
    "raise exception 'forbidden'",
    "raise exception 'module_disabled'",
    "vt_tenant_guard",
    "cross_tenant",
    "revoke insert, update, delete on public.vt_documents",
  ]) assert.ok(mig.includes(s), `missing ${s}`);
  assert.ok(!mig.includes("create policy vt_docs_write"), "no direct write policy");
  assert.match(mig, /grant execute on function public\.vt_create.*to authenticated/);
});

test("page: roles + module gate + must() + scoped", () => {
  assert.match(page, /requireRoles\(\["bgh", "admin", "pht", "ke_toan"\]\)/);
  assert.ok(page.includes('requireModule("van_thu")'));
  assert.ok(page.includes('must('));
  assert.ok(page.includes('.eq("school_id", sid)'));
  assert.ok(!page.includes("\u2014") && !page.includes("\u2013"), "no em/en dash");
});

test("actions: role check + module assert + rpc + validation", () => {
  assert.ok(actions.includes('checkActionRole(["bgh", "admin"])'));
  assert.ok(actions.includes('assertModule("van_thu")'));
  assert.ok(actions.includes('"vt_create"') && actions.includes('"vt_update"'));
  assert.ok(actions.includes("input.deadline < input.issued"), "deadline check");
});

test("nav + registry + suite + board", () => {
  assert.ok(nav.includes('"/school/documents"'));
  assert.ok(modules.includes('"van_thu"'));
  assert.ok(board.includes("sortByVietnameseName"), "vn name sort");
  assert.ok(board.includes("colSpan={canWrite ? 9 : 8}"), "colspan by canWrite");
  assert.ok(!board.includes("\u2014") && !board.includes("\u2013"), "no em/en dash");
});
