import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { requireRoles } from "@/lib/auth";
import { sortByVietnameseName } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { FilterSelect } from "@/components/academics/filter-select";
import { GradesEditor } from "@/components/academics/grades-editor";
import { ClassReportExport } from "@/components/academics/class-report-export";
import { hasRole, hasAnyRole } from "@/lib/roles";

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
  seq: number | null;
  subtype: string | null;
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
  if (hasRole(profile, "gvcn")) {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  }
  // gvcn/gvbm/to_truong: lay them lop minh duoc phan cong day (timetable_entries)
  const teachQuery = hasAnyRole(profile, ["gvcn", "gvbm", "to_truong"])
    ? supabase
        .from("timetable_entries")
        .select("class_id,subject_id")
        .eq("teacher_id", profile.id)
    : null;
  const [
    { data: classData, error: classErr },
    { data: subjectData, error: subjectErr },
    { data: schoolData, error: schoolErr },
    teachRes,
  ] = await Promise.all([
    classQuery.order("name"),
    supabase
      .from("subjects")
      .select("id,name,assessment_method")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    profile.school_id
      ? supabase
          .from("schools")
          .select("level")
          .eq("id", profile.school_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    teachQuery ?? Promise.resolve({ data: null, error: null }),
  ]);
  const schoolLevel =
    (schoolData?.level as "th" | "thcs" | "thpt" | "lien_cap" | undefined) ??
    "thcs";
  let classes = (classData ?? []) as ClassRow[];
  let subjects = (subjectData ?? []) as SubjectRow[];
  const teaching = (teachRes.data ?? null) as
    | { class_id: string; subject_id: string }[]
    | null;
  let missingErr: { message: string } | null = null;
  if (teaching) {
    const taughtClassIds = new Set(teaching.map((t) => t.class_id));
    if (hasRole(profile, "gvcn")) {
      // GVCN kiem day: them lop minh day vao picker (ngoai lop CN)
      const { data: missingData, error: mErr } = taughtClassIds.size
        ? await supabase
            .from("classes")
            .select("id,name")
            .in("id", [...taughtClassIds])
            .eq("status", "active")
        : { data: [], error: null };
      missingErr = mErr;
      const have = new Set(classes.map((c) => c.id));
      classes = [
        ...classes,
        ...((missingData ?? []) as ClassRow[]).filter((c) => !have.has(c.id)),
      ].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // gvbm/to_truong: chi lop + mon minh day
      const taughtSubjectIds = new Set(teaching.map((t) => t.subject_id));
      classes = classes.filter((c) => taughtClassIds.has(c.id));
      subjects = subjects.filter((s) => taughtSubjectIds.has(s.id));
    }
  }

  const classId =
    typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (classes[0]?.id ?? "");

  // Chi mon duoc phan cong day trong lop dang chon - tranh chon cap
  // (lop, mon) khong phan cong -> RLS chan khi luu.
  // GVCN xem lop CN van duoc full mon (nhap diem CN moi mon).
  if (teaching && classId) {
    const isHomeroom =
      hasRole(profile, "gvcn") &&
      (classData ?? []).some((c) => (c as ClassRow).id === classId);
    if (!isHomeroom) {
      const taughtHere = new Set(
        teaching.filter((t) => t.class_id === classId).map((t) => t.subject_id),
      );
      subjects = subjects.filter((s) => taughtHere.has(s.id));
    }
  }

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

  const { data: studentData, error: studentErr } = classId
    ? await supabase
        .from("students")
        .select("id,code,national_id,full_name,dob")
        .eq("class_id", classId)
        .eq("status", "active")
        .order("full_name")
    : { data: [], error: null };
  const students = sortByVietnameseName(
    (studentData ?? []) as StudentRow[],
    (s) => s.full_name,
  );

  const studentIds = students.map((s) => s.id);
  // R14-01: grades co the vuot PostgREST cap (so HS x so cot diem) ->
  // fetchAllRows; error||truncated = du lieu thieu, phai chan editor vi
  // scn_save_grades la replace-all (luu tren nguon thieu = xoa diem cu).
  const gradesRes =
    studentIds.length && subjectId
      ? await fetchAllRows<GradeRow>((f, t) =>
          supabase
            .from("grades")
            .select(
              "id,student_id,assessment_type,score,result,comment,level,seq,subtype",
            )
            .in("student_id", studentIds)
            .eq("subject_id", subjectId)
            .eq("term", term)
            .order("id")
            .range(f, t),
        )
      : { rows: [] as GradeRow[], error: null, truncated: false };
  const grades = gradesRes.rows;

  const className = classes.find((c) => c.id === classId)?.name ?? "";
  const subjectName = subject?.name ?? "";

  // R14-01: bat cu query nguon nao loi (hoac bi truncate) -> khoa editor.
  // scn_save_grades la replace-all: mount editor tren du lieu thieu roi bam
  // Luu se xoa sach diem hien co cua ca lop.
  const srcErrors = Object.entries({
    classes: classErr?.message ?? null,
    subjects: subjectErr?.message ?? null,
    schools: schoolErr?.message ?? null,
    timetable_entries: teachRes.error?.message ?? null,
    classes_teaching: missingErr?.message ?? null,
    students: studentErr?.message ?? null,
    grades: gradesRes.error ?? (gradesRes.truncated ? "truncated" : null),
  }).filter(([, e]) => e);
  const loadError = srcErrors.length > 0;
  if (loadError) {
    console.error(
      "[academics/grades] load:",
      srcErrors.map(([k, e]) => `${k}: ${e}`).join("; "),
    );
  }

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
            5), làm tròn 1 chữ số thập phân. ĐĐGtx gồm các cột Miệng, Kiểm tra
            15 phút, Kiểm tra 1 tiết (hệ số 1) - thêm cột tuỳ ý bằng nút Thêm
            cột điểm. Template nhận dạng học sinh theo Mã định danh Bộ GD&ĐT
            (hoặc Mã HS nội bộ).
          </>
        ) : (
          <>
            Môn <strong>{subjectName}</strong> đánh giá bằng nhận xét
            (Đạt/Chưa đạt) theo Thông tư 22/2021 - không nhập điểm số.
          </>
        )}
      </div>

      {loadError ? (
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải được dữ liệu. Vui lòng thử lại.
        </p>
      ) : classId && subjectId ? (
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
