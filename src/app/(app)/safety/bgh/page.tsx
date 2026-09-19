import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BghTable } from "@/components/safety/bgh-table";
import type { ClassRoom, Incident, Student } from "@/types";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

export default async function SafetyBghPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Trang tổng hợp toàn trường — dùng cho BGH và GVCN tra cứu liên lớp.
  let classQuery = supabase.from("classes").select("*").order("name");
  if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const { data: classData } = await classQuery;
  const classes = (classData ?? []) as ClassRoom[];
  const classIds = classes.map((c) => c.id);
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const { data: incData } = classIds.length
    ? await supabase
        .from("incidents")
        .select("*")
        .in("class_id", classIds)
        .order("occurred_at", { ascending: false })
    : { data: [] };
  const incidents = (incData ?? []) as Incident[];

  const studentIds = [
    ...new Set(
      incidents.map((i) => i.student_id).filter((x): x is string => !!x),
    ),
  ];
  const { data: studentData } = studentIds.length
    ? await supabase
        .from("students")
        .select("id,full_name")
        .in("id", studentIds)
    : { data: [] };
  const studentName = new Map(
    ((studentData ?? []) as Pick<Student, "id" | "full_name">[]).map((s) => [
      s.id,
      s.full_name,
    ]),
  );

  const reported = incidents.filter((i) => i.reported_to_bgh).length;
  const highSeverity = incidents.filter(
    (i) => i.severity === "high" || i.severity === "critical",
  ).length;
  const open = incidents.filter(
    (i) => i.status === "new" || i.status === "following",
  ).length;

  return (
    <div>
      <PageHeader
        section="Phân hệ VIII - An toàn HS"
        title="Báo cáo BGH"
        description="Tổng hợp sự cố an toàn học sinh toàn trường và trạng thái báo cáo lên Ban Giám Hiệu."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tổng sự cố" value={incidents.length} />
        <StatCard
          label="Mức độ cao / nghiêm trọng"
          value={highSeverity}
          tone={highSeverity > 0 ? "error" : "default"}
        />
        <StatCard
          label="Đang xử lý"
          value={open}
          tone={open > 0 ? "warning" : "default"}
        />
        <StatCard label="Đã báo cáo BGH" value={reported} tone="success" />
      </div>
      <BghTable
        rows={incidents.map((i) => ({
          id: i.id,
          occurredAt: fmtDateTime(i.occurred_at),
          className: i.class_id ? (className.get(i.class_id) ?? "—") : "—",
          studentName: i.student_id
            ? (studentName.get(i.student_id) ?? "—")
            : "Sự cố chung",
          type: i.type,
          severity: i.severity,
          status: i.status,
          description: i.description,
          reported: i.reported_to_bgh,
        }))}
      />
    </div>
  );
}
