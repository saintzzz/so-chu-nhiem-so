// CR-068 live test: xet tot nghiep workflow + deny paths + finalize.
// Chay: node scripts/test-cr068-live.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim())),
);
const ok = (name, cond, extra = "") =>
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " - " + extra : ""}`);
const errHas = (r, s) => !!r.error && JSON.stringify(r.error).includes(s);

const bgh = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await bgh.auth.signInWithPassword({ email: "hainv@nd.scn", password: "demo1234" });
const gv = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await gv.auth.signInWithPassword({ email: "anhptl@nd.scn", password: "demo1234" });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// cleanup truoc (neu rerun)
await admin.from("tn_decisions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
await admin.from("tn_campaigns").delete().neq("id", "00000000-0000-0000-0000-000000000000");

// 1) bgh mo dot thcs -> seed HS khoi 9
let r = await bgh.rpc("tn_open_campaign", {
  p_level: "thcs", p_name: "QA Xét TN THCS", p_pass_score: 5, p_require_exam: true,
});
ok("open_campaign", !r.error && r.data?.students > 0, JSON.stringify(r.error ?? r.data));
const campId = r.data?.campaign_id;
const seeded = r.data?.students;

// 2) duplicate -> unique violation
r = await bgh.rpc("tn_open_campaign", {
  p_level: "thcs", p_name: "Dup", p_pass_score: 5, p_require_exam: true,
});
ok("dup_blocked", !!r.error, r.error?.message);

// 3) gvbm deny
r = await gv.rpc("tn_open_campaign", { p_level: "thcs", p_name: "X", p_pass_score: 5, p_require_exam: true });
ok("gvbm_open_denied", errHas(r, "forbidden"), r.error?.message);
r = await gv.rpc("tn_finalize", { p_campaign: campId });
ok("gvbm_finalize_denied", errHas(r, "forbidden"), r.error?.message);

// 4) invalid params
r = await bgh.rpc("tn_open_campaign", { p_level: "cap3", p_name: "X", p_pass_score: 5, p_require_exam: true });
ok("invalid_level", errHas(r, "invalid_level"), r.error?.message);

// 5) lay 1 decision -> set exam + eligible recompute
const decs = await admin.from("tn_decisions").select("id,student_id,eligible,kqht,kqrl")
  .eq("campaign_id", campId).limit(3);
const d0 = decs.data[0];
r = await bgh.rpc("tn_set_exam", { p_decision: d0.id, p_score: 7.5 });
ok("set_exam_bgh", !r.error, JSON.stringify(r.error ?? r.data));
const dAfter = await admin.from("tn_decisions").select("exam_score,eligible").eq("id", d0.id).single();
const expectElig = d0.kqht && d0.kqht !== "chua_dat" && d0.kqrl && d0.kqrl !== "chua_dat";
ok("eligible_recomputed", dAfter.data?.exam_score === 7.5 && dAfter.data?.eligible === !!expectElig,
  `kqht=${d0.kqht} kqrl=${d0.kqrl} -> eligible=${dAfter.data?.eligible}`);

// 6) invalid score
r = await bgh.rpc("tn_set_exam", { p_decision: d0.id, p_score: 12 });
ok("invalid_score", errHas(r, "invalid_score"), r.error?.message);

// 7) gvcn khong chu nhiem lop 9 -> denied (anhptl gvcn 8A2)
r = await gv.rpc("tn_set_exam", { p_decision: d0.id, p_score: 6 });
ok("gvcn_other_class_denied", errHas(r, "forbidden"), r.error?.message);

// 8) bgh override approve 1 HS (du thieu du lieu)
r = await bgh.rpc("tn_set_decision", { p_id: d0.id, p_value: "approved", p_note: "QA override" });
ok("override_approve", !r.error, JSON.stringify(r.error ?? r.data));
const stuId = d0.student_id;

// 9) finalize -> approved graduated + history + notify
r = await bgh.rpc("tn_finalize", { p_campaign: campId });
ok("finalize", !r.error && r.data?.graduated >= 1, JSON.stringify(r.error ?? r.data));
const stu = await admin.from("students").select("status").eq("id", stuId).single();
ok("student_graduated", stu.data?.status === "graduated", JSON.stringify(stu.data));
const hist = await admin.from("student_record_history").select("field,new_value")
  .eq("student_id", stuId).eq("field", "status").eq("new_value", "graduated");
ok("history_written", hist.data?.length >= 1);

// 10) campaign closed -> moi thao tac bi chan
r = await bgh.rpc("tn_set_exam", { p_decision: d0.id, p_score: 8 });
ok("closed_blocks_exam", errHas(r, "campaign_closed"), r.error?.message);
r = await bgh.rpc("tn_finalize", { p_campaign: campId });
ok("re_finalize_blocked", errHas(r, "campaign_closed"), r.error?.message);

// 11) module off -> read + RPC chan
await admin.from("school_features").upsert(
  { school_id: "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285", module: "xet_tot_nghiep", enabled: false },
  { onConflict: "school_id,module" });
const rd = await bgh.from("tn_decisions").select("id").limit(5);
ok("module_off_read", !rd.error && rd.data.length === 0, `rows=${rd.data?.length}`);
r = await bgh.rpc("tn_open_campaign", { p_level: "thpt", p_name: "X", p_pass_score: 5, p_require_exam: true });
ok("module_off_rpc", errHas(r, "module_disabled"), r.error?.message);
await admin.from("school_features").update({ enabled: true })
  .eq("school_id", "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285").eq("module", "xet_tot_nghiep");

// cleanup: tra student ve active + xoa history/decisions/campaign/notifications QA
await admin.from("students").update({ status: "active" }).eq("id", stuId);
await admin.from("student_record_history").delete().eq("student_id", stuId).eq("new_value", "graduated");
await admin.from("notifications").delete().eq("type", "tot_nghiep");
await admin.from("tn_decisions").delete().eq("campaign_id", campId);
await admin.from("tn_campaigns").delete().eq("id", campId);
console.log("cleanup ok");
