import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PeriodLogBoard } from "@/components/schedule/period-log-board";
import type { PeriodEntry, PeriodLogState } from "@/components/schedule/period-log-board";

const DEFAULT_DATE = "2026-09-18";

interface ClassRow {
  id: string;
  name: string;
}

interface EntryRow {
  id: string;
  subject_id: string;
  teacher_id: string | null;
  period: number;
  room: string | null;
}

interface LogRow {
  id: string;
  timetable_entry_id: string;
  present_count: number | null;
  note: string | null;
}

interface AbsenceRow {
  period_log_id: string;
  student_id: string;
  status: string;
}

const WEEKDAY_NAMES: Record<number, string> = {
  2: "Thứ 2",
  3: "Thứ 3",
  4: "Thứ 4",
  5: "Thứ 5",
  6: "Thứ 6",
  7: "Thứ 7",
};

export default async function PeriodLogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;

  const date = sp.date ?? DEFAULT_DATE;
  const jsDay = new Date(`${date}T00:00:00`).getDay();
  // DB convention: weekday 2..7 = Thứ 2..Thứ 7 (Mon..Sat); Sunday => none
  const weekday = jsDay === 0 ? null : jsDay + 1;

  const { data: clsRaw } = await supabase
    .from("classes")
    .select("id,name")
    .eq("gvcn_id", profile.id)
    .maybeSingle();
  const cls = (clsRaw ?? null) as ClassRow | null;

  let entries: PeriodEntry[] = [];
  let logs: Record<string, PeriodLogState> = {};
  let studentCount = 0;
  let students: { id: string; full_name: string; code: string }[] = [];

  if (cls && weekday !== null) {
    const [{ data: entriesRaw }, { data: studentsRaw }] = await Promise.all([
      supabase
        .from("timetable_entries")
        .select("id,subject_id,teacher_id,period,room")
        .eq("class_id", cls.id)
        .eq("weekday", weekday)
        .order("period", { ascending: true }),
      supabase
        .from("students")
        .select("id,full_name,code")
        .eq("class_id", cls.id)
        .eq("status", "active")
        .order("full_name", { ascending: true }),
    ]);
    const entryRows = (entriesRaw ?? []) as EntryRow[];
    students = (studentsRaw ?? []) as {
      id: string;
      full_name: string;
      code: string;
    }[];
    studentCount = students.length;

    const subjectIds = [...new Set(entryRows.map((e) => e.subject_id))];
    const teacherIds = [
      ...new Set(
        entryRows
          .map((e) => e.teacher_id)
          .filter((t): t is string => t !== null),
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

    entries = entryRows.map((e) => ({
      id: e.id,
      period: e.period,
      subject: subjectName.get(e.subject_id) ?? "-",
      teacher: e.teacher_id ? (teacherName.get(e.teacher_id) ?? null) : null,
      room: e.room,
    }));

    const entryIds = entryRows.map((e) => e.id);
    const { data: logsRaw } =
      entryIds.length > 0
        ? await supabase
            .from("period_logs")
            .select("id,timetable_entry_id,present_count,note")
            .eq("date", date)
            .in("timetable_entry_id", entryIds)
        : { data: [] };
    const logRows = (logsRaw ?? []) as LogRow[];

    const logIds = logRows.map((l) => l.id);
    const { data: absRaw } =
      logIds.length > 0
        ? await supabase
            .from("period_absences")
            .select("period_log_id,student_id,status")
            .in("period_log_id", logIds)
        : { data: [] };
    const absRows = (absRaw ?? []) as AbsenceRow[];
    const absByLog = new Map<string, { student_id: string; status: string }[]>();
    for (const a of absRows) {
      const arr = absByLog.get(a.period_log_id) ?? [];
      arr.push({ student_id: a.student_id, status: a.status });
      absByLog.set(a.period_log_id, arr);
    }

    logs = Object.fromEntries(
      logRows.map((l) => [
        l.timetable_entry_id,
        {
          id: l.id,
          present_count: l.present_count,
          note: l.note,
          absences: (absByLog.get(l.id) ?? []).map((a) => ({
            student_id: a.student_id,
            status: a.status as "excused" | "unexcused" | "late",
          })),
        },
      ]),
    );
  }

  return (
    <>
      <PageHeader
        section="Phân hệ XIII - Thời khóa biểu & Sổ đầu bài"
        title="Sổ đầu bài"
        description={
          cls
            ? `Lớp ${cls.name} - ${WEEKDAY_NAMES[weekday ?? 0] ?? "Chủ nhật"}, ngày ${new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN")}`
            : "Chưa được phân công lớp chủ nhiệm"
        }
      />

      {!cls ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Bạn chưa được phân công chủ nhiệm lớp nào.
        </div>
      ) : weekday === null ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Chủ nhật không có tiết học. Chọn ngày khác để xem sổ đầu bài.
          <div className="mt-4">
            <PeriodLogBoard
              date={date}
              profileId={profile.id}
              entries={[]}
              students={students}
              logs={{}}
              rosterSize={studentCount}
            />
          </div>
        </div>
      ) : (
        <PeriodLogBoard
          date={date}
          profileId={profile.id}
          entries={entries}
          students={students}
          logs={logs}
          rosterSize={studentCount}
        />
      )}
    </>
  );
}
