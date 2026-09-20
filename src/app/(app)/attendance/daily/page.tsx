import { requireRoles } from "@/lib/auth";
import { formatDateOnly } from "@/lib/utils";
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

export default async function AttendanceDailyPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const { class: classParam } = await searchParams;
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

  // "Hôm nay" = ngày có dữ liệu chuyên cần gần nhất của lớp
  let today = new Date().toISOString().slice(0, 10);
  if (ids.length > 0) {
    const { data: latest } = await supabase
      .from("attendance_records")
      .select("date")
      .in("student_id", ids)
      .order("date", { ascending: false })
      .limit(1);
    const latestDate = (latest ?? []) as { date: string }[];
    if (latestDate[0]?.date) today = latestDate[0].date;
  }

  const { data: attData } = ids.length
    ? await supabase
        .from("attendance_records")
        .select("*")
        .in("student_id", ids)
        .eq("date", today)
    : { data: [] };
  const attByStudent = new Map(
    ((attData ?? []) as AttendanceRecord[]).map((a) => [a.student_id, a.status]),
  );

  const rows: RosterRow[] = students.map((s) => ({
    studentId: s.id,
    code: s.code,
    fullName: s.full_name,
    status: (attByStudent.get(s.id) ?? "present") as AttendanceStatus,
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
      />
      <DailyRoster date={today} rows={rows} />
    </div>
  );
}
