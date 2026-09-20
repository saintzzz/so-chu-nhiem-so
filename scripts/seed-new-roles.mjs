/**
 * Tạo tài khoản demo cho vai trò mới: pht, ke_toan, phong_gd, ubnd.
 * Usage: node scripts/seed-new-roles.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => l.split("=", 2).map((s) => s.trim())),
);
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const SID = "0e4b1e8c-3a3d-4c58-8c03-47c7217c2285"; // THCS Nguyễn Du
const CAMPUS_PH = "e58a9237-df26-432e-979b-37571b3cd281"; // Phân hiệu Bản Mới

async function createAuthUser(email, password, role, full_name) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { role, full_name, school_id: SID },
  });
  if (error) {
    if (error.message.includes("already")) {
      const { data: list } = await supabase.auth.admin.listUsers();
      return list.users.find((x) => x.email === email)?.id;
    }
    throw new Error(`auth ${email}: ${error.message}`);
  }
  return data.user.id;
}

const { data: orgs } = await supabase.from("org_units").select("id,type");
const orgByType = Object.fromEntries(orgs.map((o) => [o.type, o.id]));

const users = [
  ["pht@demo.scn", "pht", "Trần Thị Phó Hiệu", SID, CAMPUS_PH, null],
  ["ketoan@demo.scn", "ke_toan", "Nguyễn Thị Kế Toán", SID, null, null],
  ["phonggd@demo.scn", "phong_gd", "Lê Lãnh Đạo Phòng", null, null, orgByType.phong],
  ["ubnd@demo.scn", "ubnd", "Phạm Cán Bộ UBND", null, null, orgByType.ubnd],
];

for (const [email, role, name, school_id, campus_id, org_unit_id] of users) {
  const id = await createAuthUser(email, "demo1234", role, name);
  if (!id) { console.log(`skip ${email}`); continue; }
  const { error } = await supabase
    .from("profiles")
    .update({ role, full_name: name, school_id, campus_id, org_unit_id })
    .eq("id", id);
  if (error) throw new Error(`profile ${email}: ${error.message}`);
  console.log(`${email} (${role}) -> ${id}`);
}
console.log("done");
