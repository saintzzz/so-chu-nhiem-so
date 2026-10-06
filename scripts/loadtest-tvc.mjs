// CR-029: load test truy van ngan hang cau hoi (RLS, concurrency).
// Chay: node scripts/loadtest-tvc.mjs
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const sb = createClient(url, anon, { auth: { persistSession: false } });

const { data: auth, error } = await sb.auth.signInWithPassword({
  email: "gv010@nd.test", password: "demo1234",
});
if (error) throw error;
const jwt = auth.session.access_token;
const authed = createClient(url, anon, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

const stats = [];
async function run(name, conc, rounds, fn) {
  const lat = [];
  for (let r = 0; r < rounds; r++) {
    const t0 = performance.now();
    await Promise.all(Array.from({ length: conc }, () => {
      const s = performance.now();
      return fn().then(() => lat.push(performance.now() - s));
    }));
  }
  lat.sort((a, b) => a - b);
  const p = (q) => Math.round(lat[Math.floor(lat.length * q)] ?? 0);
  console.log(`${name.padEnd(34)} conc=${conc} n=${lat.length}  p50=${p(0.5)}ms p95=${p(0.95)}ms max=${Math.round(lat.at(-1) ?? 0)}ms`);
  stats.push({ name, conc, p50: p(0.5), p95: p(0.95) });
}

// mo phong truy van thuc te cua app
const listQ = () =>
  authed.from("tvc_questions")
    .select("id, code, stem, qtype, level, review_state")
    .order("created_at", { ascending: false }).range(0, 99);
const countQ = () =>
  authed.from("tvc_questions").select("*", { count: "exact", head: true });
const pickQ = (std) =>
  authed.from("tvc_questions")
    .select("id")
    .contains("standard_ids", [std])
    .eq("qtype", "multiple_choice").eq("level", "biet").limit(24);

// lay 1 standard_id bat ky trong bank truong ND
const { data: one } = await authed.from("tvc_questions").select("standard_ids").not("standard_ids", "is", null).limit(1);
const STD = one?.[0]?.standard_ids?.[0];

await run("list 100 cau (RLS scope truong)", 1, 5, listQ);
await run("list 100 cau", 20, 5, listQ);
await run("list 100 cau", 50, 5, listQ);
await run("count exact", 20, 3, countQ);
if (STD) {
  await run("pick theo YCCD+qtype+level (GIN)", 20, 5, () => pickQ(STD));
  await run("pick theo YCCD+qtype+level (GIN)", 50, 3, () => pickQ(STD));
}
console.log("\nTong ket:", JSON.stringify(stats, null, 0));
