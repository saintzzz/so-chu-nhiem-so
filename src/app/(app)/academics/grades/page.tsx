import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { FilterSelect } from "@/components/academics/filter-select";
import { GradesEditor } from "@/components/academics/grades-editor";

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
  id: string;
  student_id: string;
  score: number;
}

const TERMS = [
  { value: "gk1", label: "Giữa kỳ I" },
  { value: "ck1", label: "Cuối kỳ I" },
  { value: "gk2", label: "Giữa kỳ II" },
  { value: "ck2", label: "Cuối kỳ II" },
];

function toParams(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong", "bgh"]);
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
  const [{ data: classData }, { data: subjectData }] = await Promise.all([
    classQuery.order("name"),
    supabase.from("subjects").select("id,name").order("name"),
  ]);
  const classes = (classData ?? []) as ClassRow[];
  const subjects = (subjectData ?? []) as SubjectRow[];

  const classId =
    typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (classes[0]?.id ?? "");

  const subjectId =
    typeof sp.subject === "string" && subjects.some((s) => s.id === sp.subject)
      ? sp.subject
      : (subjects.find((s) => s.name === "Toán")?.id ?? subjects[0]?.id ?? "");

  const term =
    typeof sp.term === "string" && TERMS.some((t) => t.value === sp.term)
      ? sp.term
      : "gk1";

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
  const { data: gradeData } =
    studentIds.length && subjectId
      ? await supabase
          .from("grades")
          .select("id,student_id,score")
          .in("student_id", studentIds)
          .eq("subject_id", subjectId)
          .eq("term", term)
          .eq("assessment_type", "hoc_ky")
      : { data: [] };
  const grades = (gradeData ?? []) as GradeRow[];

  const className = classes.find((c) => c.id === classId)?.name ?? "";
  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "";

  return (
    <div className="space-y-4">
      <PageHeader
        section="Phân hệ III - Học tập"
        title="Nhập / đồng bộ điểm"
        description="Nhập và đồng bộ điểm định kỳ của học sinh theo lớp và môn học."
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
          name="subject"
          label="Môn học"
          value={subjectId}
          options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          params={params}
        />
        <FilterSelect
          name="term"
          label="Kỳ đánh giá"
          value={term}
          options={TERMS}
          params={params}
        />
      </div>

      <div className="rounded-xl border border-border bg-primary-bg p-3 text-sm text-primary">
        Điểm học kỳ được <strong>đồng bộ</strong> từ sổ điểm điện tử của giáo
        viên bộ môn. GVCN có thể chỉnh sửa và bấm “Lưu điểm” để cập nhật lại
        hệ thống.
      </div>

      {classId && subjectId ? (
        <GradesEditor
          key={`${classId}-${subjectId}-${term}`}
          students={students}
          grades={grades}
          subjectId={subjectId}
          term={term}
          meId={profile.id}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Chưa có lớp hoặc môn học để nhập điểm {className} {subjectName}.
        </div>
      )}
    </div>
  );
}
