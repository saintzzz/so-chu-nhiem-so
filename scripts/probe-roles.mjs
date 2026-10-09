import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim().replace(/^"|"$/g,"")]));
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await a.from("profiles").select("email,role,concurrent_roles").or("email.ilike.%@nd.scn,email.ilike.%@cva.scn,email.ilike.%@kd.scn,email.eq.sovqt@demo.scn,email.eq.admin@demo.scn");
for (const p of data ?? []) if (p.concurrent_roles?.length) console.log(p.email, p.role, "concurrent:", p.concurrent_roles);
