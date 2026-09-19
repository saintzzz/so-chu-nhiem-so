import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AttendanceRoster } from "@/components/activities/attendance-roster";
import type { Activity, ClassRoom, Profile, Student } from "@/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface ActivityAttendanceRow {
  activity_id: string;
  student_id: string;
  status: "registered" | "present" | "absent" | "excused";
  evaluation: string | null;
}

async function scopedClasses(
  supabase: Supabase,
  profile: Profile,
): Promise<ClassRoom[]> {
  const wideRoles = ["bgh", "so_gd", "admin", "to_truong"];
  let query = supabase.from("classes").select("*").order("name");
  if (wideRoles.includes(profile.role)) {
    if (profile.school_id) query = query.eq("school_id", profile.school_id);
  } else {
    query = query.eq("gvcn_id", profile.id);
  }
  const { data } = await query;
  return (data ?? []) as ClassRoom[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export default async function ActivitiesAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string }>;
}) {
  const sp = await searchParams;
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  const classes = await scopedClasses(supabase, profile);
  const classIds = classes.map((c) => c.id);
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const { data: actData } = classIds.length
    ? await supabase
        .from("activities")
        .select("*")
        .in("class_id", classIds)
        .in("status", ["approved", "done"])
        .order("activity_date", { ascending: false })
    : { data: [] };
  const activities = (actData ?? []) as Activity[];

  const selectedId =
    sp.activity && activities.some((a) => a.id === sp.activity)
      ? sp.activity
      : (activities[0]?.id ?? null);

  let rows: {
    studentId: string;
    studentName: string;
    code: string;
    status: "registered" | "present" | "absent" | "excused";
    evaluation: string;
  }[] = [];

  if (selectedId) {
    const { data: attData } = await supabase
      .from("activity_attendance")
      .select("*")
      .eq("activity_id", selectedId);
    const attendance = (attData ?? []) as ActivityAttendanceRow[];

    const studentIds = attendance.map((r) => r.student_id);
    const { data: studentData } = studentIds.length
      ? await supabase
          .from("students")
          .select("id,full_name,code")
          .in("id", studentIds)
          .order("full_name")
      : { data: [] };
    const students = (studentData ?? []) as Pick<
      Student,
      "id" | "full_name" | "code"
    >[];
    const studentMap = new Map(students.map((s) => [s.id, s]));

    rows = attendance
      .filter((r) => studentMap.has(r.student_id))
      .map((r) => {
        const s = studentMap.get(r.student_id)!;
        return {
          studentId: r.student_id,
          studentName: s.full_name,
          code: s.code,
          status: r.status,
          evaluation: r.evaluation ?? "",
        };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName, "vi"));
  }

  return (
    <div>
      <PageHeader
        section="Phân hệ VII - Hoạt động GD"
        title="Điểm danh & đánh giá"
        description="Điểm danh học sinh tham gia hoạt động và ghi nhận đánh giá ý thức."
      />
      <AttendanceRoster
        key={selectedId ?? "none"}
        activities={activities.map((a) => ({
          id: a.id,
          label: `${a.title} - ${className.get(a.class_id) ?? ""}${
            a.activity_date ? ` (${fmtDate(a.activity_date)})` : ""
          }`,
        }))}
        selectedId={selectedId}
        rows={rows}
      />
    </div>
  );
}
