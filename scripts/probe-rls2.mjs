import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
for (const [email, label] of [["anhptl@nd.scn","gvcn"],["trangpt@nd.scn","ke_toan"],["minhtv@nd.scn","gvbm"],["baong@nd.scn","hoc_sinh"]]) {
  const c = createClient(URL_, ANON);
  await c.auth.signInWithPassword({ email, password: "demo1234" });
  const t = Date.now();
  const { data, error } = await c.from("profiles").select("id,role").range(0, 999);
  const roles = [...new Set((data ?? []).map(x => x.role))].join(",");
  console.log(`${label}: ${(data ?? []).length} rows ${Date.now() - t}ms roles=[${roles}] ${error?.message ?? ""}`);
}
