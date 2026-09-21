// CR-006: stagger per-class timetable layouts + reassign teachers so no
// teacher is double-booked in the same (weekday, period) slot.
// Run: node scripts/fix-timetable-conflicts.mjs [--apply]
// Default = dry-run (prints planned changes only).
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
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

const WEEKDAYS = [2, 3, 4, 5, 6, 7];
const PERIODS = [1, 2, 3, 4, 5];
const ALL_SLOTS = WEEKDAYS.flatMap((w) => PERIODS.map((p) => `${w}-${p}`));
const key = (w, p) => `${w}-${p}`;

const [{ data: entries }, { data: classes }, { data: tsRows }, { data: staff }, { data: logged }] =
  await Promise.all([
    supabase.from("timetable_entries").select("id,class_id,subject_id,teacher_id,weekday,period,room"),
    supabase.from("classes").select("id,name,school_id,gvcn_id").eq("status", "active"),
    supabase.from("teacher_subjects").select("teacher_id,subject_id"),
    supabase.from("profiles").select("id,school_id,role").in("role", ["gvcn", "gvbm", "to_truong"]),
    supabase.from("period_logs").select("timetable_entry_id"),
  ]);

const frozen = new Set((logged ?? []).map((l) => l.timetable_entry_id));
const classById = new Map(classes.map((c) => [c.id, c]));
const schoolStaff = new Map();
for (const t of staff ?? []) {
  if (!schoolStaff.has(t.school_id)) schoolStaff.set(t.school_id, []);
  schoolStaff.get(t.school_id).push(t.id);
}

// qualified[subjectId] = Set(teacherId) - from teacher_subjects + current assignments
const qualified = new Map();
const addQ = (s, t) => {
  if (!qualified.has(s)) qualified.set(s, new Set());
  qualified.get(s).add(t);
};
for (const r of tsRows ?? []) addQ(r.subject_id, r.teacher_id);
for (const e of entries ?? []) if (e.teacher_id) addQ(e.subject_id, e.teacher_id);
const newMappings = [];
const qualify = (subjectId, teacherId) => {
  const set = qualified.get(subjectId) ?? new Set();
  if (!set.has(teacherId)) {
    set.add(teacherId);
    qualified.set(subjectId, set);
    newMappings.push({ teacher_id: teacherId, subject_id: subjectId });
  }
};

// ---------- Phase 1: stagger per-class layouts ----------
const slotSubjectCount = new Map(); // "wd-p|subjectId" -> count (global, per school irrelevant since pools are per-school but subject ids are per-school anyway)
const gKey = (w, p, s) => `${w}-${p}|${s}`;
const plan = new Map(); // entryId -> {weekday, period}

// Process each school separately to keep counts meaningful (subjects are per-school).
const schools = [...new Set(classes.map((c) => c.school_id))];
for (const schoolId of schools) {
  const schoolClasses = classes.filter((c) => c.school_id === schoolId);
  // larger classes first so they get first pick of slots
  const classEntries = new Map(
    schoolClasses.map((c) => [
      c.id,
      (entries ?? []).filter((e) => e.class_id === c.id),
    ]),
  );
  schoolClasses.sort(
    (a, b) => (classEntries.get(b.id)?.length ?? 0) - (classEntries.get(a.id)?.length ?? 0),
  );

  const schoolCount = new Map(); // gKey -> count within this school
  const bump = (w, p, s, d) =>
    schoolCount.set(gKey(w, p, s), (schoolCount.get(gKey(w, p, s)) ?? 0) + d);

  for (const cls of schoolClasses) {
    const list = classEntries.get(cls.id) ?? [];
    const frozenEntries = list.filter((e) => frozen.has(e.id));
    const movable = list.filter((e) => !frozen.has(e.id));
    const used = new Set(frozenEntries.map((e) => key(e.weekday, e.period)));
    for (const e of frozenEntries) {
      plan.set(e.id, { weekday: e.weekday, period: e.period });
      bump(e.weekday, e.period, e.subject_id, 1);
    }
    const freeSlots = ALL_SLOTS.filter((s) => !used.has(s));
    // subjects with more weekly occurrences placed first (harder to spread)
    movable.sort((a, b) => {
      const ca = movable.filter((x) => x.subject_id === a.subject_id).length;
      const cb = movable.filter((x) => x.subject_id === b.subject_id).length;
      return cb - ca;
    });
    const daySubject = new Map(); // "wd|subject" -> count in this class
    for (const e of frozenEntries) {
      const k = `${e.weekday}|${e.subject_id}`;
      daySubject.set(k, (daySubject.get(k) ?? 0) + 1);
    }
    for (const e of movable) {
      let best = null;
      let bestCost = Infinity;
      for (const s of freeSlots) {
        const [w, p] = s.split("-").map(Number);
        const cost =
          (schoolCount.get(gKey(w, p, e.subject_id)) ?? 0) * 100 +
          (daySubject.get(`${w}|${e.subject_id}`) ?? 0) * 10 +
          Math.random();
        if (cost < bestCost) {
          bestCost = cost;
          best = s;
        }
      }
      const [w, p] = best.split("-").map(Number);
      freeSlots.splice(freeSlots.indexOf(best), 1);
      plan.set(e.id, { weekday: w, period: p });
      bump(w, p, e.subject_id, 1);
      daySubject.set(`${w}|${e.subject_id}`, (daySubject.get(`${w}|${e.subject_id}`) ?? 0) + 1);
    }
  }
  // expose school counts globally for reporting
  for (const [k, v] of schoolCount) slotSubjectCount.set(`${schoolId}|${k}`, v);
}

// ---------- Phase 2: teacher assignment per slot ----------
const teacherLoad = new Map(); // teacherId -> weekly count
for (const e of entries ?? []) {
  if (e.teacher_id) teacherLoad.set(e.teacher_id, (teacherLoad.get(e.teacher_id) ?? 0) + 1);
}
const teacherOf = new Map(); // entryId -> teacherId
const slotBusy = new Map(); // "wd-p" -> Set(teacherId)

// slot order: densest first
const bySlot = new Map();
for (const e of entries ?? []) {
  const { weekday: w, period: p } = plan.get(e.id);
  const s = key(w, p);
  if (!bySlot.has(s)) bySlot.set(s, []);
  bySlot.get(s).push(e);
}
const sortedSlots = [...bySlot.entries()].sort((a, b) => b[1].length - a[1].length);

let expanded = 0;
let residual = 0;
for (const [slot, list] of sortedSlots) {
  const busy = slotBusy.get(slot) ?? new Set();
  slotBusy.set(slot, busy);
  // keep existing teachers where possible: first pass - keep
  for (const e of list) {
    if (e.teacher_id && !busy.has(e.teacher_id)) {
      busy.add(e.teacher_id);
      teacherOf.set(e.id, e.teacher_id);
    }
  }
  // second pass - assign remaining
  for (const e of list) {
    if (teacherOf.has(e.id)) continue;
    const schoolId = classById.get(e.class_id).school_id;
    const gvcnId = classById.get(e.class_id).gvcn_id;
    let pool = [...(qualified.get(e.subject_id) ?? [])].filter(
      (t) => !busy.has(t) && (schoolStaff.get(schoolId) ?? []).includes(t),
    );
    if (pool.length === 0) {
      // expand qualifications: same-school staff free at this slot, GVCN of class first (TH model)
      const candidates = (schoolStaff.get(schoolId) ?? []).filter((t) => !busy.has(t));
      candidates.sort((a, b) => {
        if (a === gvcnId) return -1;
        if (b === gvcnId) return 1;
        return (teacherLoad.get(a) ?? 0) - (teacherLoad.get(b) ?? 0);
      });
      if (candidates.length > 0) {
        qualify(e.subject_id, candidates[0]);
        expanded++;
        pool = [candidates[0]];
      }
    }
    if (pool.length === 0) {
      residual++;
      console.warn(`RESIDUAL slot ${slot} subject ${e.subject_id} class ${classById.get(e.class_id).name}`);
      continue;
    }
    pool.sort((a, b) => (teacherLoad.get(a) ?? 0) - (teacherLoad.get(b) ?? 0));
    const pick = pool[0];
    busy.add(pick);
    teacherOf.set(e.id, pick);
    teacherLoad.set(pick, (teacherLoad.get(pick) ?? 0) + 1);
  }
}

// ---------- Report ----------
const updates = [];
let moved = 0;
let retaught = 0;
for (const e of entries ?? []) {
  const np = plan.get(e.id);
  const nt = teacherOf.get(e.id) ?? e.teacher_id;
  const slotChanged = np.weekday !== e.weekday || np.period !== e.period;
  const teacherChanged = nt !== e.teacher_id;
  if (slotChanged) moved++;
  if (teacherChanged) retaught++;
  if (slotChanged || teacherChanged) {
    updates.push({ id: e.id, weekday: np.weekday, period: np.period, teacher_id: nt });
  }
}

// conflict check on plan
const conflicts = new Map();
for (const e of entries ?? []) {
  const np = plan.get(e.id);
  const t = teacherOf.get(e.id) ?? e.teacher_id;
  if (!t) continue;
  const k = `${t}|${np.weekday}-${np.period}`;
  conflicts.set(k, (conflicts.get(k) ?? 0) + 1);
}
const remaining = [...conflicts.values()].filter((c) => c > 1).length;
const dupSlot = (() => {
  const m = new Map();
  for (const e of entries ?? []) {
    const np = plan.get(e.id);
    const k = `${e.class_id}|${np.weekday}-${np.period}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.values()].filter((c) => c > 1).length;
})();

console.log(`entries=${entries.length} moved=${moved} retaught=${retaught} updates=${updates.length}`);
console.log(`new teacher_subjects mappings=${newMappings.length} (expanded pool hits=${expanded})`);
console.log(`teacher conflicts after: ${remaining} | class double-slot: ${dupSlot} | residual unassigned: ${residual}`);

if (!APPLY) {
  console.log("dry-run - pass --apply to write");
} else {
  if (newMappings.length) {
    const { error } = await supabase.from("teacher_subjects").upsert(newMappings, { onConflict: "teacher_id,subject_id" });
    if (error) throw error;
    console.log(`teacher_subjects +${newMappings.length}`);
  }
  // UNIQUE (class_id, weekday, period) forbids intermediate collisions when
  // swapping slots, so: entries whose slot is unchanged -> UPDATE in place
  // (covers frozen/logged entries - they must never be deleted because
  // period_logs CASCADEs), slot-changed entries -> DELETE + re-INSERT.
  const updateIds = new Set(updates.map((u) => u.id));
  const slotChanged = new Set(
    updates
      .filter((u) => {
        const e = entries.find((x) => x.id === u.id);
        const np = plan.get(u.id);
        return np.weekday !== e.weekday || np.period !== e.period;
      })
      .map((u) => u.id),
  );
  for (const e of entries ?? []) {
    if (!updateIds.has(e.id) || slotChanged.has(e.id)) continue;
    const { error } = await supabase
      .from("timetable_entries")
      .update({ teacher_id: teacherOf.get(e.id) ?? e.teacher_id })
      .eq("id", e.id);
    if (error) throw error;
  }
  const delIds = (entries ?? []).filter((e) => slotChanged.has(e.id)).map((e) => e.id);
  const { error: delErr } = await supabase
    .from("timetable_entries")
    .delete()
    .in("id", delIds);
  if (delErr) throw delErr;
  console.log(`deleted ${delIds.length} moved entries`);
  const rows = (entries ?? [])
    .filter((e) => slotChanged.has(e.id))
    .map((e) => ({
      id: e.id,
      class_id: e.class_id,
      subject_id: e.subject_id,
      teacher_id: teacherOf.get(e.id) ?? e.teacher_id,
      weekday: plan.get(e.id).weekday,
      period: plan.get(e.id).period,
      room: e.room,
    }));
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("timetable_entries").insert(rows.slice(i, i + CHUNK));
    if (error) throw error;
    console.log(`reinserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  console.log(`applied: ${updates.length} moved + teacher fixes`);
}
