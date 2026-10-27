import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mig = readFileSync(
  "supabase/migrations/20261231_cr063_public_apply.sql",
  "utf8",
);
const proxy = readFileSync("src/proxy.ts", "utf8");
const api = readFileSync("src/app/api/admissions/apply/route.ts", "utf8");
const page = readFileSync("src/app/apply/[id]/page.tsx", "utf8");
const form = readFileSync("src/app/apply/[id]/apply-form.tsx", "utf8");
const board = readFileSync("src/components/school/admissions-board.tsx", "utf8");

test("AC-63.1: tracking_code + unique index + dedupe id_number", () => {
  assert.match(mig, /tracking_code text/);
  assert.match(mig, /unique index.*adm_app_tracking/s);
  assert.match(mig, /unique index.*adm_app_id_number/s);
});

test("AC-63.2: apply RPC kiem open + module flag + definer", () => {
  const fn = mig.slice(mig.indexOf("admission_apply_public"));
  assert.match(fn, /security definer/);
  assert.match(fn, /status <> 'open'/);
  assert.match(fn, /module = 'tuyen_sinh' and f\.enabled = false/);
  assert.match(fn, /'submitted', v_code/);
});

test("AC-63.3: track RPC chi lo status + campaign", () => {
  const fn = mig.slice(mig.indexOf("admission_track"));
  assert.match(fn, /jsonb_build_object\(\s*'status'/);
  assert.doesNotMatch(fn, /parent_phone|id_number|address/);
});

test("AC-63.4: anon chi qua RPC - grant execute 3 fn", () => {
  assert.match(mig, /grant execute on function public\.admission_campaign_info/);
  assert.match(mig, /grant execute on function public\.admission_apply_public/);
  assert.match(mig, /grant execute on function public\.admission_track/);
  assert.doesNotMatch(mig, /grant insert.*admission_applications to anon/i);
});

test("AC-63.5: proxy whitelist /apply + api", () => {
  assert.match(proxy, /startsWith\("\/apply\/"\)/);
  assert.match(proxy, /"\/api\/admissions\/apply"/);
});

test("AC-63.6: API co honeypot + turnstile + err map", () => {
  assert.match(api, /body\.website/);
  assert.match(api, /siteverify/);
  assert.match(api, /campaign_not_open/);
  assert.match(api, /module_disabled/);
  assert.match(api, /adm_app_id_number/);
});

test("AC-63.7: page dung RPC info, form post API", () => {
  assert.match(page, /admission_campaign_info/);
  assert.match(form, /\/api\/admissions\/apply/);
  assert.match(form, /name="website"/); // honeypot
});

test("AC-63.8: board co nut sao chep link khi open", () => {
  assert.match(board, /\/apply\/\$\{campaign\.id\}/);
  assert.match(board, /Sao ch.p link n.p h. s./);
});
