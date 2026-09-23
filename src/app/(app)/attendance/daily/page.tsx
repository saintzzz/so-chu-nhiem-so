import { requireRoles } from "@/lib/auth";
import { formatDateOnly, todayVN } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type {
  AttendanceRecord,
  AttendanceStatus,
  ClassRoom,
  Student,
} from "@/types";
import { PageHeader } from "@/components/page-header";
import { ClassChips } from "@/components/class-chips";
import { DailyRoster, type RosterRow } from "@/components/attendance/daily-roster";
import { AttendanceDateNav } from "@/components/attendance/date-controls";

export default async function AttendanceDailyPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string }>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const { class: classParam, date: dateParam } = await searchParams;
  const supabase = await createClient();

  let classQuery = supabase
    .from("classes")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  } else if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const { data: classData } = await classQuery;
  const classes = (classData ?? []) as ClassRoom[];
  const selected =
    classes.find((c) => c.id === classParam) ?? classes[0];

  if (!selected) {
    return (
      <div>
        <PageHeader
          section="Chuyên cần"
          title="Điểm danh hàng ngày"
        />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Bạn chưa được phân công lớp nào.
        </p>
      </div>
    );
  }

  const { data: studentData } = await supabase
    .from("students")
    .select("*")
    .eq("class_id", selected.id)
    .eq("status", "active")
    .order("code");
  const students = (studentData ?? []) as Student[];
  const ids = students.map((s) => s.id);

  // Mặc định hôm nay; chọn ngày cũ qua ?date= để xem/sửa lại
  const today =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : todayVN();

  const { data: attData } = ids.length
    ? await supabase
        .from("attendance_records")
        .select("*")
        .in("student_id", ids)
        .eq("date", today)
    : { data: [] };
  const attByStudent = new Map(
    ((attData ?? []) as AttendanceRecord[]).map((a) => [
      a.student_id,
      { status: a.status, note: a.note },
    ]),
  );

  const rows: RosterRow[] = students.map((s) => ({
    studentId: s.id,
    code: s.code,
    fullName: s.full_name,
    status: (attByStudent.get(s.id)?.status ?? "present") as AttendanceStatus,
    note: attByStudent.get(s.id)?.note ?? "",
  }));

  const dateLabel = formatDateOnly(today, {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader
        section="Chuyên cần"
        title="Điểm danh hàng ngày"
        description={`Lớp ${selected.name} · ${dateLabel}. Chọn trạng thái cho từng học sinh rồi xác nhận.`}
      />
      <ClassChips
        classes={classes}
        selectedId={selected.id}
        href="/attendance/daily"
        params={{ date: today }}
      />
      <AttendanceDateNav date={today} params={{ class: selected.id }} />
      <DailyRoster key={`${selected.id}-${today}`} date={today} rows={rows} />
    </div>
  );
}
