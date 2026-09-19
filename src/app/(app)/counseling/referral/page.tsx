import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { SEVERITY, FLOW_STATUS } from "@/components/status-badge";
import { ReferralCard } from "@/components/counseling/referral-card";

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
  status: keyof typeof FLOW_STATUS;
  referral: string | null;
  notes: string | null;
  created_at: string;
}

export default async function CounselingReferralPage() {
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

  // Ca nghiêm trọng / mức độ cao hoặc đã chuyển tuyến - chưa kết thúc
  const { data: caseData } = studentIds.length
    ? await supabase
        .from("counseling_cases")
        .select("id,student_id,issue,severity,status,referral,notes,created_at")
        .in("student_id", studentIds)
        .neq("status", "resolved")
        .or("severity.eq.critical,severity.eq.high,status.eq.referred")
        .order("created_at", { ascending: false })
    : { data: [] };
  const cases = (caseData ?? []) as CaseRow[];

  const critical = cases.filter((c) => c.severity === "critical").length;
  const referred = cases.filter((c) => c.status === "referred").length;

  return (
    <div className="space-y-4">
      <PageHeader
        section="Tư vấn học sinh"
        title="Chuyển tuyến chuyên gia"
        description="Các ca nghiêm trọng cần chuyển đến chuyên gia tâm lý / cơ sở chuyên môn."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Ca cần chuyển tuyến" value={cases.length} />
        <StatCard label="Nghiêm trọng" value={critical} tone="error" />
        <StatCard label="Đã chuyển tuyến" value={referred} tone="primary" />
      </div>

      <div className="rounded-xl border border-border bg-primary-bg p-3 text-sm text-primary">
        Khi ca vượt quá khả năng hỗ trợ của GVCN, hãy ghi rõ đơn vị/chuyên gia
        tiếp nhận và bấm “Lưu &amp; chuyển tuyến”. Đánh dấu “Đã xử lý” khi quá
        trình can thiệp kết thúc.
      </div>

      <div className="grid gap-4">
        {cases.map((c) => {
          const student = studentMap.get(c.student_id);
          const name = student
            ? `${student.full_name} (${student.code} - ${className.get(student.class_id) ?? ""})`
            : "-";
          return (
            <ReferralCard
              key={c.id}
              caseId={c.id}
              studentName={name}
              issue={c.issue}
              severity={c.severity}
              status={c.status}
              referral={c.referral}
              notes={c.notes}
            />
          );
        })}
        {cases.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
            Không có ca nào cần chuyển tuyến.
          </div>
        )}
      </div>
    </div>
  );
}
