/**
 * CR-039 AC-1: kiem chung "ai co quyen gi thi thay nay".
 * Moi href trong NAV (va mergedNav cua cac to hop role) phai tro toi
 * page co requireRoles chua role do - hoac page mo cho moi user da login.
 *
 *   node scripts/check-nav-access.mjs
 *
 * Exit 1 khi co nav item tro route role khong duoc phep.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = resolve(root, "src/app");

const STAFF_ROLES = [
  "gvcn", "gvbm", "to_truong", "bgh", "pht", "ke_toan", "so_gd", "ubnd", "admin",
];
const ALL_ROLES = [...STAFF_ROLES, "phu_huynh", "hoc_sinh"];

/* ---------- 1. Parse NAV blocks tu nav.ts ---------- */
const navSrc = readFileSync(resolve(root, "src/lib/nav.ts"), "utf8");
const navBody = navSrc.slice(
  navSrc.indexOf("export const NAV"),
  navSrc.indexOf("export const ROLE_LABELS"),
);
const roleStarts = [...navBody.matchAll(/^ {2}(\w+): \[$/gm)];
const navHrefs = {}; // role -> Set(href)
for (let i = 0; i < roleStarts.length; i++) {
  const role = roleStarts[i][1];
  const start = roleStarts[i].index;
  const end = i + 1 < roleStarts.length ? roleStarts[i + 1].index : navBody.length;
  const block = navBody.slice(start, end);
  navHrefs[role] = new Set([...block.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]));
}

/* ---------- 2. Crawl pages -> route -> allowed roles ---------- */
function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = resolve(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (e === "page.tsx") yield p;
  }
}
function routeOf(file) {
  let rel = "/" + relative(APP, dirname(file)).replaceAll("\\", "/");
  rel = rel.replace(/\((app|portal|auth)\)/g, "").replace(/\/+/g, "/");
  return rel === "" ? "/" : rel;
}
function resolveRoleArg(arg) {
  if (arg.includes("STAFF_ROLES")) return new Set(STAFF_ROLES);
  const m = arg.match(/\[([\s\S]*)\]/);
  if (!m) return null; // khong parse duoc
  return new Set([...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]));
}

const routes = new Map(); // path -> { roles:Set|null(any-auth)|undefined(unknown), file }
for (const file of walk(APP)) {
  const src = readFileSync(file, "utf8");
  const m = src.match(/requireRoles\(\s*([^)]*)\)/);
  let roles;
  if (m) roles = resolveRoleArg(m[1]);
  else if (/getProfile\(\)|requireProfile\(\)/.test(src)) roles = null; // mo cho moi role da login
  routes.set(routeOf(file), { roles, file });
}

/* ---------- 3. Audit ---------- */
let fail = 0, warn = 0;
const misses = [];
for (const role of ALL_ROLES) {
  for (const href of navHrefs[role] ?? []) {
    const r = routes.get(href);
    if (!r) {
      misses.push(`[MISS]  ${role} -> ${href} : khong tim thay page.tsx`);
      warn++;
      continue;
    }
    if (r.roles === undefined) {
      misses.push(`[WARN]  ${role} -> ${href} : page khong co role guard ro rang (${relative(root, r.file)})`);
      warn++;
      continue;
    }
    if (r.roles === null) continue; // any authenticated
    if (!r.roles.has(role)) {
      misses.push(`[FAIL]  ${role} -> ${href} : requireRoles(${[...r.roles].join(",")}) khong chua ${role}`);
      fail++;
    }
  }
}

// To hop multi-role dien hinh (CR-038): mergedNav = union cac href.
const combos = [
  ["gvcn", "gvbm", "to_truong"],
  ["pht", "gvbm"],
  ["bgh", "gvbm"],
];
for (const combo of combos) {
  const hrefs = new Set(combo.flatMap((r) => [...(navHrefs[r] ?? [])]));
  for (const href of hrefs) {
    const r = routes.get(href);
    if (!r || r.roles === undefined || r.roles === null) continue;
    if (!combo.some((role) => r.roles.has(role))) {
      misses.push(`[FAIL]  merged[${combo.join("+")}] -> ${href} : khong role nao duoc phep`);
      fail++;
    }
  }
}

const total = Object.values(navHrefs).reduce((n, s) => n + s.size, 0);
console.log(`nav-access audit: ${total} nav hrefs, ${routes.size} routes`);
for (const m of misses) console.log("  " + m);
if (fail) {
  console.log(`\nFAIL: ${fail} nav item(s) tro route ngoai quyen.`);
  process.exit(1);
}
console.log(`PASS: moi nav item deu nam trong quyen cua role${warn ? ` (${warn} warning)` : ""}.`);
