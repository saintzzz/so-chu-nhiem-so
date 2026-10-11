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
  academic_year_id: string | null;
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
  updated_at: string;
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
    .select("id,name,academic_year_id")
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
            .select("id,name,academic_year_id")
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
  // CR-049 r6 H4: editor doc cung year scope voi scn_save_grades
  // (NULL legacy + nam hoc cua lop) - khong loc se nap diem nam khac
  // vao o diem nam hien tai, luu lai ghi de sai nam.
  const classYearId =
    classes.find((c) => c.id === classId)?.academic_year_id ?? null;
  // CR-049 r7 H1 + r8 H2: revision CAS ben vung nam trong
  // grade_book_state. Doc grades + state rieng le tao race (grades R1
  // + state R2 -> expected=R2 ghi de luu cua nguoi khac). Bracket:
  // doc state truoc + sau fetch; state khong doi = snapshot nhat quan
  // (state tang moi lan luu). Doi thi doc lai - toi da 3 lan.
  const stateScope = `${subjectId}|${term}|${classYearId ?? ""}|${classId}`;
  // r9 M2: state read loi phai ro rang - null==null gia "on dinh" se
  // mo editor tren revision ao; het 3 lan unstable cung phai loadError.
  const readState = async () => {
    const { data, error } = await supabase
      .from("grade_book_state")
      .select("last_saved_at")
      .eq("scope_key", stateScope)
      .maybeSingle();
    return {
      value: (data?.last_saved_at as string | undefined) ?? null,
      error,
    };
  };
  let grades: GradeRow[] = [];
  let gradesResError: unknown = null;
  let stateRevision: string | null = null;
  if (studentIds.length && subjectId) {
    let consistent = false;
    for (let attempt = 0; attempt < 3 && !consistent; attempt++) {
      const s0 = await readState();
      if (s0.error) {
        gradesResError = s0.error;
        break;
      }
      const gr = await fetchAllRows<GradeRow>((f, t) => {
        let q = supabase
          .from("grades")
          .select(
            "id,student_id,assessment_type,score,result,comment,level,seq,subtype,updated_at",
          )
          .in("student_id", studentIds)
          .eq("subject_id", subjectId)
          .eq("term", term)
          .order("id")
          .range(f, t);
        q = classYearId
          ? q.or(
              `academic_year_id.is.null,academic_year_id.eq.${classYearId}`,
            )
          : q.is("academic_year_id", null);
        return q;
      });
      const s1 = await readState();
      if (s1.error) {
        gradesResError = s1.error;
        break;
      }
      gradesResError = gr.error ?? (gr.truncated ? "truncated" : null);
      if (gradesResError) break;
      grades = gr.rows;
      stateRevision = s0.value;
      consistent = s0.value === s1.value; // snapshot nhat quan voi s0
    }
    if (!consistent && !gradesResError) {
      gradesResError = "revision_unstable";
      grades = [];
      stateRevision = null;
    }
  }

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
    grades: gradesResError,
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
          key={`${classId}-${subjectId}-${term}-${classYearId ?? ""}`}
          students={students}
          grades={grades}
          subjectId={subjectId}
          term={term}
          method={method}
          meId={profile.id}
          className={className}
          schoolLevel={schoolLevel}
          stateRevision={stateRevision}
          classYearId={classYearId}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Chưa có lớp hoặc môn học để nhập điểm {className} {subjectName}.
        </div>
      )}
    </div>
  );
}
