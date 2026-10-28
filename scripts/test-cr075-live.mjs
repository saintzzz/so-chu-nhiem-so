// CR-075 live test: y_te_bhyt - health record + BHYT upsert + role deny + module off.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim())),
);
const ok = (n, c, x = "") => console.log(`${c ? "PASS" : "FAIL"} ${n}${x ? " - " + x : ""}`);
const errHas = (r, s) => !!r.error && JSON.stringify(r.error).includes(s);
const SCHOOL = "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285";

const bgh = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await bgh.auth.signInWithPassword({ email: "hainv@nd.scn", password: "demo1234" });
const gv = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await gv.auth.signInWithPassword({ email: "minhtv@nd.scn", password: "demo1234" });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const stu = await admin.from("students").select("id,class_id")
  .eq("class_id", (await admin.from("classes").select("id").eq("school_id", SCHOOL).limit(1).single()).data.id)
  .limit(1).single();
const sid = stu.data.id;
await admin.from("yt_health_records").delete().eq("student_id", sid);
await admin.from("yt_bhyt_cards").delete().eq("student_id", sid);

// 1) bgh writes health record
let r = await bgh.rpc("yt_upsert_health", {
  p_student: sid, p_checked_at: "2026-10-20", p_height: 148, p_weight: 41.5,
  p_vleft: "10/10", p_vright: "9/10", p_dental: "Tot", p_conclusion: "Khoe", p_note: null,
});
ok("health_bgh", !r.error && !!r.data, JSON.stringify(r.error ?? r.data));

// 2) gvbm write denied
r = await gv.rpc("yt_upsert_health", {
  p_student: sid, p_checked_at: null, p_height: 150, p_weight: 42,
  p_vleft: null, p_vright: null, p_dental: null, p_conclusion: null, p_note: null,
});
ok("health_gvbm_denied", errHas(r, "forbidden"), r.error?.message);

// 3) cross-school student denied
const other = await admin.from("students").select("id,classes!inner(school_id)")
  .neq("classes.school_id", SCHOOL).limit(1).maybeSingle();
if (other.data) {
  r = await bgh.rpc("yt_upsert_health", {
    p_student: other.data.id, p_checked_at: null, p_height: null, p_weight: null,
    p_vleft: null, p_vright: null, p_dental: null, p_conclusion: null, p_note: null,
  });
  ok("health_cross_denied", errHas(r, "invalid_student"), r.error?.message);
}

// 4) invalid height check
r = await bgh.rpc("yt_upsert_health", {
  p_student: sid, p_checked_at: null, p_height: 999, p_weight: null,
  p_vleft: null, p_vright: null, p_dental: null, p_conclusion: null, p_note: null,
});
ok("health_bad_height", errHas(r, "height_cm_check") || !!r.error, r.error?.message);

// 5) BHYT upsert + conflict-update
r = await bgh.rpc("yt_upsert_bhyt", {
  p_student: sid, p_card_no: "DN-1-79-1234567", p_kcbb: "BV Da Nang",
  p_from: "2026-01-01", p_to: "2026-12-31", p_status: "active", p_note: null,
});
ok("bhyt_upsert", !r.error && !!r.data, JSON.stringify(r.error ?? r.data));
r = await bgh.rpc("yt_upsert_bhyt", {
  p_student: sid, p_card_no: "DN-1-79-7654321", p_kcbb: "BV Da Nang",
  p_from: "2026-01-01", p_to: "2027-12-31", p_status: "active", p_note: "cap moi",
});
const card = await admin.from("yt_bhyt_cards").select("card_no,note").eq("student_id", sid).single();
ok("bhyt_update", !r.error && card.data?.card_no === "DN-1-79-7654321", JSON.stringify(card.data));

// 6) invalid status / date range
r = await bgh.rpc("yt_upsert_bhyt", {
  p_student: sid, p_card_no: null, p_kcbb: null,
  p_from: null, p_to: null, p_status: "hacked", p_note: null,
});
ok("bhyt_bad_status", errHas(r, "invalid_status"), r.error?.message);
r = await bgh.rpc("yt_upsert_bhyt", {
  p_student: sid, p_card_no: null, p_kcbb: null,
  p_from: "2027-01-01", p_to: "2026-01-01", p_status: "active", p_note: null,
});
ok("bhyt_bad_dates", errHas(r, "invalid_date"), r.error?.message);

// 7) module off -> read 0 + rpc denied
await admin.from("school_features").upsert(
  { school_id: SCHOOL, module: "y_te_bhyt", enabled: false },
  { onConflict: "school_id,module" });
const rd = await bgh.from("yt_health_records").select("id").eq("student_id", sid);
ok("module_off_read", !rd.error && rd.data.length === 0, `rows=${rd.data?.length}`);
r = await bgh.rpc("yt_upsert_health", {
  p_student: sid, p_checked_at: null, p_height: null, p_weight: null,
  p_vleft: null, p_vright: null, p_dental: null, p_conclusion: null, p_note: null,
});
ok("module_off_rpc", errHas(r, "module_disabled"), r.error?.message);
await admin.from("school_features").update({ enabled: true })
  .eq("school_id", SCHOOL).eq("module", "y_te_bhyt");

// cleanup
await admin.from("yt_health_records").delete().eq("student_id", sid);
await admin.from("yt_bhyt_cards").delete().eq("student_id", sid);
console.log("cleanup ok");
