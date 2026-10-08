// CR-029: security test - tenant isolation + quyen duyet theo RLS.
// Chay: node scripts/sectest-tvc.mjs
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const signIn = async (email) => {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: "demo1234" });
  if (error) throw new Error(`${email}: ${error.message}`);
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
};

const ND = "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285"; // THCS Nguyen Du
const CVA = "31d29038-cb2c-4c52-b245-a47afc4bd45b"; // TH Chu Van An
const pass = [], fail = [];
const check = (name, ok, detail = "") =>
  (ok ? pass : fail).push(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);

// A. GV truong ND chi thay bank truong minh + cau ca nhan
const tA = await signIn("gv010@nd.test");
const { count: nAll } = await tA.from("tvc_questions").select("*", { count: "exact", head: true });
const { count: nB } = await tA.from("tvc_questions").select("*", { count: "exact", head: true }).eq("school_id", CVA);
check("A1 GV ND doc duoc bank truong ND", (nAll ?? 0) >= 1300, `n=${nAll}`);
check("A2 GV ND KHONG thay bank CVA", nB === 0, `n=${nB}`);

// B. GV thuong (gvbm) khong sua/xoa duoc cau dong nghiep
const { data: other } = await tA.from("tvc_questions").select("id, owner_id").neq("owner_id", (await tA.auth.getUser()).data.user.id).limit(1);
if (other?.[0]) {
  const { data: upd } = await tA.from("tvc_questions").update({ stem: "hack" }).eq("id", other[0].id).select("id");
  check("B1 GV thuong khong sua cau dong nghiep", !upd?.length, `rows=${upd?.length ?? 0}`);
  const { data: del } = await tA.from("tvc_questions").delete().eq("id", other[0].id).select("id");
  check("B2 GV thuong khong xoa cau dong nghiep", !del?.length, `rows=${del?.length ?? 0}`);
}

// C. Insert vao truong khac bi chan
const { error: insErr } = await tA.from("tvc_questions").insert({
  stem: "Cau test cross-tenant", qtype: "multiple_choice", level: "biet", points: 1,
  source: "manual", review_state: "unreviewed", school_id: CVA,
});
check("C1 insert school_id truong khac bi chan", !!insErr, insErr?.message?.slice(0, 60) ?? "");

// D. To truong ND duyet duoc cau dong nghiep cung truong
const tt = await signIn("gv001@nd.test"); // to_truong ND
if (other?.[0]) {
  const { data: rv } = await tt.from("tvc_questions").update({ review_state: "unreviewed" }).eq("id", other[0].id).select("id");
  check("D1 to_truong duyet/doi trang thai cau dong nghiep", (rv?.length ?? 0) === 1);
}

// E. To truong ND khong dung toi duoc bank CVA
const { count: nB2 } = await tt.from("tvc_questions").select("*", { count: "exact", head: true }).eq("school_id", CVA);
check("E1 to_truong ND khong thay bank CVA", nB2 === 0);

// F. Phu huynh khong doc duoc cau hoi
try {
  const ph = await signIn("annv@nd.scn");
  const { count: nPH } = await ph.from("tvc_questions").select("*", { count: "exact", head: true });
  check("F1 phu huynh khong doc duoc bank", nPH === 0, `n=${nPH}`);
} catch { check("F1 phu huynh login", false, "khong login duoc de test"); }

// G. Anon khong doc duoc
const { count: nAnon } = await sb0().from("tvc_questions").select("*", { count: "exact", head: true });
check("G1 anon khong doc duoc bank", nAnon === 0, `n=${nAnon}`);
function sb0() { return createClient(url, anon, { auth: { persistSession: false } }); }

console.log(pass.join("\n"));
console.log(fail.join("\n"));
console.log(`\n${pass.length} PASS / ${fail.length} FAIL`);
process.exit(fail.length ? 1 : 0);
