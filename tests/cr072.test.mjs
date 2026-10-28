// CR-072: integration framework - static contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const M = read("supabase/migrations/20261248_cr072_integration.sql");
const M2 = read("supabase/migrations/20261249_cr072_int_r1.sql");
const DOC = read("docs/project/CR-072-integration-framework.md");

test("AC-72.1: CR doc + module key + nav", () => {
  assert.match(DOC, /outbox/i);
  assert.match(read("src/lib/modules.ts"), /key: "tich_hop"/);
  assert.match(read("src/lib/nav.ts"), /href: "\/school\/integrations", module: "tich_hop"/);
});

test("AC-72.2: schema - connectors, outbox, inbox, tenant, RLS", () => {
  assert.match(M, /create table public\.int_connectors/);
  assert.match(M, /create table public\.int_outbox/);
  assert.match(M, /create table public\.int_inbox/);
  assert.match(M, /unique \(school_id, idempotency_key\)/);
  assert.match(M, /unique \(source, idem_key\)/);
  assert.match(M, /cross_school_connector/);
  assert.match(M, /int_out_drain[\s\S]*status in \('pending','failed'\)/);
  assert.match(M, /int_module_enabled\(school_id\)/);
  assert.match(M, /revoke insert, update, delete on public\.int_connectors, public\.int_outbox, public\.int_inbox/);
  assert.doesNotMatch(M, /secret.*value|api_key.*plain/i, "khong luu gia tri secret");
});

test("AC-72.3: RPC guards - role + module + service_role boundary", () => {
  for (const fn of ["int_upsert_connector", "int_enqueue", "int_retry"]) {
    const body = M.slice(M.indexOf(`function public.${fn}`), M.indexOf("$$;", M.indexOf(`function public.${fn}`)));
    assert.match(body, /sm_|int_module_enabled/, `${fn} check module`);
    assert.match(body, /forbidden/, `${fn} check role`);
  }
  assert.match(M, /int_dequeue[\s\S]*for update skip locked/);
  assert.match(M, /grant execute on function public\.int_dequeue\(int\) to service_role/);
  assert.match(M, /revoke all on function public\.int_dequeue\(int\) from public, anon, authenticated/);
  assert.match(M, /on conflict \(school_id, idempotency_key\) do nothing/);
  assert.match(M, /power\(v_attempts, 2\)/);
  assert.match(M, /v_attempts >= 6[\s\S]*'dead'/);
});

test("AC-72.3b: r1 fixes - dequeue module gate, enqueue bgh|admin, SSRF, int_receive", () => {
  const deq = M2.slice(M2.indexOf("function public.int_dequeue"), M2.indexOf("$$;", M2.indexOf("function public.int_dequeue")));
  assert.match(deq, /int_module_enabled\(i\.school_id\)/, "dequeue ton trong module gate");
  const enq = M2.slice(M2.indexOf("function public.int_enqueue"), M2.indexOf("$$;", M2.indexOf("function public.int_enqueue")));
  assert.match(enq, /array\['bgh','admin'\]/, "enqueue chi bgh|admin");
  assert.doesNotMatch(enq, /gvcn|gvbm|ke_toan/, "staff khong enqueue truc tiep");
  assert.match(M2, /create or replace function public\.int_endpoint_ok/);
  assert.match(M2, /invalid_endpoint/);
  assert.match(M2, /192\\\.168|169\\\.254/, "chan private IP");
  const rcv = M2.slice(M2.indexOf("function public.int_receive"), M2.indexOf("$$;", M2.indexOf("function public.int_receive")));
  assert.match(rcv, /service_role/, "inbound qua service_role");
  assert.match(rcv, /module_disabled/);
  assert.match(rcv, /on conflict \(source, idem_key\) do nothing/);
  assert.match(M2, /grant execute on function public\.int_receive\(uuid, text, text, jsonb, text, text\) to authenticated, service_role/);
});

test("AC-72.4: worker + dispatch - cron auth, signature, no secrets in code", () => {
  const W = read("src/app/api/cron/integration-worker/route.ts");
  assert.match(W, /CRON_SECRET/);
  assert.match(W, /timingSafeEqual/);
  assert.match(W, /int_dequeue/);
  assert.match(W, /int_mark/);
  const D = read("src/lib/integrations/dispatch.ts");
  assert.match(D, /x-scn-signature/);
  assert.match(D, /hmac_sha256|createHmac/);
  assert.match(D, /process\.env\[name\]/);
  assert.match(D, /credentials_required/);
  assert.match(D, /AbortSignal\.timeout/);
  assert.match(D, /safeEndpoint/);
  assert.match(D, /invalid_endpoint/);
});

test("AC-72.5: UI conventions", () => {
  const PG = read("src/app/(app)/school/integrations/page.tsx");
  assert.match(PG, /requireRoles\(\["bgh", "admin"\]\)/);
  assert.match(PG, /requireModule\("tich_hop"\)/);
  assert.match(PG, /\.eq\("school_id", profile\.school_id\)/);
  const BD = read("src/components/integrations/board.tsx");
  assert.match(BD, /fmtDateTimeVN/);
  assert.match(BD, /relative overflow-x-auto/);
  assert.doesNotMatch(BD, /—|–/);
});
