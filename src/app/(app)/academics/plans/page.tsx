import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge, FLOW_STATUS } from "@/components/status-badge";
import { FilterSelect } from "@/components/academics/filter-select";
import { PlanActions } from "@/components/academics/plan-actions";

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
interface SubjectRow {
  id: string;
  name: string;
}
type PlanStatus =
  | "draft"
  | "pending"
  | "approved"
  | "in_progress"
  | "done"
  | "cancelled";
interface PlanRow {
  id: string;
  student_id: string;
  subject_id: string;
  reason: string;
  plan: string;
  status: PlanStatus;
  created_at: string;
}

const STATUS_FILTERS = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "draft", label: "Nháp" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "in_progress", label: "Đang thực hiện" },
  { value: "done", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
];

function toParams(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const sp = await searchParams;
  const params = toParams(sp);
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
  const classIds = classes.map((c) => c.id);
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const statusFilter =
    typeof sp.status === "string" &&
    STATUS_FILTERS.some((s) => s.value === sp.status)
      ? sp.status
      : "all";

  const { data: studentData } = classIds.length
    ? await supabase
        .from("students")
        .select("id,class_id,code,full_name")
        .in("class_id", classIds)
    : { data: [] };
  const students = (studentData ?? []) as StudentRow[];
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const studentIds = students.map((s) => s.id);

  const [{ data: planData }, { data: subjectData }] = studentIds.length
    ? await Promise.all([
        supabase
          .from("support_plans")
          .select("id,student_id,subject_id,reason,plan,status,created_at")
          .in("student_id", studentIds)
          .order("created_at", { ascending: false }),
        supabase.from("subjects").select("id,name"),
      ])
    : [{ data: [] }, { data: [] }];
  const allPlans = (planData ?? []) as PlanRow[];
  const subjects = (subjectData ?? []) as SubjectRow[];
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

  const plans =
    statusFilter === "all"
      ? allPlans
      : allPlans.filter((p) => p.status === statusFilter);

  const inProgress = allPlans.filter((p) => p.status === "in_progress").length;
  const done = allPlans.filter((p) => p.status === "done").length;

  return (
    <div className="space-y-4">
      <PageHeader
        section="Phân hệ III - Học tập"
        title="Kế hoạch hỗ trợ & tiến bộ"
        description="Theo dõi và phê duyệt các kế hoạch hỗ trợ học sinh yếu."
      />

      <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <FilterSelect
          name="status"
          label="Trạng thái"
          value={statusFilter}
          options={STATUS_FILTERS}
          params={params}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng kế hoạch" value={allPlans.length} />
        <StatCard
          label="Chờ duyệt"
          value={allPlans.filter((p) => p.status === "pending").length}
          tone="warning"
        />
        <StatCard label="Đang thực hiện" value={inProgress} tone="primary" />
        <StatCard label="Hoàn thành" value={done} tone="success" />
      </div>

      <DataTable
        columns={[
          "Học sinh",
          "Lớp",
          "Môn",
          "Lý do",
          "Kế hoạch",
          "Trạng thái",
          "Thao tác",
        ]}
        footer={<span>{plans.length} kế hoạch</span>}
      >
        {plans.map((p) => {
          const student = studentMap.get(p.student_id);
          const st = FLOW_STATUS[p.status] ?? {
            label: p.status,
            tone: "muted" as const,
          };
          return (
            <tr key={p.id}>
              <td>
                <div className="font-medium">{student?.full_name ?? "-"}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {student?.code}
                </div>
              </td>
              <td>{student ? (className.get(student.class_id) ?? "-") : "-"}</td>
              <td>{subjectName.get(p.subject_id) ?? "-"}</td>
              <td className="max-w-48">{p.reason}</td>
              <td className="max-w-56">{p.plan}</td>
              <td>
                <StatusBadge label={st.label} tone={st.tone} />
              </td>
              <td>
                <PlanActions planId={p.id} status={p.status} meId={profile.id} />
              </td>
            </tr>
          );
        })}
        {plans.length === 0 && (
          <tr>
            <td colSpan={7} className="text-center text-muted-foreground">
              Chưa có kế hoạch hỗ trợ nào.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
