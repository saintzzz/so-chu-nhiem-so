import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  AttendanceStatus,
  ClassRoom,
  Student,
  StudentGroup,
} from "@/types";
import { PageHeader } from "@/components/page-header";
import {
  StudentsExplorer,
  type StudentSummaryRow,
} from "@/components/records/students-explorer";
import { averageByStudent } from "@/lib/tt22";

const ROLE_LABEL: Record<string, string> = {
  lop_truong: "Lớp trưởng",
  lop_pho_hoc_tap: "Lớp phó học tập",
  lop_pho_van_nghe: "Lớp phó văn nghệ",
  to_truong: "Tổ trưởng",
};

const CONDUCT_RATING: Record<
  string,
  { label: string; tone: "success" | "warning" | "error" | "primary" }
> = {
  tot: { label: "Tốt", tone: "success" },
  kha: { label: "Khá", tone: "primary" },
  dat: { label: "Đạt", tone: "warning" },
  chua_dat: { label: "Chưa đạt", tone: "error" },
};

interface ConductEvalRow {
  student_id: string;
  rating: string;
}

export default async function RecordsStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  let classQuery = supabase.from("classes").select("*").order("name");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  } else if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const { data: classData } = await classQuery;
  const classes = (classData ?? []) as ClassRoom[];
  const selected =
    classes.find((c) => c.id === classParam) ??
    classes.find((c) => c.status === "active") ??
    classes[0];

  if (!selected) {
    return (
      <div>
        <PageHeader
          section="Phân hệ I - Hồ sơ lớp học"
          title="Chi tiết hồ sơ học sinh"
        />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Bạn chưa được phân công lớp nào.
        </p>
      </div>
    );
  }

  const [studentsRes, groupsRes, rolesRes] = await Promise.all([
    supabase
      .from("students")
      .select("*")
      .eq("class_id", selected.id)
      .order("code"),
    supabase.from("student_groups").select("*").eq("class_id", selected.id),
    supabase.from("class_roles").select("student_id,role"),
  ]);
  const students = (studentsRes.data ?? []) as Student[];
  const groups = (groupsRes.data ?? []) as StudentGroup[];
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const studentIds = new Set(students.map((s) => s.id));
  const roleByStudent = new Map(
    ((rolesRes.data ?? []) as { student_id: string; role: string }[])
      .filter((r) => studentIds.has(r.student_id))
      .map((r) => [r.student_id, r.role]),
  );

  const ids = [...studentIds];
  const [gradesRes, conductRes] = ids.length
    ? await Promise.all([
        supabase
          .from("grades")
          .select("student_id,subject_id,term,assessment_type,score")
          .in("student_id", ids)
          .limit(20000),
        supabase
          .from("conduct_evaluations")
          .select("student_id,rating")
          .in("student_id", ids)
          .limit(5000),
      ])
    : [{ data: [] }, { data: [] }];

  // attendance_records có thể vượt giới hạn 1000 dòng/request - phân trang
  const attRows: { student_id: string; status: AttendanceStatus }[] = [];
  if (ids.length > 0) {
    const pageSize = 1000;
    for (let from = 0; from < 30000; from += pageSize) {
      const { data } = await supabase
        .from("attendance_records")
        .select("student_id,status")
        .in("student_id", ids)
        .order("date", { ascending: false })
        .range(from, from + pageSize - 1);
      const batch = (data ?? []) as {
        student_id: string;
        status: AttendanceStatus;
      }[];
      attRows.push(...batch);
      if (batch.length < pageSize) break;
    }
  }

  const studentAvgMap = averageByStudent(
    (gradesRes.data ?? []) as {
      student_id: string;
      subject_id: string;
      term: string;
      assessment_type: string;
      score: number | null;
    }[],
  );

  const attCount = new Map<string, { attended: number; total: number }>();
  for (const a of attRows) {
    const cur = attCount.get(a.student_id) ?? { attended: 0, total: 0 };
    cur.total += 1;
    if (a.status === "present" || a.status === "late") cur.attended += 1;
    attCount.set(a.student_id, cur);
  }

  const conductByStudent = new Map(
    ((conductRes.data ?? []) as ConductEvalRow[]).map((c) => [
      c.student_id,
      c.rating,
    ]),
  );

  const rows: StudentSummaryRow[] = students.map((s) => {
    const sc = studentAvgMap.get(s.id);
    const at = attCount.get(s.id);
    const rating = conductByStudent.get(s.id);
    const c = rating ? CONDUCT_RATING[rating] : undefined;
    return {
      id: s.id,
      code: s.code,
      nationalId: s.national_id,
      fullName: s.full_name,
      gender: s.gender,
      dob: s.dob,
      status: s.status,
      groupName: s.group_id ? (groupName.get(s.group_id) ?? null) : null,
      roleLabel: roleByStudent.has(s.id)
        ? (ROLE_LABEL[roleByStudent.get(s.id)!] ?? roleByStudent.get(s.id)!)
        : null,
      positivePoints: s.positive_points,
      avgScore: sc ?? null,
      attendancePct:
        at && at.total > 0 ? Math.round((at.attended / at.total) * 100) : null,
      conductLabel: c?.label ?? null,
      conductTone: c?.tone ?? "muted",
    };
  });

  return (
    <div>
      <PageHeader
        section="Phân hệ I - Hồ sơ lớp học"
        title="Chi tiết hồ sơ học sinh"
        description="Tra cứu hồ sơ tổng hợp của từng học sinh: thông tin, điểm trung bình, chuyên cần và hạnh kiểm. Nhấn vào một dòng để xem chi tiết."
      />
      <StudentsExplorer
        students={rows}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        selectedClassId={selected.id}
        className={selected.name}
      />
    </div>
  );
}
