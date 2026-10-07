import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { FilterSelect } from "@/components/academics/filter-select";
import { ConductEvaluationEditor } from "@/components/conduct/evaluation-editor";
import {
  NlpcEditor,
  type NlpcEval,
  type NlpcCommentRow,
} from "@/components/conduct/nlpc-editor";

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
interface EvalRow {
  id: string;
  student_id: string;
  rating: string;
  comment: string | null;
}

const TERMS = [
  { value: "hk1", label: "Học kỳ I" },
  { value: "hk2", label: "Học kỳ II" },
  { value: "ca_nam", label: "Cả năm" },
];

function toParams(sp: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export default async function ConductEvaluationPage({
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
  const [{ data: classData, error: classErr }, { data: schoolData, error: schoolErr }] =
    await Promise.all([
      classQuery.order("name"),
      profile.school_id
        ? supabase
            .from("schools")
            .select("level")
            .eq("id", profile.school_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
  const classes = (classData ?? []) as ClassRow[];
  const schoolLevel =
    (schoolData?.level as "th" | "thcs" | "thpt" | "lien_cap" | undefined) ??
    "thcs";
  const isPrimary = schoolLevel === "th" || schoolLevel === "lien_cap";

  const classId =
    typeof sp.class === "string" && classes.some((c) => c.id === sp.class)
      ? sp.class
      : (classes[0]?.id ?? "");

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
  const students = (studentData ?? []) as StudentRow[];
  const studentIds = students.map((s) => s.id);

  // R14-01: ca 3 list la nguon cua editor replace-all (scn_save_nlpc +
  // upsert conduct_evaluations). competency_evaluations co the vuot
  // PostgREST cap (15 thuoc tinh x so HS) -> fetchAllRows het; bat ky loi
  // hoac truncate nao deu phai chan editor.
  const [evalRes, nlpcRes, nlpcCommentRes] = await Promise.all([
    studentIds.length
      ? fetchAllRows<EvalRow>((f, t) =>
          supabase
            .from("conduct_evaluations")
            .select("id,student_id,rating,comment")
            .in("student_id", studentIds)
            .eq("term", term)
            .order("id")
            .range(f, t),
        )
      : { rows: [] as EvalRow[], error: null, truncated: false },
    isPrimary && studentIds.length
      ? fetchAllRows<NlpcEval>((f, t) =>
          supabase
            .from("competency_evaluations")
            .select("student_id,attribute_code,level")
            .in("student_id", studentIds)
            .eq("term", term)
            .order("student_id")
            .order("attribute_code")
            .range(f, t),
        )
      : { rows: [] as NlpcEval[], error: null, truncated: false },
    isPrimary && studentIds.length
      ? fetchAllRows<NlpcCommentRow>((f, t) =>
          supabase
            .from("nlpc_comments")
            .select("student_id,grp,comment")
            .in("student_id", studentIds)
            .eq("term", term)
            .order("student_id")
            .order("grp")
            .range(f, t),
        )
      : { rows: [] as NlpcCommentRow[], error: null, truncated: false },
  ]);
  const evaluations = evalRes.rows;

  const rated = new Set(evaluations.map((e) => e.student_id));
  const tot = evaluations.filter((e) => e.rating === "tot").length;
  const chuaDat = evaluations.filter((e) => e.rating === "chua_dat").length;

  // R14-01: bat cu query nguon nao loi (hoac bi truncate) -> khoa ca 2
  // editor. Luu tren du lieu thieu se ghi de/xoa danh gia hien co.
  const srcErrors = Object.entries({
    classes: classErr?.message ?? null,
    schools: schoolErr?.message ?? null,
    students: studentErr?.message ?? null,
    conduct_evaluations:
      evalRes.error ?? (evalRes.truncated ? "truncated" : null),
    competency_evaluations:
      nlpcRes.error ?? (nlpcRes.truncated ? "truncated" : null),
    nlpc_comments:
      nlpcCommentRes.error ?? (nlpcCommentRes.truncated ? "truncated" : null),
  }).filter(([, e]) => e);
  const loadError = srcErrors.length > 0;
  if (loadError) {
    console.error(
      "[conduct/evaluation] load:",
      srcErrors.map(([k, e]) => `${k}: ${e}`).join("; "),
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        section="Rèn luyện"
        title="Đánh giá & xếp loại kết quả rèn luyện"
        description="Xếp loại kết quả rèn luyện (Tốt/Khá/Đạt/Chưa đạt) và nhận xét của học sinh theo học kỳ - theo TT22/2021."
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
          label="Kỳ đánh giá"
          value={term}
          options={TERMS}
          params={params}
        />
      </div>

      {loadError ? (
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải được dữ liệu. Vui lòng thử lại.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Sĩ số" value={students.length} />
            <StatCard
              label="Đã đánh giá"
              value={`${rated.size}/${students.length}`}
              tone="primary"
            />
            <StatCard label="Xếp loại Tốt" value={tot} tone="success" />
            <StatCard label="Xếp loại Chưa đạt" value={chuaDat} tone="error" />
          </div>

          {classId ? (
            <ConductEvaluationEditor
              key={`${classId}-${term}`}
              students={students}
              evaluations={evaluations}
              term={term}
              meId={profile.id}
              classId={classId}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
              Chưa có lớp để đánh giá.
            </div>
          )}

          {isPrimary && classId ? (
            <NlpcEditor
              key={`nlpc-${classId}-${term}`}
              students={students}
              evaluations={nlpcRes.rows}
              comments={nlpcCommentRes.rows}
              term={term}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
