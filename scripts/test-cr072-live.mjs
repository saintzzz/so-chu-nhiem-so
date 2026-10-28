// CR-072 r1 live test: endpoint SSRF guard, enqueue role, int_receive, dequeue module gate.
// Chay: node scripts/test-cr072-live.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim())),
);
const SCHOOL = "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285";
const ok = (name, cond, extra = "") =>
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " - " + extra : ""}`);
const errHas = (r, s) => !!r.error && JSON.stringify(r.error).includes(s);

const bgh = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await bgh.auth.signInWithPassword({ email: "hainv@nd.scn", password: "demo1234" });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// 1) endpoint validation: http / private ip / localhost
for (const [name, url] of [
  ["http_scheme", "http://hooks.example.com/x"],
  ["private_ip", "https://192.168.1.5/hook"],
  ["loopback", "https://127.0.0.1/hook"],
  ["metadata", "https://169.254.169.254/latest"],
  ["localhost", "https://localhost/hook"],
]) {
  const r = await bgh.rpc("int_upsert_connector", {
    p_id: null, p_type: "webhook", p_name: `QA-${name}`, p_endpoint: url,
    p_auth_type: "none", p_secret_name: null, p_config: {}, p_enabled: true,
  });
  ok(`reject_${name}`, errHas(r, "invalid_endpoint"), r.error?.message ?? "ACCEPTED");
}

// 2) valid connector + enqueue as bgh
let r = await bgh.rpc("int_upsert_connector", {
  p_id: null, p_type: "webhook", p_name: "QA-CR072r1 hook", p_endpoint: "https://hooks.example.com/x",
  p_auth_type: "none", p_secret_name: null, p_config: {}, p_enabled: true,
});
ok("connector_valid", !r.error && !!r.data?.connector_id, JSON.stringify(r.error ?? r.data));
const connId = r.data?.connector_id;

r = await bgh.rpc("int_enqueue", {
  p_connector: connId, p_event: "qa.r1.test",
  p_payload: { hello: 1 }, p_idem: `qa-r1-${Date.now()}`,
});
ok("enqueue_bgh", !r.error && !!r.data?.event_id, JSON.stringify(r.error ?? r.data));
const evId = r.data?.event_id;

// 3) gvbm denied: upsert + enqueue + receive
const gv = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await gv.auth.signInWithPassword({ email: "anhptl@nd.scn", password: "demo1234" });
r = await gv.rpc("int_upsert_connector", {
  p_id: null, p_type: "webhook", p_name: "QA-gv", p_endpoint: "https://hooks.example.com/y",
  p_auth_type: "none", p_secret_name: null, p_config: {}, p_enabled: true,
});
ok("gvbm_upsert_denied", errHas(r, "forbidden"), r.error?.message);
r = await gv.rpc("int_enqueue", { p_connector: connId, p_event: "x", p_payload: {}, p_idem: null });
ok("gvbm_enqueue_denied", errHas(r, "forbidden"), r.error?.message);
r = await gv.rpc("int_receive", {
  p_school: SCHOOL, p_source: "qa", p_event: "x", p_payload: {}, p_signature: null, p_idem: "gv-1",
});
ok("gvbm_receive_denied", errHas(r, "forbidden"), r.error?.message);

// 4) int_receive as bgh + dedup
r = await bgh.rpc("int_receive", {
  p_school: SCHOOL, p_source: "qa-webhook", p_event: "in.test",
  p_payload: { a: 1 }, p_signature: "sig", p_idem: `qa-in-${Date.now()}`,
});
ok("receive_bgh", !r.error && !!r.data?.inbox_id, JSON.stringify(r.error ?? r.data));
const idemIn = `qa-in-dedup-${Date.now()}`;
await bgh.rpc("int_receive", { p_school: SCHOOL, p_source: "qa-webhook", p_event: "e", p_payload: {}, p_signature: null, p_idem: idemIn });
r = await bgh.rpc("int_receive", { p_school: SCHOOL, p_source: "qa-webhook", p_event: "e", p_payload: {}, p_signature: null, p_idem: idemIn });
ok("receive_dedup", !r.error && r.data?.deduplicated === true, JSON.stringify(r.error ?? r.data));

// 5) int_receive as service_role
r = await admin.rpc("int_receive", {
  p_school: SCHOOL, p_source: "qa-svc", p_event: "svc.test",
  p_payload: {}, p_signature: null, p_idem: `qa-svc-${Date.now()}`,
});
ok("receive_service_role", !r.error && !!r.data?.inbox_id, JSON.stringify(r.error ?? r.data));

// 6) dequeue module gate: tat tich_hop -> event pending khong duoc dequeue
const prev = await admin.from("school_features").select("enabled")
  .eq("school_id", SCHOOL).eq("module", "tich_hop").maybeSingle();
if (!prev.data) {
  await admin.from("school_features").insert({ school_id: SCHOOL, module: "tich_hop", enabled: true });
}
await admin.from("school_features").update({ enabled: false })
  .eq("school_id", SCHOOL).eq("module", "tich_hop");
r = await admin.rpc("int_dequeue", { p_batch: 50 });
const grabbed = (r.data ?? []).some((e) => e.id === evId);
ok("dequeue_module_off_skips", !r.error && !grabbed,
  r.error?.message ?? `rows=${r.data?.length}`);
const st = await admin.from("int_outbox").select("status").eq("id", evId).single();
ok("event_still_pending", st.data?.status === "pending", JSON.stringify(st.data));
await admin.from("school_features").update({ enabled: true })
  .eq("school_id", SCHOOL).eq("module", "tich_hop");

// 7) dequeue lai khi bat module -> bat duoc event
r = await admin.rpc("int_dequeue", { p_batch: 50 });
ok("dequeue_module_on", !r.error && (r.data ?? []).some((e) => e.id === evId),
  r.error?.message ?? `rows=${r.data?.length}`);
await admin.rpc("int_mark", { p_id: evId, p_ok: true, p_error: null });

// cleanup
await admin.from("int_outbox").delete().eq("connector_id", connId);
await admin.from("int_connectors").delete().eq("id", connId);
await admin.from("int_inbox").delete().in("source", ["qa-webhook", "qa-svc"]);
console.log("cleanup ok");
