import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge, SEVERITY } from "@/components/status-badge";
import { CaseControls } from "@/components/counseling/case-controls";

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

export default async function CounselingAssessmentPage() {
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
    : { data: [] };
  const students = (studentData ?? []) as StudentRow[];
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const studentIds = students.map((s) => s.id);

  const { data: caseData } = studentIds.length
    ? await supabase
        .from("counseling_cases")
        .select("id,student_id,issue,severity,status,created_at")
        .in("student_id", studentIds)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
    : { data: [] };
  const cases = (caseData ?? []) as CaseRow[];

  const highCount = cases.filter(
    (c) => c.severity === "high" || c.severity === "critical",
  ).length;
  const counselingCount = cases.filter(
    (c) => c.status === "counseling" || c.status === "assessing",
  ).length;

  return (
    <div className="space-y-4">
      <PageHeader
        section="Phân hệ V - Tư vấn học sinh"
        title="Đánh giá mức độ"
        description="Đánh giá mức độ nghiêm trọng và cập nhật trạng thái xử lý của từng ca."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Ca đang mở" value={cases.length} />
        <StatCard label="Mức độ cao/nghiêm trọng" value={highCount} tone="error" />
        <StatCard label="Đang tư vấn/đánh giá" value={counselingCount} tone="primary" />
      </div>

      <DataTable
        columns={[
          "Ngày",
          "Học sinh",
          "Lớp",
          "Vấn đề",
          "Mức độ",
          "Đánh giá & trạng thái",
        ]}
        footer={<span>{cases.length} ca đang mở</span>}
      >
        {cases.map((c) => {
          const sev = SEVERITY[c.severity] ?? {
            label: c.severity,
            tone: "muted" as const,
          };
          const student = studentMap.get(c.student_id);
          return (
            <tr key={c.id}>
              <td className="whitespace-nowrap text-muted-foreground">
                {new Date(c.created_at).toLocaleDateString("vi-VN")}
              </td>
              <td>
                <div className="font-medium">{student?.full_name ?? "-"}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {student?.code}
                </div>
              </td>
              <td>{student ? (className.get(student.class_id) ?? "-") : "-"}</td>
              <td className="max-w-72">{c.issue}</td>
              <td>
                <StatusBadge label={sev.label} tone={sev.tone} />
              </td>
              <td>
                <CaseControls
                  caseId={c.id}
                  severity={c.severity}
                  status={c.status}
                />
              </td>
            </tr>
          );
        })}
        {cases.length === 0 && (
          <tr>
            <td colSpan={6} className="text-center text-muted-foreground">
              Không có ca nào đang mở.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
