import Link from "next/link";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { TimetableToolbar } from "@/components/schedule/timetable-toolbar";
import { cn } from "@/lib/utils";

const WEEKDAYS = [2, 3, 4, 5, 6, 7] as const;
const PERIODS = [1, 2, 3, 4, 5] as const;

interface ClassRow {
  id: string;
  name: string;
}

interface EntryRow {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  weekday: number;
  period: number;
  room: string | null;
}

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong", "bgh"]);
  const supabase = await createClient();
  const sp = await searchParams;

  const [{ data: classesRaw }, { data: ownClsRaw }] = await Promise.all([
    supabase
      .from("classes")
      .select("id,name")
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("classes")
      .select("id,name")
      .eq("gvcn_id", profile.id)
      .order("name")
      .limit(1),
  ]);
  const classes = (classesRaw ?? []) as ClassRow[];
  const ownCls = ((ownClsRaw ?? []) as ClassRow[])[0] ?? null;

  const selectedId =
    sp.class && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (ownCls?.id ?? classes[0]?.id ?? null);
  const selected = classes.find((c) => c.id === selectedId) ?? null;

  const { data: entriesRaw } = selectedId
    ? await supabase
        .from("timetable_entries")
        .select("id,class_id,subject_id,teacher_id,weekday,period,room")
        .eq("class_id", selectedId)
    : { data: [] };
  const entries = (entriesRaw ?? []) as EntryRow[];

  const subjectIds = [...new Set(entries.map((e) => e.subject_id))];
  const teacherIds = [
    ...new Set(
      entries.map((e) => e.teacher_id).filter((t): t is string => t !== null),
    ),
  ];
  const [{ data: subjectsRaw }, { data: teachersRaw }] = await Promise.all([
    subjectIds.length > 0
      ? supabase.from("subjects").select("id,name").in("id", subjectIds)
      : Promise.resolve({ data: [] }),
    teacherIds.length > 0
      ? supabase.from("profiles").select("id,full_name").in("id", teacherIds)
      : Promise.resolve({ data: [] }),
  ]);
  const subjectName = new Map(
    ((subjectsRaw ?? []) as { id: string; name: string }[]).map((s) => [
      s.id,
      s.name,
    ]),
  );
  const teacherName = new Map(
    ((teachersRaw ?? []) as { id: string; full_name: string }[]).map((t) => [
      t.id,
      t.full_name,
    ]),
  );

  const cell = new Map<string, EntryRow>();
  for (const e of entries) cell.set(`${e.weekday}-${e.period}`, e);

  // BGH-only: full reference data for Excel template + import.
  const isBgh = profile.role === "bgh";
  let subjects: { id: string; name: string }[] = [];
  let teachers: { id: string; name: string }[] = [];
  let allEntries: {
    className: string;
    weekday: number;
    period: number;
    subject: string;
    teacher: string | null;
    room: string | null;
  }[] = [];
  if (isBgh) {
    const [{ data: allSubjects }, { data: allTeachers }, { data: everyEntry }] =
      await Promise.all([
        supabase.from("subjects").select("id,name").order("name"),
        supabase
          .from("profiles")
          .select("id,full_name")
          .in("role", ["gvcn", "gvbm", "to_truong", "bgh"])
          .order("full_name"),
        supabase
          .from("timetable_entries")
          .select("class_id,subject_id,teacher_id,weekday,period,room")
          .order("weekday")
          .order("period"),
      ]);
    subjects = (allSubjects ?? []) as { id: string; name: string }[];
    teachers = ((allTeachers ?? []) as { id: string; full_name: string }[]).map(
      (t) => ({ id: t.id, name: t.full_name }),
    );
    const subjectById = new Map(subjects.map((s) => [s.id, s.name]));
    const teacherById = new Map(teachers.map((t) => [t.id, t.name]));
    const classById = new Map(classes.map((c) => [c.id, c.name]));
    allEntries = ((everyEntry ?? []) as EntryRow[]).map((e) => ({
      className: classById.get(e.class_id) ?? "?",
      weekday: e.weekday,
      period: e.period,
      subject: subjectById.get(e.subject_id) ?? "?",
      teacher: e.teacher_id ? (teacherById.get(e.teacher_id) ?? null) : null,
      room: e.room,
    }));
  }

  return (
    <>
      <PageHeader
        section="Phân hệ XIII - Thời khóa biểu & Sổ đầu bài"
        title="Thời khóa biểu"
        description={
          selected
            ? `Lớp ${selected.name} - Tuần học (Thứ 2 đến Thứ 7)`
            : "Chưa có lớp nào"
        }
      />

      {/* Class filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Lớp:</span>
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/schedule/timetable?class=${c.id}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              c.id === selectedId
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {isBgh && selected && (
        <TimetableToolbar
          classes={classes}
          subjects={subjects}
          teachers={teachers}
          selectedClass={selected}
          selectedEntries={entries.map((e) => ({
            weekday: e.weekday,
            period: e.period,
            subject: subjectName.get(e.subject_id) ?? "-",
            teacher: e.teacher_id
              ? (teacherName.get(e.teacher_id) ?? null)
              : null,
            room: e.room,
          }))}
          allEntries={allEntries}
        />
      )}

      {/* Weekly grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="w-16 px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tiết
              </th>
              {WEEKDAYS.map((wd) => (
                <th
                  key={wd}
                  className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Thứ {wd}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p} className="border-b border-border last:border-0">
                <td className="px-3 py-3 align-top font-semibold text-muted-foreground">
                  {p}
                </td>
                {WEEKDAYS.map((wd) => {
                  const e = cell.get(`${wd}-${p}`);
                  return (
                    <td
                      key={wd}
                      className="border-l border-border px-3 py-2 align-top"
                    >
                      {e ? (
                        <div className="rounded-lg bg-primary-bg/60 px-2.5 py-2">
                          <p className="text-sm font-medium text-primary">
                            {subjectName.get(e.subject_id) ?? "-"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {e.teacher_id
                              ? (teacherName.get(e.teacher_id) ?? "-")
                              : "Chưa phân công"}
                          </p>
                          {e.room && (
                            <p className="text-[11px] text-muted-foreground">
                              Phòng {e.room}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
