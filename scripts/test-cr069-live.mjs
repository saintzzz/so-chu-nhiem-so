// CR-069 live test: hoc ba XML + ky so 2 cap + deny paths.
// Chay: node scripts/test-cr069-live.mjs
import { createClient } from "@supabase/supabase-js";
import { createHmac, createHash } from "node:crypto";
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
// Mirror hbxml.SECRET(): HB_SIGNING_SECRET, fallback derive tu service role key.
const SECRET = env.HB_SIGNING_SECRET?.length >= 32
  ? env.HB_SIGNING_SECRET
  : env.SUPABASE_SERVICE_ROLE_KEY
    ? createHmac("sha256", env.SUPABASE_SERVICE_ROLE_KEY).update("hb-signing-key-v1").digest("hex")
    : (() => { throw new Error("no signing secret available"); })();
const sig = (id, role, sha) => createHmac("sha256", SECRET).update(`${id}|${role}|${sha}`).digest("hex");

const bgh = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await bgh.auth.signInWithPassword({ email: "hainv@nd.scn", password: "demo1234" });
const gv = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await gv.auth.signInWithPassword({ email: "anhptl@nd.scn", password: "demo1234" });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const stu = await admin.from("students").select("id,class_id")
  .eq("status", "active").limit(1).single();
const year = await admin.from("academic_years").select("id")
  .eq("is_current", true).limit(1).single();
const XML = `<?xml version="1.0"?><HocBaDienTu><HocSinh ma="QA" ten="Nguyen Van QA Test Hoc Ba Export Signing Flow"/></HocBaDienTu>`;
const SHA = createHash("sha256").update(XML).digest("hex");

await admin.from("hb_exports").delete().eq("student_id", stu.data.id);

// 1) store as bgh
let r = await bgh.rpc("hb_store", { p_student: stu.data.id, p_year: year.data.id, p_xml: XML, p_sha: SHA });
ok("store_bgh", !r.error && !!r.data?.export_id, JSON.stringify(r.error ?? r.data));
const expId = r.data?.export_id;

// 2) gvbm (khong phai gvcn lop do) deny store
r = await gv.rpc("hb_store", { p_student: stu.data.id, p_year: year.data.id, p_xml: XML, p_sha: SHA });
ok("gvbm_store_denied", errHas(r, "forbidden"), r.error?.message);

// 3) sign sai trinh tu: bgh truoc -> invalid_state
r = await bgh.rpc("hb_sign", { p_id: expId, p_role: "bgh", p_sig: sig(expId, "bgh", SHA) });
ok("bgh_before_gvcn_denied", errHas(r, "invalid_state"), r.error?.message);

// 4) gvbm ky gvcn -> forbidden (khong chu nhiem lop)
r = await gv.rpc("hb_sign", { p_id: expId, p_role: "gvcn", p_sig: sig(expId, "gvcn", SHA) });
ok("gvbm_sign_denied", errHas(r, "forbidden"), r.error?.message);

// 5) gvcn ky bang tai khoan gvcn lop do? - anhptl gvcn 8A2, stu co the o lop khac.
//    Ky bang bgh role gvcn -> forbidden (khong co role gvcn). Dung service? -
//    role 'gvcn' can my_roles() @> gvcn. Thu bgh sign gvcn -> forbidden.
r = await bgh.rpc("hb_sign", { p_id: expId, p_role: "gvcn", p_sig: sig(expId, "gvcn", SHA) });
ok("bgh_cant_sign_gvcn", errHas(r, "forbidden"), r.error?.message);

// 6) gvcn that (anhptl gvcn 8A2): store cho HS 8A2 roi ky
const stu8a2 = await admin.from("students").select("id").eq("status", "active")
  .eq("class_id", "5f4a074f-1032-49dd-ad56-a70c63c5a6c2").limit(1).single();
await admin.from("hb_exports").delete().eq("student_id", stu8a2.data.id);
r = await gv.rpc("hb_store", { p_student: stu8a2.data.id, p_year: year.data.id, p_xml: XML, p_sha: SHA });
ok("gvcn_store_own_class", !r.error, JSON.stringify(r.error ?? r.data));
const exp2 = r.data?.export_id;
r = await gv.rpc("hb_sign", { p_id: exp2, p_role: "gvcn", p_sig: sig(exp2, "gvcn", SHA) });
ok("gvcn_sign", !r.error, JSON.stringify(r.error ?? r.data));

// 7) sign lai gvcn -> invalid_state
r = await gv.rpc("hb_sign", { p_id: exp2, p_role: "gvcn", p_sig: sig(exp2, "gvcn", SHA) });
ok("re_sign_denied", errHas(r, "invalid_state"), r.error?.message);

// 8) bgh ky cap 2
r = await bgh.rpc("hb_sign", { p_id: exp2, p_role: "bgh", p_sig: sig(exp2, "bgh", SHA) });
ok("bgh_sign", !r.error, JSON.stringify(r.error ?? r.data));

// 9) tao lai sau khi ky du -> already_signed
r = await gv.rpc("hb_store", { p_student: stu8a2.data.id, p_year: year.data.id, p_xml: XML, p_sha: SHA });
ok("rest_after_signed_denied", errHas(r, "already_signed"), r.error?.message);

// 10) invalid sha / invalid sig
r = await bgh.rpc("hb_store", { p_student: stu.data.id, p_year: year.data.id, p_xml: XML, p_sha: "abc" });
ok("invalid_sha", errHas(r, "invalid_sha"), r.error?.message);

// 11) module off -> RPC + read chan
await admin.from("school_features").upsert(
  { school_id: "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285", module: "hoc_ba", enabled: false },
  { onConflict: "school_id,module" });
const rd = await bgh.from("hb_exports").select("id").limit(5);
ok("module_off_read", !rd.error && rd.data.length === 0, `rows=${rd.data?.length}`);
r = await bgh.rpc("hb_sign", { p_id: exp2, p_role: "bgh", p_sig: "x" });
ok("module_off_rpc", errHas(r, "module_disabled"), r.error?.message);
await admin.from("school_features").update({ enabled: true })
  .eq("school_id", "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285").eq("module", "hoc_ba");

// cleanup
await admin.from("hb_exports").delete().in("id", [expId, exp2]);
console.log("cleanup ok");
