import { requireRoles } from "@/lib/auth";
import { formatDateOnly, todayVN } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { AttendanceDateNav } from "@/components/attendance/date-controls";
import { PeriodLogBoard } from "@/components/schedule/period-log-board";
import { AiInsightCard } from "@/components/ai/ai-insight-card";
import type {
  ClassRoster,
  PeriodEntry,
  PeriodLogState,
} from "@/components/schedule/period-log-board";



interface ClassRow {
  id: string;
  name: string;
}

interface EntryRow {
  id: string;
  class_id: string;
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
  lesson_title: string | null;
  lesson_content: string | null;
  teacher_comment: string | null;
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
  searchParams: Promise<{ date?: string; class?: string }>;
}) {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong"]);
  const supabase = await createClient();
  const sp = await searchParams;

  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : todayVN();
  const jsDay = new Date(`${date}T00:00:00`).getDay();
  // DB convention: weekday 2..7 = Thứ 2..Thứ 7 (Mon..Sat); Sunday => none
  const weekday = jsDay === 0 ? null : jsDay + 1;

  // GVCN xem toàn bộ tiết của lớp chủ nhiệm; GVBM xem các tiết mình dạy.
  const { data: clsRaw } = await supabase
    .from("classes")
    .select("id,name")
    .eq("gvcn_id", profile.id)
    .order("name");
  const myClasses = (clsRaw ?? []) as ClassRow[];
  const myClassIds = myClasses.map((c) => c.id);

  let entries: PeriodEntry[] = [];
  const rosters: Record<string, ClassRoster> = {};
  let logs: Record<string, PeriodLogState> = {};
  let filterClasses: ClassRow[] = [];
  let selectedClassId: string | null = null;

  if (weekday !== null) {
    let entryQuery = supabase
      .from("timetable_entries")
      .select("id,class_id,subject_id,teacher_id,period,room")
      .eq("weekday", weekday)
      .order("period", { ascending: true });
    if (myClassIds.length > 0) {
      entryQuery = entryQuery.or(
        `class_id.in.(${myClassIds.join(",")}),teacher_id.eq.${profile.id}`,
      );
    } else {
      entryQuery = entryQuery.eq("teacher_id", profile.id);
    }
    const { data: entriesRaw } = await entryQuery;
    let entryRows = (entriesRaw ?? []) as EntryRow[];

    const classIds = [...new Set(entryRows.map((e) => e.class_id))];
    const subjectIds = [...new Set(entryRows.map((e) => e.subject_id))];
    const teacherIds = [
      ...new Set(
        entryRows
          .map((e) => e.teacher_id)
          .filter((t): t is string => t !== null),
      ),
    ];

    const [{ data: classesData }, { data: studentsRaw }, { data: subjectsRaw }, { data: teachersRaw }] =
      await Promise.all([
        classIds.length > 0
          ? supabase.from("classes").select("id,name").in("id", classIds)
          : Promise.resolve({ data: [] }),
        classIds.length > 0
          ? supabase
              .from("students")
              .select("id,class_id,full_name,code")
              .in("class_id", classIds)
              .eq("status", "active")
              .order("full_name", { ascending: true })
          : Promise.resolve({ data: [] }),
        subjectIds.length > 0
          ? supabase.from("subjects").select("id,name").in("id", subjectIds)
          : Promise.resolve({ data: [] }),
        teacherIds.length > 0
          ? supabase.from("profiles").select("id,full_name").in("id", teacherIds)
          : Promise.resolve({ data: [] }),
      ]);

    filterClasses = (classesData ?? []) as ClassRow[];
    const validFilter =
      sp.class && filterClasses.some((c) => c.id === sp.class)
        ? sp.class
        : null;
    selectedClassId = validFilter;
    if (validFilter) {
      entryRows = entryRows.filter((e) => e.class_id === validFilter);
    }

    const className = new Map(
      ((classesData ?? []) as ClassRow[]).map((c) => [c.id, c.name]),
    );
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

    for (const s of (studentsRaw ?? []) as {
      id: string;
      class_id: string;
      full_name: string;
      code: string;
    }[]) {
      const roster = rosters[s.class_id] ?? { students: [], size: 0 };
      roster.students.push({
        id: s.id,
        full_name: s.full_name,
        code: s.code,
      });
      roster.size += 1;
      rosters[s.class_id] = roster;
    }

    entries = entryRows
      .map((e) => ({
        id: e.id,
        class_id: e.class_id,
        className: className.get(e.class_id),
        period: e.period,
        subject: subjectName.get(e.subject_id) ?? "-",
        teacher: e.teacher_id ? (teacherName.get(e.teacher_id) ?? null) : null,
        room: e.room,
        mine: e.teacher_id === profile.id,
      }))
      .sort(
        (a, b) =>
          (a.className ?? "").localeCompare(b.className ?? "", "vi") ||
          a.period - b.period,
      );

    const entryIds = entryRows.map((e) => e.id);
    const { data: logsRaw } =
      entryIds.length > 0
        ? await supabase
            .from("period_logs")
            .select(
              "id,timetable_entry_id,present_count,note,lesson_title,lesson_content,teacher_comment",
            )
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
          lesson_title: l.lesson_title,
          lesson_content: l.lesson_content,
          teacher_comment: l.teacher_comment,
          absences: (absByLog.get(l.id) ?? []).map((a) => ({
            student_id: a.student_id,
            status: a.status as "excused" | "unexcused" | "late",
          })),
        },
      ]),
    );
  }

  const weekdayLabel =
    weekday !== null
      ? `${WEEKDAY_NAMES[weekday]}, ngày ${formatDateOnly(date)}`
      : `Chủ nhật, ngày ${formatDateOnly(date)}`;
  const description =
    myClasses.length > 0
      ? `Lớp ${myClasses.map((c) => c.name).join(", ")} - ${weekdayLabel}`
      : `Các tiết dạy của bạn - ${weekdayLabel}`;

  return (
    <>
      <PageHeader
        section="Thời khóa biểu & Sổ đầu bài"
        title="Sổ đầu bài"
        description={description}
      />

      {myClasses.length > 0 && (
        <div className="mb-4">
          <AiInsightCard
            endpoint="/api/ai/period-log-summary"
            payload={{ classId: myClasses[0].id }}
            title="AI tóm tắt sổ đầu bài"
            buttonLabel="Tóm tắt tuần"
          />
        </div>
      )}

      <AttendanceDateNav
        date={date}
        params={selectedClassId ? { class: selectedClassId } : {}}
      />

      {filterClasses.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Lớp:</span>
          <Link prefetch={false}
            href={`/schedule/period-log?date=${date}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              !selectedClassId
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            Tất cả
          </Link>
          {filterClasses.map((c) => (
            <Link prefetch={false}
              key={c.id}
              href={`/schedule/period-log?date=${date}&class=${c.id}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                c.id === selectedClassId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {weekday === null ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Chủ nhật không có tiết học. Chọn ngày khác để xem sổ đầu bài.
        </div>
      ) : (
        <PeriodLogBoard
          key={date}
          date={date}
          profileId={profile.id}
          entries={entries}
          rosters={rosters}
          logs={logs}
        />
      )}
    </>
  );
}
