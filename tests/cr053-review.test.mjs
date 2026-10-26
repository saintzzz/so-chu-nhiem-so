// External review r-hb1 fixes: static guards cho write-boundary hoc ba.
// Chay: node --test tests/cr053-review.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const mig = read("supabase/migrations/20261226_cr053_review_fixes.sql");
const actions = read("src/app/(app)/records/hoc-ba/actions.ts");
const pdf = read("src/lib/hocba-pdf.ts");
const explorer = read("src/components/records/hoc-ba-explorer.tsx");

test("F1: insert policy chi cho phep status draft", () => {
  const m = mig.match(/create policy yed_gvcn_ins[\s\S]*?with check \(([\s\S]*?)\);/);
  assert.ok(m, "policy yed_gvcn_ins phai ton tai trong migration");
  assert.match(m[1], /status = 'draft'/);
  assert.doesNotMatch(m[1], /'submitted'/);
});

test("F2: trigger bat buoc du truong phap ly khi submitted", () => {
  assert.match(mig, /new\.status = 'submitted'/);
  for (const f of ["new.kqht is null", "new.kqrl is null", "new.promotion is null", "new.computed_snapshot is null"]) {
    assert.ok(mig.includes(f), `trigger thieu check ${f}`);
  }
});

test("F2: action tu choi submit thieu truong", () => {
  assert.match(actions, /submit && \(!input\.kqht \|\| !input\.kqrl \|\| !input\.promotion\)/);
});

test("F1: action insert luon draft - submit di qua UPDATE", () => {
  const insertBlock = actions.match(/\.insert\(payload\)/);
  assert.ok(insertBlock, "phai con insert(payload)");
  assert.match(actions, /status: "draft",\s*\n\s*\};/);
  assert.match(actions, /status: "submitted"/);
});

test("F1: approve tinh lai tu nguon va chan lech khong can cu", () => {
  const start = actions.indexOf("export async function approveYearEnd");
  const approve = actions.slice(start, actions.indexOf("\nexport ", start + 1));
  assert.match(approve, /getStudentYearEndBundle/);
  assert.match(approve, /override_legal_ground/);
  assert.match(approve, /deviates/);
});

test("F4: pdf pageBreak tren phan tu dau block, khong dat truoc nhan nhap", () => {
  assert.match(pdf, /block\[0\]\.pageBreak = "before"/);
  assert.doesNotMatch(pdf, /pageBreak: "before" as const \} : \{\}/);
});

test("r-hb2 F1: trigger bat can cu phap ly cho submitted co mon mien", () => {
  assert.match(mig, /array_length\(new\.exempt_subject_ids/);
  assert.match(mig, /exempt subjects requires legal ground and note/);
});

test("r-hb2 F1: approve chan doc lap quyet dinh co mien khong can cu", () => {
  const start = actions.indexOf("export async function approveYearEnd");
  const approve = actions.slice(start, actions.indexOf("\nexport ", start + 1));
  assert.match(approve, /cur\.exempt_subject_ids\?\.length/);
});

test("r-hb2 F2: snapshot tinh theo tap mien incoming khong phai persisted", () => {
  assert.match(actions, /input\.exemptSubjectIds,\s*\n?\s*\)/);
  const hocba = read("src/lib/hocba.ts");
  assert.match(hocba, /exemptOverride\?: string\[\]/);
  assert.match(hocba, /exemptOverride \?\?/);
});

test("r-hb3: trigger chan approve lech snapshot khong can cu + ghi audit", () => {
  assert.match(mig, /tg_op = 'UPDATE' and old\.status = 'submitted' and new\.status = 'approved'/);
  assert.match(mig, /deviating from snapshot or exempting subjects requires legal ground/);
  assert.match(mig, /insert into public\.audit_logs/);
  assert.match(mig, /'hoc_ba\.approve'/);
});

test("r-hb4: approve-guard so sanh danh_hieu voi snapshot danhHieu", () => {
  assert.match(mig, /snapshot ->> 'danhHieu'\) is distinct from new\.danh_hieu/);
});

test("r-hb4: exempt resolution authoritative theo decision active", () => {
  const hocba = read("src/lib/hocba.ts");
  const exemptBlock = hocba.match(/const exempt =\s*\n?\s*exemptOverride \?\?[\s\S]*?\[\];/);
  assert.ok(exemptBlock, "phai co khoi exempt resolution trong bundleFor");
  // mang cua decision cuoi (stage active) as-is - ke ca khi rong
  assert.match(exemptBlock[0], /decisions\[decisions\.length - 1\]\?\.exempt_subject_ids/);
});

test("r-hb4: createNextStage ke thua tap mien quyet dinh truoc", () => {
  const start = actions.indexOf("export async function createNextStage");
  const fn = actions.slice(start, actions.indexOf("\nexport ", start + 1));
  assert.match(fn, /exempt_subject_ids: prev\?\.exempt_subject_ids \?\? \[\]/);
  assert.match(fn, /\.select\("exempt_subject_ids"\)/);
});

test("r-hb4: action khong ghi trung audit hoc_ba.approve (trigger da ghi)", () => {
  const start = actions.indexOf("export async function approveYearEnd");
  const fn = actions.slice(start, actions.indexOf("\nexport ", start + 1));
  assert.doesNotMatch(fn, /logAudit\(\s*supabase,\s*\{\s*action: "hoc_ba\.approve"/);
});

test("F3: form co exemption editor va bat can cu khi doi tap mien", () => {
  assert.match(explorer, /Môn miễn đánh giá/);
  assert.match(explorer, /exemptChanged/);
  assert.match(explorer, /exemptSubjectIds: effExempt/);
});
