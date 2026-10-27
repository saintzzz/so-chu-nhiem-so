import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/modules";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import type { FLOW_STATUS } from "@/components/status-badge";
import { FilterSelect } from "@/components/academics/filter-select";
import {
  SupportPlanBoard,
  type WeakPair,
} from "@/components/academics/support-plan-board";
import { semesterAverage } from "@/lib/tt22";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { gradeYearOr } from "@/lib/grades-year";
import { hasRole } from "@/lib/roles";
import { must } from "@/lib/supabase/must";

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
  term: string;
  assessment_type: string;
  score: number | null;
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

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  await requireModule("ky_thi_danh_gia");
  const sp = await searchParams;
  const params = toParams(sp);
  const supabase = await createClient();

  let classQuery = supabase
    .from("classes")
    .select("id,name,academic_year_id")
    .eq("status", "active");
  if (hasRole(profile, "gvcn")) {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  }
  const { data: classData, error: clsErr } = await classQuery.order("name");
  const classes = (classData ?? []) as ClassRow[];

  const classId =
    typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (classes[0]?.id ?? "");

  const [{ data: subjectData, error: subjErr }, { data: studentData, error: stuErr }] = await Promise.all([
    must(supabase.from("subjects").select("id,name").eq("school_id", profile.school_id ?? "").order("name"), "subjects"),
    classId
      ? must(supabase
          .from("students")
          .select("id,code,full_name")
          .eq("class_id", classId)
          .eq("status", "active")
          .order("full_name"), "students")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const subjects = (subjectData ?? []) as SubjectRow[];
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const students = (studentData ?? []) as StudentRow[];
  const studentName = new Map(students.map((s) => [s.id, s]));
  const studentIds = students.map((s) => s.id);

  // CR-049 r9 M8: diem scope nam hoc cua lop.
  const classYearId =
    (classes.find((c) => c.id === classId) as
      | { academic_year_id?: string | null }
      | undefined)?.academic_year_id ?? null;
  // r23 M: grades phan trang - trang sau loi phai chan board, neu khong
  // diem thieu se tinh DTB sai va tao ke hoach phu dao tren du lieu gia.
  const [{ rows: gradeData, error: gradeErr, truncated: gradeTrunc }, { data: planData, error: planErr }] = studentIds.length
    ? await Promise.all([
        fetchAllRows<GradeRow>((f, t) =>
          supabase
            .from("grades")
            .select("student_id,subject_id,term,assessment_type,score")
            .in("student_id", studentIds)
            .or(gradeYearOr(classYearId))
            .order("id")
            .range(f, t),
        ),
        must(supabase
          .from("support_plans")
          .select("id,student_id,subject_id,status")
          .in("student_id", studentIds)
          .neq("status", "cancelled"), "support_plans"),
      ])
    : [
        { rows: [] as GradeRow[], error: null, truncated: false },
        { data: [], error: null },
      ];
  const loadError =
    (clsErr ?? subjErr ?? stuErr ?? planErr) != null || gradeErr || gradeTrunc
      ? "Không tải đủ dữ liệu điểm - vui lòng tải lại trang trước khi tạo kế hoạch."
      : null;
  const grades = gradeData;
  const plans = (planData ?? []) as PlanRow[];

  const planKey = new Map(plans.map((p) => [`${p.student_id}:${p.subject_id}`, p]));

  // ĐTBm học kỳ mới nhất (HK2 nếu có, ngược lại HK1) cho từng cặp
  // (học sinh, môn) - trang flag HS đang dưới 5, vẫn phải chạy giữa năm.
  const pairRows = new Map<string, GradeRow[]>();
  for (const g of grades) {
    const key = `${g.student_id}:${g.subject_id}`;
    const arr = pairRows.get(key) ?? [];
    arr.push(g);
    pairRows.set(key, arr);
  }

  const weak = [...pairRows.entries()]
    .map(([key, rows]) => {
      const [student_id, subject_id] = key.split(":");
      const hk1 = semesterAverage(rows.filter((r) => r.term === "hk1"));
      const hk2 = semesterAverage(rows.filter((r) => r.term === "hk2"));
      return { student_id, subject_id, avg: hk2 ?? hk1 };
    })
    .filter(
      (w): w is { student_id: string; subject_id: string; avg: number } =>
        w.avg != null && w.avg < 5 && studentName.has(w.student_id),
    )
    .sort((a, b) => a.avg - b.avg);

  const withPlan = weak.filter((w) =>
    planKey.has(`${w.student_id}:${w.subject_id}`),
  ).length;

  return (
    <div className="space-y-4">
      <PageHeader
        section="Học tập"
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

      {loadError && (
        <p className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 text-sm text-error">
          {loadError}
        </p>
      )}
      <SupportPlanBoard
        key={classId ?? "all"}
        meId={profile.id}
        disabled={loadError != null}
        rows={weak.map(
          (w): WeakPair => {
            const plan = planKey.get(`${w.student_id}:${w.subject_id}`);
            return {
              studentId: w.student_id,
              subjectId: w.subject_id,
              studentName: studentName.get(w.student_id)?.full_name ?? "-",
              studentCode: studentName.get(w.student_id)?.code ?? "-",
              subjectName: subjectName.get(w.subject_id) ?? "-",
              avg: w.avg,
              planId: plan?.id ?? null,
              planStatus: plan?.status ?? null,
            };
          },
        )}
      />
    </div>
  );
}
