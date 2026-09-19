import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge, SEVERITY } from "@/components/status-badge";
import { CounselingIntakeForm } from "@/components/counseling/intake-form";

interface ClassRow {
  id: string;
  name: string;
}
interface StudentRow {
  id: string;
  class_id: string;
  code: string;
  full_name: string;
}
interface CaseRow {
  id: string;
  student_id: string;
  issue: string;
  severity: keyof typeof SEVERITY;
  status: string;
  created_at: string;
}

export default async function CounselingIntakePage() {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const supabase = await createClient();

  let classQuery = supabase
    .from("classes")
    .select("id,name")
    .eq("status", "active");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  }
  const { data: classData } = await classQuery.order("name");
  const classes = (classData ?? []) as ClassRow[];
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const classIds = classes.map((c) => c.id);

  const { data: studentData } = classIds.length
    ? await supabase
        .from("students")
        .select("id,class_id,code,full_name")
        .in("class_id", classIds)
        .eq("status", "active")
        .order("full_name")
    : { data: [] };
  const students = (studentData ?? []) as StudentRow[];
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const studentIds = students.map((s) => s.id);

  const { data: caseData } = studentIds.length
    ? await supabase
        .from("counseling_cases")
        .select("id,student_id,issue,severity,status,created_at")
        .in("student_id", studentIds)
        .eq("status", "new")
        .order("created_at", { ascending: false })
    : { data: [] };
  const newCases = (caseData ?? []) as CaseRow[];

  const formStudents = students.map((s) => ({
    id: s.id,
    code: s.code,
    full_name: s.full_name,
    class_name: className.get(s.class_id) ?? "",
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        section="Phân hệ V - Tư vấn học sinh"
        title="Tiếp nhận & phát hiện"
        description="Ghi nhận các dấu hiệu học sinh cần tư vấn tâm lý / hỗ trợ."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Học sinh trong lớp" value={students.length} />
        <StatCard label="Ca mới tiếp nhận" value={newCases.length} tone="primary" />
        <StatCard
          label="Ca mức độ cao"
          value={
            newCases.filter(
              (c) => c.severity === "high" || c.severity === "critical",
            ).length
          }
          tone="error"
        />
      </div>

      <CounselingIntakeForm students={formStudents} meId={profile.id} />

      <div className="space-y-2">
        <h3 className="text-base font-semibold">Ca mới tiếp nhận</h3>
        <DataTable
          columns={["Ngày", "Học sinh", "Lớp", "Vấn đề", "Mức độ", "Trạng thái"]}
          footer={<span>{newCases.length} ca đang chờ đánh giá</span>}
        >
          {newCases.map((c) => {
            const sev = SEVERITY[c.severity] ?? {
              label: c.severity,
              tone: "muted" as const,
            };
            const student = studentMap.get(c.student_id);
            return (
              <tr key={c.id}>
                <td className="whitespace-nowrap text-muted-foreground">
                  {formatDate(c.created_at)}
                </td>
                <td>
                  <div className="font-medium">{student?.full_name ?? "-"}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {student?.code}
                  </div>
                </td>
                <td>{student ? (className.get(student.class_id) ?? "-") : "-"}</td>
                <td className="max-w-80">{c.issue}</td>
                <td>
                  <StatusBadge label={sev.label} tone={sev.tone} />
                </td>
                <td>
                  <StatusBadge label="Mới" tone="primary" />
                </td>
              </tr>
            );
          })}
          {newCases.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-muted-foreground">
                Không có ca mới nào đang chờ đánh giá.
              </td>
            </tr>
          )}
        </DataTable>
      </div>
    </div>
  );
}
