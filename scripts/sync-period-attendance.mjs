// One-off backfill: sync period_absences -> attendance_records (source=period_log)
// so daily attendance reflects absences marked in the period log (sổ đầu bài).
// Run: node scripts/sync-period-attendance.mjs
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
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

const SEV = { unexcused: 3, excused: 2, late: 1 };

// 1. Load period logs -> {logId: {date, class_id}}
const { data: logs, error: e1 } = await supabase
  .from("period_logs")
  .select("id,date,timetable_entries!inner(class_id)");
if (e1) throw e1;
const logInfo = new Map(
  logs.map((l) => [
    l.id,
    { date: l.date, class_id: l.timetable_entries.class_id },
  ]),
);
console.log(`period_logs: ${logs.length}`);

// 2. Load all period absences
const { data: abs, error: e2 } = await supabase
  .from("period_absences")
  .select("student_id,status,period_log_id");
if (e2) throw e2;
console.log(`period_absences: ${abs.length}`);

// 3. Worst status per (student, date)
const worst = new Map(); // `${student_id}|${date}` -> status
for (const a of abs) {
  const info = logInfo.get(a.period_log_id);
  if (!info) continue;
  const key = `${a.student_id}|${info.date}`;
  const cur = worst.get(key);
  if (!cur || SEV[a.status] > SEV[cur]) worst.set(key, a.status);
}
console.log(`distinct student-day absences: ${worst.size}`);

// 4. Existing attendance_records for those pairs -> raise severity only
const studentIds = [...new Set([...worst.keys()].map((k) => k.split("|")[0]))];
const dates = [...new Set([...worst.keys()].map((k) => k.split("|")[1]))];
const { data: existing, error: e3 } = await supabase
  .from("attendance_records")
  .select("student_id,date,status,source")
  .in("student_id", studentIds)
  .in("date", dates)
  .limit(10000);
if (e3) throw e3;
const existingMap = new Map(
  existing.map((r) => [`${r.student_id}|${r.date}`, r]),
);

// 5. Remove stale period_log rows, then insert missing / upgrade severity
const { error: e4 } = await supabase
  .from("attendance_records")
  .delete()
  .eq("source", "period_log");
if (e4) throw e4;

const inserts = [];
const updates = [];
for (const [key, status] of worst) {
  const [student_id, date] = key.split("|");
  const cur = existingMap.get(key);
  if (!cur) {
    inserts.push({ student_id, date, status, source: "period_log" });
  } else if (
    cur.source !== "period_log" &&
    SEV[status] > (SEV[cur.status] ?? 0)
  ) {
    updates.push({ student_id, date, status });
  }
}
for (let i = 0; i < inserts.length; i += 500) {
  const { error } = await supabase
    .from("attendance_records")
    .insert(inserts.slice(i, i + 500));
  if (error) throw error;
}
for (const u of updates) {
  const { error } = await supabase
    .from("attendance_records")
    .update({ status: u.status })
    .eq("student_id", u.student_id)
    .eq("date", u.date);
  if (error) throw error;
}
console.log(`inserted ${inserts.length}, upgraded ${updates.length}`);
