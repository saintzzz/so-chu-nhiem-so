import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const c = createClient(URL_, ANON);
await c.auth.signInWithPassword({ email: "sovqt@demo.scn", password: "demo1234" });
const t0 = Date.now();
const { data, error } = await c.from("profiles").select("id,full_name,role,school_id,last_sign_in_at").range(0, 999);
console.log("so_gd profiles:", (data ?? []).length, "rows in", Date.now() - t0, "ms", error?.message ?? "");
const c2 = createClient(URL_, ANON);
await c2.auth.signInWithPassword({ email: "annv@nd.scn", password: "demo1234" });
const t1 = Date.now();
const { data: p2, error: e2 } = await c2.from("profiles").select("id,full_name,role").range(0, 999);
console.log("phu_huynh profiles:", (p2 ?? []).length, "rows in", Date.now() - t1, "ms", e2?.message ?? "");
console.log("  roles seen:", [...new Set((p2 ?? []).map(x => x.role))].join(","));
