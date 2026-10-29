// CR-077..080 static: contract checks cho wave merge voi remote.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const payMig = readFileSync("supabase/migrations/20261258_cr077_payments.sql", "utf8");
const commMig = readFileSync("supabase/migrations/20261259_cr078_comm_outbox.sql", "utf8");
const mealMig = readFileSync("supabase/migrations/20261260_cr079_bua_an_csvc.sql", "utf8");
const cleanupMig = readFileSync("supabase/migrations/20261261_cr081_reconcile_cleanup.sql", "utf8");
const sepay = readFileSync("src/app/api/webhooks/sepay/route.ts", "utf8");
const vietqr = readFileSync("src/lib/vietqr.ts", "utf8");
const cron = readFileSync("src/app/api/cron/comm-outbox/route.ts", "utf8");
const providers = readFileSync("src/lib/comm/providers.ts", "utf8");
const outbox = readFileSync("src/lib/comm/outbox.ts", "utf8");
const parentsActions = readFileSync("src/app/(app)/parents/actions.ts", "utf8");
const mealActions = readFileSync("src/app/(app)/meals/actions.ts", "utf8");
const schoolActions = readFileSync("src/app/(app)/school/actions.ts", "utf8");
const scheduleExport = readFileSync("src/app/api/schedule/export/route.ts", "utf8");
const byTeacher = readFileSync("src/app/(app)/schedule/by-teacher/page.tsx", "utf8");
const editor = readFileSync("src/components/schedule/timetable-editor.tsx", "utf8");
const nav = readFileSync("src/lib/nav.ts", "utf8");
const modules = readFileSync("src/lib/modules.ts", "utf8");

// --- CR-077 thanh toan ---
test("AC-77.1: payment_code unique + vietqr builder", () => {
  assert.ok(payMig.includes("fee_invoices_payment_code_key"));
  assert.ok(payMig.includes("gen_payment_code"));
  assert.ok(vietqr.includes("export function vietQrUrl"));
  assert.ok(vietqr.includes("VIETQR_BANKS"));
});

test("AC-77.2: webhook fail-closed + atomic RPC", () => {
  assert.ok(sepay.includes("SEPAY_WEBHOOK_API_KEY"));
  assert.match(sepay, /status:\s*401/);
  assert.ok(sepay.includes("fee_record_transfer"), "atomic settle RPC");
  assert.ok(sepay.includes("payment_code"));
});

test("AC-77.3: unmatched txn + manual match RPC", () => {
  assert.ok(payMig.includes("bank_transactions"));
  assert.ok(payMig.includes("fee_match_txn"));
  assert.match(payMig, /match_status|matched/);
});

test("AC-77.4: einvoice skeleton", () => {
  assert.ok(payMig.includes("einvoice_requests"));
});

test("AC-77.5: roles + RLS tenant", () => {
  for (const p of ["si_select", "bt_select", "er_select"])
    assert.ok(payMig.includes(`create policy ${p}`), `missing ${p}`);
  assert.ok(payMig.includes("my_roles()"), "role-gated policies");
  assert.ok(payMig.includes("school_id"), "tenant column");
});

// --- CR-078 comm outbox ---
test("AC-78.1: outbox schema + status + retry", () => {
  for (const s of ["comm_outbox", "dedupe_key", "unique (school_id, dedupe_key)",
    "attempts", "comm_templates", "parent_channel_consents"])
    assert.ok(commMig.includes(s), `missing ${s}`);
  assert.match(commMig, /queued|sending|sent|failed|dead/);
});

test("AC-78.2: cron fail-closed + SKIP LOCKED drain", () => {
  assert.ok(cron.includes("CRON_SECRET"));
  assert.match(cron, /status:\s*401|unauthorized/);
  assert.ok(cron.includes("SKIP LOCKED") || cron.includes("skip locked")
    || outbox.includes("SKIP LOCKED"), "atomic claim");
});

test("AC-78.3: provider fail-closed no credentials", () => {
  assert.ok(providers.includes("ZALO_OA_ACCESS_TOKEN"));
  assert.match(providers, /no_config|no token|missing/i);
  assert.ok(providers.includes("sendSms") && providers.includes("sendZalo"));
  assert.ok(providers.includes("providerTemplateId"), "template id passthrough");
});

test("AC-78.4: announcement fan-out enqueue", () => {
  assert.ok(parentsActions.includes("enqueueClassComm"));
  assert.ok(outbox.includes("enqueueComm"));
  assert.ok(outbox.includes("_providerTemplateId"), "template id in payload");
});

test("AC-78.5: RLS tenant on comm tables", () => {
  assert.ok(commMig.includes("school_id"));
  assert.ok(commMig.includes("enable row level security")
    || commMig.match(/create policy/g)?.length >= 3, "policies present");
});

// --- CR-079 bua an + csvc ---
test("AC-79.1: equipment_issues CRUD + status flow", () => {
  assert.ok(mealMig.includes("equipment_issues"));
  assert.match(mealMig, /open|in_progress|resolved|closed/);
  assert.ok(schoolActions.includes("equipment_issues"));
});

test("AC-79.2: meal_menus unique per (date, meal_type)", () => {
  assert.ok(mealMig.includes("meal_menus"));
  assert.ok(mealMig.includes("unique (school_id, menu_date, meal_type)"));
});

test("AC-79.3: meal_counts unique (class, date, type)", () => {
  assert.ok(mealMig.includes("unique (class_id, menu_date, meal_type)"));
  assert.ok(mealActions.includes("saveMealCount"));
});

test("AC-79.4: module bua_an gate", () => {
  assert.ok(mealActions.includes('assertModule("bua_an")'));
  assert.ok(modules.includes('"bua_an"'));
  assert.ok(nav.includes('"/meals"'));
});

test("AC-79.5: RLS tenant + roles", () => {
  for (const p of ["ei_", "mm_", "mc_", "mr_"])
    assert.ok(mealMig.includes(`create policy ${p}`), `missing ${p}*`);
  assert.ok(mealActions.includes("checkActionRole"));
});

// --- CR-080 TKB nang cao ---
test("AC-80.1: copyTimetable skip existing", () => {
  assert.ok(schoolActions.includes("copyTimetable"));
  assert.match(schoolActions, /copyTimetable[\s\S]{0,3000}skip|skipped/i);
});

test("AC-80.2: teacher cross-class view", () => {
  assert.ok(byTeacher.includes("teacher_id") || byTeacher.includes("giao_vien"));
  assert.ok(nav.includes('"/schedule/by-teacher"'));
});

test("AC-80.3: weekly per-subject counts in editor", () => {
  assert.ok(editor.includes("weeklyCount"));
});

test("AC-80.4: csv export route", () => {
  assert.ok(scheduleExport.includes("export async function GET"));
  assert.ok(scheduleExport.includes("text/csv")
    || scheduleExport.includes(".csv"), "csv response");
});

test("AC-80.5: role guard on copy + export", () => {
  assert.match(schoolActions, /copyTimetable[\s\S]{0,1500}checkActionRole/);
  assert.ok(scheduleExport.includes("requireRoles")
    || scheduleExport.includes("checkActionRole")
    || scheduleExport.includes("getProfile"), "role gate");
});

// --- CR-081 reconcile cleanup ---
test("CR-081: cleanup drops superseded tables", () => {
  for (const t of ["hocba_xml_exports", "school_signing_keys",
    "health_incidents", "health_checkups", "student_health_profiles"])
    assert.ok(cleanupMig.includes(`drop table if exists public.${t}`), t);
});
