// CR-038: gen migration recreate cac policy dung my_role() -> my_roles().
// Doc pg_policies qua PostgREST (service key tu .env.local), rewrite:
//   ( SELECT my_role() ...) = 'x'        -> my_roles() @> ARRAY['x']
//   ( SELECT my_role() ...) = ANY(ARR)   -> my_roles() && ARR
// In ra SQL ra stdout; review truoc khi apply.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

const res = await fetch(`${url}/rest/v1/rpc/`, { method: "HEAD" }).catch(() => null);
// PostgREST khong expose pg_policies - dung SQL qua management? Thu pgrest
// tren pg_policies khong duoc. Dung endpoint query neu co. Fallback: doc
// qua supabase-js rpc scn_dump_policies (tao function truoc thu cong).
console.error("Need exec path - see caller");
process.exit(1);
