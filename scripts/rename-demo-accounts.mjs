/**
 * CR-040: doi email tai khoan demo ve quy uoc ten that.
 *
 *   node scripts/rename-demo-accounts.mjs           # dry-run: in ke hoach doi
 *   node scripts/rename-demo-accounts.mjs --apply   # ghi auth.users + profiles
 *
 * Quy uoc: <ten><viet-tat-ho-dem>@<domain> - "Pham Thi Lan Anh" -> anhptl@nd.scn.
 * Trung trong cung domain -> hau to so (anhptl1, anhptl2...).
 * Domain can bo = domain email nhieu nhat cua truong; tai khoan khong thuoc
 * truong (so_gd, ubnd, phu_huynh, hoc_sinh) -> demo.scn. admin giu nguyen.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { usernameBase } from "../src/lib/username.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => l.split("=", 2).map((s) => s.trim().replace(/^"|"$/g, ""))),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const APPLY = process.argv.includes("--apply");
const DEMO_DOMAIN = /@(demo|school|nd|cva|kd)\.scn$/;

const { data: schools } = await sb.from("schools").select("id,name,code");
const { data: profs } = await sb
  .from("profiles")
  .select("id,email,full_name,role,school_id")
  .order("email");
if (!profs?.length) throw new Error("Khong doc duoc profiles");

// domain moi truong = domain nhieu nhat trong profiles cua truong do
const schoolDomain = new Map();
for (const s of schools ?? []) {
  const c = new Map();
  for (const p of profs.filter((x) => x.school_id === s.id)) {
    const d = (p.email ?? "").split("@")[1];
    if (d) c.set(d, (c.get(d) ?? 0) + 1);
  }
  schoolDomain.set(s.id, [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "demo.scn");
}
const domainOf = (p) => (p.school_id ? schoolDomain.get(p.school_id) : "demo.scn");

// claimed[domain] = set username da chiem. Giu san cac email khong doi ten.
const claimed = new Map();
const keepers = new Set(); // profile id giu nguyen email
for (const p of profs) {
  const dom = domainOf(p);
  if (!claimed.has(dom)) claimed.set(dom, new Set());
  const local = (p.email ?? "").split("@")[0] ?? "";
  const target = `${usernameBase(p.full_name ?? "")}@${dom}`;
  const isDemo = DEMO_DOMAIN.test(p.email ?? "");
  // giu nguyen: admin, email ngoai he demo (vd app khac cung project), hoac da dung quy uoc
  if (p.role === "admin" || !isDemo || p.email === target) {
    claimed.get(dom).add(local);
    keepers.add(p.id);
  }
}

// gan username cho phan con lai, thu tu email cu -> deterministic
const plan = [];
for (const p of profs) {
  if (keepers.has(p.id)) continue;
  const dom = domainOf(p);
  const set = claimed.get(dom);
  const base = usernameBase(p.full_name ?? "");
  let un = base;
  for (let i = 1; set.has(un); i++) un = `${base}${i}`;
  set.add(un);
  const next = `${un}@${dom}`;
  if (next !== p.email) plan.push({ id: p.id, from: p.email, to: next, name: p.full_name, role: p.role });
}

console.log(`${APPLY ? "APPLY" : "DRY-RUN"} - ${plan.length} tai khoan doi email`);
for (const r of plan) console.log(`  ${r.from} -> ${r.to}  (${r.name}, ${r.role})`);
if (!APPLY) process.exit(0);

let ok = 0;
for (const r of plan) {
  const { error } = await sb.auth.admin.updateUserById(r.id, { email: r.to });
  if (error) {
    console.log(`  ! auth ${r.from}: ${error.message}`);
    continue;
  }
  const { error: pErr, data } = await sb
    .from("profiles")
    .update({ email: r.to })
    .eq("id", r.id)
    .select("id");
  if (pErr || !data?.length) {
    console.log(`  ! profiles ${r.from}: ${pErr?.message ?? "0 rows"}`);
    continue;
  }
  ok++;
}
console.log(`xong: ${ok}/${plan.length} doi thanh cong`);
