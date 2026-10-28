// CR-070 live test: dieu dong GV - create/approve/end + overlap + deny + resolution.
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

const entry = await admin.from("timetable_entries").select("id,teacher_id,class_id").limit(1).single();
const teachers = await admin.from("profiles").select("id,full_name")
  .eq("school_id", SCHOOL)
  .or("role.in.(gvbm,gvcn),concurrent_roles.ov.{gvbm}")
  .neq("id", entry.data.teacher_id).limit(2);
const [t1, t2] = teachers.data.map((t) => t.id);
await admin.from("dd_assignments").delete().eq("timetable_entry_id", entry.data.id);

// 1) create as bgh
let r = await bgh.rpc("dd_create", {
  p_entry: entry.data.id, p_teacher: t1,
  p_from: "2026-11-01", p_to: "2026-11-30", p_reason: "GV goc nghi om dai ngay",
});
ok("create_bgh", !r.error && !!r.data?.id, JSON.stringify(r.error ?? r.data));
const asn1 = r.data?.id;

// 2) gvbm create denied
r = await gv.rpc("dd_create", {
  p_entry: entry.data.id, p_teacher: t2,
  p_from: "2026-12-01", p_to: null, p_reason: "x",
});
ok("gvbm_create_denied", errHas(r, "forbidden"), r.error?.message);

// 3) overlap pending (11-15 trong 11-01..11-30)
r = await bgh.rpc("dd_create", {
  p_entry: entry.data.id, p_teacher: t2,
  p_from: "2026-11-15", p_to: null, p_reason: "trung khoang",
});
ok("overlap_denied", errHas(r, "overlapping_assignment"), r.error?.message);

// 4) invalid date range
r = await bgh.rpc("dd_create", {
  p_entry: entry.data.id, p_teacher: t2,
  p_from: "2026-12-10", p_to: "2026-12-01", p_reason: "nguoc ngay",
});
ok("invalid_date_denied", errHas(r, "invalid_date"), r.error?.message);

// 5) cross-school teacher (lay profile truong khac neu co)
const other = await admin.from("profiles").select("id")
  .neq("school_id", SCHOOL).limit(1).maybeSingle();
if (other.data) {
  r = await bgh.rpc("dd_create", {
    p_entry: entry.data.id, p_teacher: other.data.id,
    p_from: "2026-12-01", p_to: "2026-12-31", p_reason: "gv truong khac",
  });
  ok("cross_school_teacher_denied", errHas(r, "invalid_teacher"), r.error?.message);
}

// 6) approve -> active + notify
r = await bgh.rpc("dd_approve", { p_id: asn1 });
ok("approve", !r.error, JSON.stringify(r.error ?? r.data));
const notif = await admin.from("notifications").select("id")
  .eq("profile_id", t1).eq("type", "dieu_dong").limit(1);
ok("notify_teacher", (notif.data ?? []).length === 1);

// 7) effective_teacher resolution
const eff = await admin.rpc("dd_effective_teacher", {
  p_entry: entry.data.id, p_date: "2026-11-15",
});
ok("effective_mid", eff.data === t1, `got ${eff.data}`);
const effOut = await admin.rpc("dd_effective_teacher", {
  p_entry: entry.data.id, p_date: "2026-12-15",
});
ok("effective_outside", effOut.data === entry.data.teacher_id, `got ${effOut.data}`);

// 8) overlap active denied
r = await bgh.rpc("dd_create", {
  p_entry: entry.data.id, p_teacher: t2,
  p_from: "2026-11-20", p_to: "2026-12-20", p_reason: "trung active",
});
ok("overlap_active_denied", errHas(r, "overlapping_assignment"), r.error?.message);

// 9) re-approve denied + end
r = await bgh.rpc("dd_approve", { p_id: asn1 });
ok("re_approve_denied", errHas(r, "invalid_state"), r.error?.message);
r = await bgh.rpc("dd_end", { p_id: asn1 });
ok("end", !r.error, JSON.stringify(r.error ?? r.data));
const ended = await admin.from("dd_assignments").select("status,effective_to").eq("id", asn1).single();
ok("end_state", ended.data?.status === "ended" && !!ended.data?.effective_to);

// 10) sau end, create moi duoc (khong overlap vi ended)
r = await bgh.rpc("dd_create", {
  p_entry: entry.data.id, p_teacher: t2,
  p_from: "2026-11-10", p_to: "2026-11-20", p_reason: "sau khi ket thuc",
});
ok("create_after_end", !r.error, JSON.stringify(r.error ?? r.data));
const asn2 = r.data?.id;
r = await bgh.rpc("dd_cancel", { p_id: asn2 });
ok("cancel_pending", !r.error, JSON.stringify(r.error ?? r.data));

// 11) module off -> read + rpc chan
await admin.from("school_features").upsert(
  { school_id: SCHOOL, module: "dieu_dong", enabled: false },
  { onConflict: "school_id,module" });
const rd = await bgh.from("dd_assignments").select("id").limit(5);
ok("module_off_read", !rd.error && rd.data.length === 0, `rows=${rd.data?.length}`);
r = await bgh.rpc("dd_end", { p_id: asn1 });
ok("module_off_rpc", errHas(r, "module_disabled"), r.error?.message);
await admin.from("school_features").update({ enabled: true })
  .eq("school_id", SCHOOL).eq("module", "dieu_dong");

// cleanup
await admin.from("dd_assignments").delete().in("id", [asn1, asn2]);
await admin.from("notifications").delete().eq("profile_id", t1).eq("type", "dieu_dong");
console.log("cleanup ok");
