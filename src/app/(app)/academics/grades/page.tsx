import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { FilterSelect } from "@/components/academics/filter-select";
import { GradesEditor } from "@/components/academics/grades-editor";
import { ClassReportExport } from "@/components/academics/class-report-export";

interface ClassRow {
  id: string;
  name: string;
}
interface StudentRow {
  id: string;
  code: string;
  national_id: string | null;
  full_name: string;
  dob: string | null;
}
interface SubjectRow {
  id: string;
  name: string;
  assessment_method: "score" | "comment";
}
interface GradeRow {
  id: string;
  student_id: string;
  assessment_type: "ddg_tx" | "ddg_gk" | "ddg_ck";
  score: number | null;
  result: "dat" | "chua_dat" | null;
  comment: string | null;
  level: "T" | "H" | "C" | null;
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
  const [{ data: classData }, { data: subjectData }, { data: schoolData }] =
    await Promise.all([
      classQuery.order("name"),
      supabase
        .from("subjects")
        .select("id,name,assessment_method")
        .order("name"),
      profile.school_id
        ? supabase
            .from("schools")
            .select("level")
            .eq("id", profile.school_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  const schoolLevel =
    (schoolData?.level as "th" | "thcs" | "thpt" | "lien_cap" | undefined) ??
    "thcs";
  const classes = (classData ?? []) as ClassRow[];
  const subjects = (subjectData ?? []) as SubjectRow[];

  const classId =
    typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (classes[0]?.id ?? "");

  const subject =
    typeof sp.subject === "string"
      ? (subjects.find((s) => s.id === sp.subject) ??
        subjects.find((s) => s.name === "Toán") ??
        subjects[0])
      : (subjects.find((s) => s.name === "Toán") ?? subjects[0]);
  const subjectId = subject?.id ?? "";
  const method = subject?.assessment_method ?? "score";

  const term =
    typeof sp.term === "string" && TERMS.some((t) => t.value === sp.term)
      ? sp.term
      : "hk1";

  const { data: studentData } = classId
    ? await supabase
        .from("students")
        .select("id,code,national_id,full_name,dob")
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
          .select("id,student_id,assessment_type,score,result,comment,level")
          .in("student_id", studentIds)
          .eq("subject_id", subjectId)
          .eq("term", term)
      : { data: [] };
  const grades = (gradeData ?? []) as GradeRow[];

  const className = classes.find((c) => c.id === classId)?.name ?? "";
  const subjectName = subject?.name ?? "";

  return (
    <div className="space-y-4">
      <PageHeader
        section="Học tập"
        title="Nhập / đồng bộ điểm"
        description="Sổ điểm theo Thông tư 22/2021: điểm đánh giá thường xuyên (ĐĐGtx), giữa kỳ (ĐĐGgk), cuối kỳ (ĐĐGck)."
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
          label="Học kỳ"
          value={term}
          options={TERMS}
          params={params}
        />
        {classId && (
          <span className="ml-auto self-center">
            <ClassReportExport
              classId={classId}
              className={className}
              term={term}
              schoolLevel={schoolLevel}
            />
          </span>
        )}
      </div>

      <div className="rounded-xl border border-border bg-primary-bg p-3 text-sm text-primary">
        {schoolLevel === "th" ? (
          <>
            Tiểu học: đánh giá theo mức T (Hoàn thành tốt) / H (Hoàn thành) /
            C (Chưa hoàn thành) theo từng đợt, kèm Điểm KTĐK và nhận xét theo
            mẫu biểu CSDL ngành.
          </>
        ) : method === "score" ? (
          <>
            ĐTB môn học kỳ = (Tổng ĐĐGtx + 2 x ĐĐGgk + 3 x ĐĐGck) / (số ĐĐGtx +
            5), làm tròn 1 chữ số thập phân. Nhập nhiều điểm ĐĐGtx cách nhau
            bởi dấu cách hoặc dấu phẩy. Template nhận dạng học sinh theo Mã
            định danh Bộ GD&ĐT (hoặc Mã HS nội bộ).
          </>
        ) : (
          <>
            Môn <strong>{subjectName}</strong> đánh giá bằng nhận xét
            (Đạt/Chưa đạt) theo Thông tư 22/2021 - không nhập điểm số.
          </>
        )}
      </div>

      {classId && subjectId ? (
        <GradesEditor
          key={`${classId}-${subjectId}-${term}`}
          students={students}
          grades={grades}
          subjectId={subjectId}
          term={term}
          method={method}
          meId={profile.id}
          className={className}
          schoolLevel={schoolLevel}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Chưa có lớp hoặc môn học để nhập điểm {className} {subjectName}.
        </div>
      )}
    </div>
  );
}
