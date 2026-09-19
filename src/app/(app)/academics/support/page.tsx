import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge, FLOW_STATUS } from "@/components/status-badge";
import { FilterSelect } from "@/components/academics/filter-select";
import { SupportPlanButton } from "@/components/academics/support-plan-button";

interface ClassRow {
  id: string;
  name: string;
}
interface StudentRow {
  id: string;
  code: string;
  full_name: string;
}
interface SubjectRow {
  id: string;
  name: string;
}
interface GradeRow {
  student_id: string;
  subject_id: string;
  score: number;
}
interface PlanRow {
  id: string;
  student_id: string;
  subject_id: string;
  status: keyof typeof FLOW_STATUS;
}

function toParams(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireProfile();
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

  const classId =
    typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (classes[0]?.id ?? "");

  const [{ data: subjectData }, { data: studentData }] = await Promise.all([
    supabase.from("subjects").select("id,name").order("name"),
    classId
      ? supabase
          .from("students")
          .select("id,code,full_name")
          .eq("class_id", classId)
          .eq("status", "active")
          .order("full_name")
      : Promise.resolve({ data: [] }),
  ]);
  const subjects = (subjectData ?? []) as SubjectRow[];
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const students = (studentData ?? []) as StudentRow[];
  const studentName = new Map(students.map((s) => [s.id, s]));
  const studentIds = students.map((s) => s.id);

  const [{ data: gradeData }, { data: planData }] = studentIds.length
    ? await Promise.all([
        supabase
          .from("grades")
          .select("student_id,subject_id,score")
          .in("student_id", studentIds)
          .eq("assessment_type", "hoc_ky"),
        supabase
          .from("support_plans")
          .select("id,student_id,subject_id,status")
          .in("student_id", studentIds)
          .neq("status", "cancelled"),
      ])
    : [{ data: [] }, { data: [] }];
  const grades = (gradeData ?? []) as GradeRow[];
  const plans = (planData ?? []) as PlanRow[];

  const planKey = new Map(plans.map((p) => [`${p.student_id}:${p.subject_id}`, p]));

  // Điểm TB theo cặp (học sinh, môn)
  const pairScores = new Map<string, number[]>();
  for (const g of grades) {
    const key = `${g.student_id}:${g.subject_id}`;
    const arr = pairScores.get(key) ?? [];
    arr.push(g.score);
    pairScores.set(key, arr);
  }

  const weak = [...pairScores.entries()]
    .map(([key, scores]) => {
      const [student_id, subject_id] = key.split(":");
      return {
        student_id,
        subject_id,
        avg: Math.round(avg(scores) * 100) / 100,
      };
    })
    .filter((w) => w.avg < 5 && studentName.has(w.student_id))
    .sort((a, b) => a.avg - b.avg);

  const withPlan = weak.filter((w) =>
    planKey.has(`${w.student_id}:${w.subject_id}`),
  ).length;

  return (
    <div className="space-y-4">
      <PageHeader
        section="Phân hệ III - Học tập"
        title="Học sinh cần hỗ trợ"
        description="Danh sách học sinh có điểm trung bình môn dưới 5.0 và kế hoạch hỗ trợ tương ứng."
      />

      <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <FilterSelect
          name="class"
          label="Lớp"
          value={classId}
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
          params={params}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="HS/môn dưới 5.0"
          value={weak.length}
          tone="error"
        />
        <StatCard label="Đã có kế hoạch" value={withPlan} tone="success" />
        <StatCard
          label="Chưa có kế hoạch"
          value={weak.length - withPlan}
          tone="warning"
        />
      </div>

      <DataTable
        columns={["Học sinh", "Môn yếu", "Điểm TB", "Trạng thái kế hoạch", "Thao tác"]}
        footer={<span>{weak.length} cặp học sinh – môn cần hỗ trợ</span>}
      >
        {weak.map((w) => {
          const plan = planKey.get(`${w.student_id}:${w.subject_id}`);
          const st = plan ? FLOW_STATUS[plan.status] : null;
          const student = studentName.get(w.student_id);
          return (
            <tr key={`${w.student_id}-${w.subject_id}`}>
              <td>
                <div className="font-medium">{student?.full_name}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {student?.code}
                </div>
              </td>
              <td>{subjectName.get(w.subject_id) ?? "—"}</td>
              <td>
                <span className="font-semibold text-error">
                  {w.avg.toFixed(2)}
                </span>
              </td>
              <td>
                {st ? (
                  <StatusBadge label={st.label} tone={st.tone} />
                ) : (
                  <StatusBadge label="Chưa có" tone="muted" />
                )}
              </td>
              <td>
                {!plan && (
                  <SupportPlanButton
                    studentId={w.student_id}
                    subjectId={w.subject_id}
                    avg={w.avg}
                    meId={profile.id}
                  />
                )}
              </td>
            </tr>
          );
        })}
        {weak.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center text-muted-foreground">
              Không có học sinh nào dưới 5.0. 
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
