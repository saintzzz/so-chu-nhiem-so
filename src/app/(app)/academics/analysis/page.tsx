import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ChartCard, BarChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { FilterSelect } from "@/components/academics/filter-select";
import { semesterAverage, scoreBand } from "@/lib/tt22";

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

const TERMS = [
  { value: "hk1", label: "Học kỳ I" },
  { value: "hk2", label: "Học kỳ II" },
];

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
          <td className="font-semibold">{s.avg.toFixed(1)}</td>
          <td>
            <StatusBadge label={scoreBand(s.avg).label} tone={tone} />
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

  const classId =
    typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (classes[0]?.id ?? "");

  const term =
    typeof sp.term === "string" && TERMS.some((t) => t.value === sp.term)
      ? sp.term
      : "hk1";

  const { data: subjectData } = await supabase
    .from("subjects")
    .select("id,name")
    .eq("school_id", profile.school_id ?? "")
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
        .select("student_id,subject_id,term,assessment_type,score")
        .in("student_id", studentIds)
        .eq("term", term)
    : { data: [] };
  const grades = (gradeData ?? []) as GradeRow[];

  // ĐTBm học kỳ theo TT22 cho từng cặp học sinh x môn
  const byStudentSubject = new Map<string, GradeRow[]>();
  for (const g of grades) {
    const key = `${g.student_id}|${g.subject_id}`;
    const arr = byStudentSubject.get(key) ?? [];
    arr.push(g);
    byStudentSubject.set(key, arr);
  }

  const studentSubjectAvg = new Map<string, number>();
  for (const [key, rows] of byStudentSubject) {
    const a = semesterAverage(rows);
    if (a != null) studentSubjectAvg.set(key, a);
  }

  // Điểm TB theo môn (TB các ĐTBm của học sinh)
  const bySubject = new Map<string, number[]>();
  for (const [key, a] of studentSubjectAvg) {
    const sid = key.split("|")[1];
    const arr = bySubject.get(sid) ?? [];
    arr.push(a);
    bySubject.set(sid, arr);
  }
  const subjectChart = [...bySubject.entries()]
    .map(([sid, scores]) => ({
      label: subjectName.get(sid) ?? "-",
      value: Math.round(avg(scores) * 10) / 10,
    }))
    .sort((a, b) => b.value - a.value);

  // Điểm TB tổng của từng học sinh (TB các môn)
  const byStudent = new Map<string, number[]>();
  for (const [key, a] of studentSubjectAvg) {
    const stid = key.split("|")[0];
    const arr = byStudent.get(stid) ?? [];
    arr.push(a);
    byStudent.set(stid, arr);
  }
  const ranked = students
    .map((s) => ({
      ...s,
      avg: Math.round(avg(byStudent.get(s.id) ?? []) * 10) / 10,
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

  const classAvg = Math.round(avg(ranked.map((s) => s.avg)) * 10) / 10;
  const weakCount = buckets[0].value;
  const top = ranked.slice(0, 5);
  const bottom = ranked.slice(-5).reverse();

  return (
    <div className="space-y-4">
      <PageHeader
        section="Học tập"
        title="Phân tích kết quả học tập"
        description="ĐTB môn học kỳ theo TT22, phân bố kết quả và học sinh đầu/cuối lớp."
      />

      <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <FilterSelect
          name="class"
          label="Lớp"
          value={classId}
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
          params={params}
        />
        <FilterSelect
          name="term"
          label="Học kỳ"
          value={term}
          options={TERMS}
          params={params}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sĩ số" value={students.length} />
        <StatCard
          label="Điểm TB cả lớp"
          value={classAvg.toFixed(1)}
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
