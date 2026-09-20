// Repeatable consistency checker — codifies the cross-module invariants that
// ad-hoc testing kept missing. Run: node scripts/check-consistency.mjs
// Exits non-zero and prints every violation found.
//
// Two layers:
//   A. DB data linkage — facts recorded in two places must agree, no orphans
//   B. Code rules — UI/UX defaults that must hold in every new/changed file
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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

const failures = [];
const check = (name, n, detail = "") => {
  const ok = n === 0;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (${n}) ${detail}`}`);
  if (!ok) failures.push(`${name}: ${n} ${detail}`);
};

// PostgREST caps responses (~1000 rows) — always paginate.
async function fetchAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

/* ============ A. DB data linkage ============ */

// A1. Referential integrity — fetch both sides, diff in JS (embedded-join
// .is() filters are unreliable on large tables).
const orphans = [
  ["students.class_id", "students", "class_id", "classes", "id"],
  ["grades.student_id", "grades", "student_id", "students", "id"],
  ["attendance_records.student_id", "attendance_records", "student_id", "students", "id"],
  ["period_absences.student_id", "period_absences", "student_id", "students", "id"],
  ["period_absences.period_log_id", "period_absences", "period_log_id", "period_logs", "id"],
  ["period_logs.timetable_entry_id", "period_logs", "timetable_entry_id", "timetable_entries", "id"],
  ["timetable_entries.class_id", "timetable_entries", "class_id", "classes", "id"],
  ["conduct_records.student_id", "conduct_records", "student_id", "students", "id"],
  ["conduct_evaluations.student_id", "conduct_evaluations", "student_id", "students", "id"],
  ["nlpc_comments.student_id", "nlpc_comments", "student_id", "students", "id"],
  ["competency_evaluations.student_id", "competency_evaluations", "student_id", "students", "id"],
  ["incidents.class_id", "incidents", "class_id", "classes", "id"],
  ["emulation_scores.class_id", "emulation_scores", "class_id", "classes", "id"],
  ["activity_attendance.student_id", "activity_attendance", "student_id", "students", "id"],
  ["announcements.class_id", "announcements", "class_id", "classes", "id"],
  ["counseling_cases.student_id", "counseling_cases", "student_id", "students", "id"],
];
const refCache = new Map();
for (const [label, table, col, refTable, refCol] of orphans) {
  if (!refCache.has(refTable)) {
    refCache.set(refTable, new Set((await fetchAll(refTable, refCol)).map((r) => r[refCol])));
  }
  const valid = refCache.get(refTable);
  const rows = await fetchAll(table, col);
  const bad = rows.filter((r) => r[col] != null && !valid.has(r[col]));
  check(`orphan:${label}`, bad.length);
}

// A2. Period-log absences must exist in daily attendance (same student+date).
{
  const logs = await fetchAll("period_logs", "id,date");
  const abs = await fetchAll("period_absences", "student_id,period_log_id");
  const dateOf = new Map(logs.map((l) => [l.id, l.date]));
  const pairs = new Set();
  for (const p of abs) {
    const d = dateOf.get(p.period_log_id);
    if (d) pairs.add(`${p.student_id}|${d}`);
  }
  const att = await fetchAll("attendance_records", "student_id,date,status");
  const attByKey = new Map(att.map((a) => [`${a.student_id}|${a.date}`, a.status]));
  let missing = 0;
  let presentClash = 0;
  for (const key of pairs) {
    const st = attByKey.get(key);
    if (st === undefined) missing++;
    else if (st === "present") presentClash++;
  }
  check("link:period_absence->attendance_record", missing);
  check("link:attendance_present_overrides_absence", presentClash);
}

// A3. Every active class must have students (a class with no roster is dead data)
{
  const classes = await fetchAll("classes", "id,name");
  const studs = await fetchAll("students", "class_id,status");
  const byClass = new Set(studs.filter((s) => s.status === "active").map((s) => s.class_id));
  const empty = classes.filter((c) => !byClass.has(c.id));
  check("coverage:class_has_students", empty.length, empty.map((c) => c.name).join(","));
}

// A4. Every class must have timetable entries (period-log depends on it)
{
  const classes = await fetchAll("classes", "id,name");
  const tt = await fetchAll("timetable_entries", "class_id");
  const byClass = new Set(tt.map((t) => t.class_id));
  const empty = classes.filter((c) => !byClass.has(c.id));
  check("coverage:class_has_timetable", empty.length, empty.map((c) => c.name).join(","));
}

// A5. Notifications feed must not be seed-only: events that should notify
// (messages, incidents) must produce matching notification rows.
{
  const msgs = await fetchAll("messages", "id");
  const incidents = await fetchAll("incidents", "id");
  const notifs = await fetchAll("notifications", "type");
  const typed = new Set(notifs.map((n) => n.type));
  const expectMsg = msgs.length > 0 ? (typed.has("message") ? 0 : 1) : 0;
  const expectInc = incidents.length > 0 ? (typed.has("incident") ? 0 : 1) : 0;
  check("link:messages->notifications", expectMsg);
  check("link:incidents->notifications", expectInc);
}

// A6. subjects are per-school (TH vs THCS have different sets with overlapping
// names like Toán/Tiếng Anh) — a duplicate name inside ONE school is bad data.
{
  const subs = await fetchAll("subjects", "id,name,school_id");
  const seen = new Map();
  let dupes = 0;
  const dupeNames = [];
  for (const s of subs) {
    const key = `${s.school_id}|${s.name}`;
    if (seen.has(key)) { dupes++; dupeNames.push(s.name); }
    else seen.set(key, s.id);
  }
  check("data:duplicate-subject-per-school", dupes, dupeNames.join(","));
}

// A7. parent_students links must be complete: every linked parent/student pair
// must resolve, and a student linked to a parent should sit in a real class.
{
  const links = await fetchAll("parent_students", "parent_id,student_id");
  const parents = new Set((await fetchAll("parents", "id")).map((p) => p.id));
  const students = new Set((await fetchAll("students", "id")).map((s) => s.id));
  const bad = links.filter((l) => !parents.has(l.parent_id) || !students.has(l.student_id));
  check("orphan:parent_students", bad.length);
}

/* ============ B. Code rules ============ */

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (!["node_modules", ".next", ".git"].includes(f)) walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(f)) out.push(p);
  }
  return out;
}
const srcFiles = walk(resolve(root, "src")).map((p) => [p, readFileSync(p, "utf8")]);
const rel = (p) => p.split("/src/")[1];

// Files intentionally ordered by something other than student given name —
// each entry must be justified. Add here ONLY for non-directory listings.
const VN_SORT_ALLOW = new Set([
  "app/(app)/academics/analysis/page.tsx", // ranked by average score, not a roster
]);

// B1. No raw <textarea> — all free-text fields must use AutoGrowTextarea
for (const [p, src] of srcFiles) {
  if (p.includes("auto-grow-textarea")) continue;
  const n = (src.match(/<textarea/g) ?? []).length;
  check(`code:raw-textarea:${rel(p)}`, n);
}

// B2. AutoGrowTextarea rendered inside a <td> must use `bare` — the cell is
// the container, a bordered box inside reads as a broken outline.
for (const [p, src] of srcFiles) {
  let missing = 0;
  for (const m of src.matchAll(/<td[\s>][\s\S]*?<\/td>/g)) {
    for (const t of m[0].matchAll(/<AutoGrowTextarea([\s\S]*?)\/>/g)) {
      if (!/\bbare\b/.test(t[1])) missing++;
    }
  }
  check(`code:table-textarea-needs-bare:${rel(p)}`, missing);
}

// B3. A .map callback that returns JSX containing .full_name renders a people
// list — it must be VN-sorted, unless the file declares another ordering
// intent (date/created_at/occurred_at/due_date feeds, score ranking).
for (const [p, src] of srcFiles) {
  if (VN_SORT_ALLOW.has(rel(p))) continue;
  const rendersNames = /\.map\(\s*\([^)]*\)\s*=>\s*\(?\s*<[\s\S]{0,600}?\.full_name/.test(src);
  if (!rendersNames) continue;
  const sorts = /sortByVietnameseName|compareVietnameseName/.test(src);
  const otherOrder =
    /\.order\(["'](date|created_at|occurred_at|due_date|recorded_at|week|period|submitted_at|scheduled_at|changed_at|meeting_date|activity_date)["']/.test(src) ||
    /\.sort\(/.test(src);
  check(`code:vn-sort:${rel(p)}`, sorts || otherOrder ? 0 : 1,
    "renders names without Vietnamese given-name sort");
}

// B4. No raw toLocale* outside the fixed-timezone utils themselves
for (const [p, src] of srcFiles) {
  if (rel(p) === "lib/utils.ts") continue;
  const n = (src.match(/\.toLocaleString\(|\.toLocaleDateString\(|\.toLocaleTimeString\(/g) ?? []).length;
  check(`code:raw-locale-date:${rel(p)}`, n);
}

// B5. Nav labels: no roman-numeral prefix, no abbreviations
{
  const nav = readFileSync(resolve(root, "src/lib/nav.ts"), "utf8");
  const labels = [...nav.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
  const roman = labels.filter((l) => /^[IVXL]+\.|^\d+\./.test(l));
  const abbr = labels.filter((l) => /\b(GVCN|GVBM|BGH|NLPC|CMHS|TKB|SĐB|PH)\b/.test(l));
  check("code:nav-roman-prefix", roman.length, roman.join(","));
  check("code:nav-abbreviation", abbr.length, abbr.join(","));
}

// B6. No dead <button> — must have onClick/type/asChild or spread listeners.
// Attributes may span lines and contain `=>`, so scan a window after `<button`.
for (const [p, src] of srcFiles) {
  let n = 0;
  for (const m of src.matchAll(/<button/g)) {
    const win = src.slice(m.index, m.index + 2000);
    const end = win.search(/(?<![=a-zA-Z])>/);
    if (end === -1) continue; // unterminated in window — skip, not dead
    const tag = win.slice(0, end + 1);
    if (!/(onClick|onMouseDown|type=|asChild|\{\.\.\.)/.test(tag)) n++;
  }
  check(`code:dead-button:${rel(p)}`, n);
}

// B7. Full-list subjects queries must be scoped to the user's school —
// subjects are per-school so an unscoped .from("subjects") leaks another
// school's subjects (duplicate names like Toán/Tiếng Anh). A query that only
// resolves known ids via .in("id", ...) is a safe lookup, not a list.
for (const [p, src] of srcFiles) {
  let n = 0;
  for (const m of src.matchAll(/\.from\(["']subjects["']\)/g)) {
    const win = src.slice(m.index, m.index + 800);
    const end = win.search(/;|\}\)/);
    const q = win.slice(0, end === -1 ? 800 : end);
    if (/\.in\(["']id["']/.test(q)) continue; // id lookup, safe
    if (!/school_id/.test(q)) n++;
  }
  check(`code:unscoped-subjects:${rel(p)}`, n);
}

console.log("\n" + (failures.length
  ? `${failures.length} check(s) FAILED`
  : "All consistency checks passed"));
process.exit(failures.length ? 1 : 0);
