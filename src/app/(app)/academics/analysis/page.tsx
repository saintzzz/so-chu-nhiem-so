import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ChartCard, BarChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { FilterSelect } from "@/components/academics/filter-select";

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

interface RankedStudent extends StudentRow {
  avg: number;
  count: number;
}

function StudentTable({
  rows,
  tone,
}: {
  rows: RankedStudent[];
  tone: "success" | "error";
}) {
  return (
    <DataTable columns={["#", "Họ và tên", "Điểm TB", "Đánh giá"]}>
      {rows.map((s, i) => (
        <tr key={s.id}>
          <td className="text-muted-foreground">{i + 1}</td>
          <td className="font-medium">{s.full_name}</td>
          <td className="font-semibold">{s.avg.toFixed(2)}</td>
          <td>
            <StatusBadge
              label={s.avg >= 8 ? "Xuất sắc" : s.avg >= 6.5 ? "Khá" : "Yếu"}
              tone={tone}
            />
          </td>
        </tr>
      ))}
      {rows.length === 0 && (
        <tr>
          <td colSpan={4} className="text-center text-muted-foreground">
            Chưa có dữ liệu điểm.
          </td>
        </tr>
      )}
    </DataTable>
  );
}

export default async function AnalysisPage({
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

  const { data: subjectData } = await supabase
    .from("subjects")
    .select("id,name")
    .order("name");
  const subjects = (subjectData ?? []) as SubjectRow[];
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

  const { data: studentData } = classId
    ? await supabase
        .from("students")
        .select("id,code,full_name")
        .eq("class_id", classId)
        .eq("status", "active")
        .order("full_name")
    : { data: [] };
  const students = (studentData ?? []) as StudentRow[];
  const studentIds = students.map((s) => s.id);

  const { data: gradeData } = studentIds.length
    ? await supabase
        .from("grades")
        .select("student_id,subject_id,score")
        .in("student_id", studentIds)
        .eq("assessment_type", "hoc_ky")
    : { data: [] };
  const grades = (gradeData ?? []) as GradeRow[];

  // Điểm TB theo môn (trung bình các kỳ đã nhập)
  const bySubject = new Map<string, number[]>();
  for (const g of grades) {
    const arr = bySubject.get(g.subject_id) ?? [];
    arr.push(g.score);
    bySubject.set(g.subject_id, arr);
  }
  const subjectChart = [...bySubject.entries()]
    .map(([sid, scores]) => ({
      label: subjectName.get(sid) ?? "-",
      value: Math.round(avg(scores) * 10) / 10,
    }))
    .sort((a, b) => b.value - a.value);

  // Điểm TB tổng của từng học sinh
  const byStudent = new Map<string, number[]>();
  for (const g of grades) {
    const arr = byStudent.get(g.student_id) ?? [];
    arr.push(g.score);
    byStudent.set(g.student_id, arr);
  }
  const ranked = students
    .map((s) => ({
      ...s,
      avg: Math.round(avg(byStudent.get(s.id) ?? []) * 100) / 100,
      count: (byStudent.get(s.id) ?? []).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.avg - a.avg);

  const buckets = [
    { label: "< 5.0", value: 0 },
    { label: "5.0 - 6.4", value: 0 },
    { label: "6.5 - 7.9", value: 0 },
    { label: "≥ 8.0", value: 0 },
  ];
  for (const s of ranked) {
    if (s.avg < 5) buckets[0].value++;
    else if (s.avg < 6.5) buckets[1].value++;
    else if (s.avg < 8) buckets[2].value++;
    else buckets[3].value++;
  }

  const classAvg = Math.round(avg(ranked.map((s) => s.avg)) * 100) / 100;
  const weakCount = buckets[0].value;
  const top = ranked.slice(0, 5);
  const bottom = ranked.slice(-5).reverse();

  return (
    <div className="space-y-4">
      <PageHeader
        section="Phân hệ III - Học tập"
        title="Phân tích kết quả học tập"
        description="Thống kê điểm trung bình theo môn, phân bố kết quả và học sinh đầu/cuối lớp."
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sĩ số" value={students.length} />
        <StatCard
          label="Điểm TB cả lớp"
          value={classAvg.toFixed(2)}
          tone="primary"
        />
        <StatCard label="HS dưới 5.0" value={weakCount} tone="error" />
        <StatCard label="Số môn có điểm" value={subjectChart.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Điểm trung bình theo môn"
          ariaDescription="Biểu đồ cột điểm trung bình các môn học của lớp"
        >
          <BarChart data={subjectChart} />
        </ChartCard>
        <ChartCard
          title="Phân bố điểm trung bình"
          ariaDescription="Biểu đồ cột phân bố học sinh theo khoảng điểm trung bình"
        >
          <BarChart data={buckets} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-base font-semibold">Top 5 học sinh</h3>
          <StudentTable rows={top} tone="success" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold">5 học sinh cần cố gắng</h3>
          <StudentTable rows={bottom} tone="error" />
        </div>
      </div>
    </div>
  );
}
