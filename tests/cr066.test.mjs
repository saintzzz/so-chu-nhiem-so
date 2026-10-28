// CR-066: thu_vien - danh muc + DKCB + muon/tra.
// Static-contract checks: module flag, route guards, RPC hardening,
// revoke ghi truc tiep, borrower XOR, conventions VN.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8").replaceAll(String.fromCharCode(13,10), String.fromCharCode(10));
const M = read("supabase/migrations/20261244_cr066_thu_vien.sql");

test("AC-66.1: thu_vien la module doc lap, nav gan flag", () => {
  const mods = read("src/lib/modules.ts");
  assert.match(mods, /key: "thu_vien"/);
  const nav = read("src/lib/nav.ts");
  assert.match(nav, /"Thư viện", href: "\/library", module: "thu_vien"/);
  assert.match(nav, /"Mượn & trả sách", href: "\/library\/loans", module: "thu_vien"/);
});

test("AC-66.1b: layout requireRoles + requireModule", () => {
  const layout = read("src/app/(app)/library/layout.tsx");
  assert.match(layout, /requireRoles\(\["bgh", "admin"\]\)/);
  assert.match(layout, /requireModule\("thu_vien"\)/);
});

test("AC-66.2: DKCB atomic per truong - seq + advisory lock + unique", () => {
  assert.match(M, /create table if not exists public\.lib_accession_seq/);
  assert.match(M, /pg_advisory_xact_lock/);
  assert.match(M, /unique \(school_id, accession_no\)/);
});

test("AC-66.3: checkout atomic anti double-loan + return cap nhat copy", () => {
  const fn = M.slice(
    M.indexOf("function public.lib_checkout"),
    M.indexOf("function public.lib_return"),
  );
  assert.match(fn, /update public\.lib_copies set status = 'on_loan'/);
  assert.match(fn, /and status = 'available'/);
  assert.match(fn, /not_available/);
  assert.match(fn, /borrower_xor/);
  const rf = M.slice(M.indexOf("function public.lib_return"));
  assert.match(rf, /already_returned/);
  assert.match(rf, /and returned_at is null/);
  assert.match(rf, /when 'ok' then 'available'/);
});

test("AC-66.4: cross-tenant chan o trigger + RPC + borrower XOR constraint", () => {
  assert.match(M, /cross_school_book/);
  assert.match(M, /cross_school_copy/);
  assert.match(M, /cross_school_student/);
  assert.match(M, /cross_school_teacher/);
  assert.match(M, /check \(\(student_id is not null\)::int \+ \(teacher_id is not null\)::int = 1\)/);
  // 1 copy 1 loan mo
  assert.match(M, /unique index if not exists lib_loans_open_copy[\s\S]*where returned_at is null/);
});

test("AC-66.5: module flag o moi RPC + write policy + revoke ghi truc tiep", () => {
  const n = M.match(/module_disabled/g) ?? [];
  assert.ok(n.length >= 4, `can >=4 cho module_disabled, co ${n.length}`);
  // helper cap DKCB khong expose qua PostgREST (can PUBLIC grant mac dinh)
  assert.match(M, /revoke all on function public\.lib_next_accessions\(uuid, int\) from public, authenticated, anon/);
  assert.match(M, /lib_books_write[\s\S]*lib_module_enabled\(school_id\)/);
  assert.match(M, /revoke insert, update, delete on public\.lib_copies from authenticated, anon/);
  assert.match(M, /revoke insert, update, delete on public\.lib_loans from authenticated, anon/);
  // HS chi doc loan cua minh
  assert.match(M, /lib_loans_read[\s\S]*st\.profile_id = auth\.uid\(\)/);
});

test("AC-66.7 r1: hardening - revoke PUBLIC, restrict FK, checks, flag o read", () => {
  const R = read("supabase/migrations/20261245_cr066_lib_r1.sql");
  assert.match(R, /on delete restrict/);
  assert.match(R, /lib_books_title_nn check \(btrim\(title\) <> ''\)/);
  assert.match(R, /revoke all on function public\.lib_checkout[\s\S]*from public, anon/);
  assert.match(R, /revoke all on function public\.lib_return[\s\S]*from public, anon/);
  // read policies gan module flag
  assert.match(R, /lib_books_read[\s\S]*lib_module_enabled\(school_id\)/);
  assert.match(R, /lib_loans_read[\s\S]*lib_module_enabled\(school_id\)/);
  // return: copy update kem school + on_loan
  const rf = R.slice(R.indexOf("function public.lib_return"));
  assert.match(rf, /and school_id = v_school and status = 'on_loan'/);
  assert.match(rf, /copy_state_conflict/);
  // checkout: validate borrower TRUOC khi doi copy
  const cf = R.slice(R.indexOf("function public.lib_checkout"), R.indexOf("function public.lib_return"));
  const iVal = cf.indexOf("if p_student is not null");
  const iUpd = cf.indexOf("set status = 'on_loan'");
  assert.ok(iVal > 0 && iUpd > iVal, "borrower validate phai truoc copy update");
});

test("AC-66.6: actions chan role + UI sach convention + portal gan flag", () => {
  const act = read("src/app/(app)/library/actions.ts");
  assert.match(act, /checkActionRole/);
  assert.match(act, /assertModule\("thu_vien"\)/);
  const portal = read("src/app/portal/student/page.tsx");
  assert.match(portal, /lib_module_enabled/);
  assert.match(portal, /Sách đang mượn/);
  const dir = join(root, "src/components/library");
  for (const f of readdirSync(dir)) {
    const src = readFileSync(join(dir, f), "utf8");
    assert.ok(!/[—–]/.test(src), `${f} chua em/en dash`);
    assert.ok(!/<textarea/.test(src), `${f} dung textarea tho`);
  }
});
