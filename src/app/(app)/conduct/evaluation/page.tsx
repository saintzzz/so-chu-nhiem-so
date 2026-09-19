import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { FilterSelect } from "@/components/academics/filter-select";
import { ConductEvaluationEditor } from "@/components/conduct/evaluation-editor";

interface ClassRow {
  id: string;
  name: string;
}
interface StudentRow {
  id: string;
  code: string;
  full_name: string;
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

  const term =
    typeof sp.term === "string" && TERMS.some((t) => t.value === sp.term)
      ? sp.term
      : "hk1";

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

  const { data: evalData } = studentIds.length
    ? await supabase
        .from("conduct_evaluations")
        .select("id,student_id,rating,comment")
        .in("student_id", studentIds)
        .eq("term", term)
    : { data: [] };
  const evaluations = (evalData ?? []) as EvalRow[];

  const rated = new Set(evaluations.map((e) => e.student_id));
  const tot = evaluations.filter((e) => e.rating === "tot").length;
  const yeu = evaluations.filter((e) => e.rating === "yeu").length;

  return (
    <div className="space-y-4">
      <PageHeader
        section="Phân hệ IV - Rèn luyện"
        title="Đánh giá & xếp loại hạnh kiểm"
        description="Xếp loại hạnh kiểm và nhận xét của học sinh theo học kỳ."
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sĩ số" value={students.length} />
        <StatCard
          label="Đã đánh giá"
          value={`${rated.size}/${students.length}`}
          tone="primary"
        />
        <StatCard label="Xếp loại Tốt" value={tot} tone="success" />
        <StatCard label="Xếp loại Yếu" value={yeu} tone="error" />
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
    </div>
  );
}
