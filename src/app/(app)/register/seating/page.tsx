import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ClassChips } from "@/components/class-chips";
import { SeatingGrid } from "@/components/register/seating-grid";
import {
  EmptyClassNotice,
  getAccessibleClasses,
  LoadErrorNotice,
  pickClass,
} from "@/components/register/server-utils";
import { currentMonthVN, prevMonthVN } from "@/components/register/types";
import type { SeatingChart, Student } from "@/types";

export default async function SeatingPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; praise?: string }>;
}) {
  const profile = await requireRoles(["gvcn"]);
  const { class: classParam, praise } = await searchParams;
  const supabase = await createClient();

  const { classes, error: classesErr } = await getAccessibleClasses(profile);
  const cls = pickClass(classes, classParam);

  if (classesErr) {
    console.error("[register/seating] classes:", classesErr);
  }
  if (!cls) {
    return (
      <>
        <PageHeader
          section="Sổ chủ nhiệm"
          title="Sơ đồ lớp"
        />
        {classesErr ? <LoadErrorNotice /> : <EmptyClassNotice />}
      </>
    );
  }

  // R12-02: danh gia thang tai thoi diem request - hang module-level se
  // dong bang sai qua ranh gioi thang.
  const curMonth = currentMonthVN();
  const currentMonth = `${curMonth}-01`;
  const prevMonth = `${prevMonthVN()}-01`;

  const [
    { data: chartsData, error: chartsErr },
    { data: studentsData, error: studentsErr },
  ] = await Promise.all([
    supabase
      .from("seating_charts")
      .select("*")
      .eq("class_id", cls.id)
      .in("month", [currentMonth, prevMonth])
      .order("version", { ascending: false }),
    supabase
      .from("students")
      .select("*")
      .eq("class_id", cls.id)
      .eq("status", "active")
      .order("full_name"),
  ]);

  const charts = (chartsData ?? []) as SeatingChart[];
  const students = (studentsData ?? []) as Student[];

  const studentIds = students.map((s) => s.id);
  const { data: praiseData, error: praiseErr } = studentIds.length
    ? await supabase
        .from("conduct_records")
        .select("student_id,points,content,date")
        .eq("type", "khen_thuong")
        .in("student_id", studentIds)
        .order("date", { ascending: false })
    : { data: [], error: null };
  const praiseReasons = new Map<string, string>();
  for (const r of (praiseData ?? []) as {
    student_id: string;
    content: string | null;
  }[]) {
    if (!praiseReasons.has(r.student_id) && r.content) {
      praiseReasons.set(r.student_id, r.content);
    }
  }

  const current =
    charts.find((c) => c.month === currentMonth && c.is_current) ??
    charts.find((c) => c.month === currentMonth) ??
    null;
  const previous =
    charts.find((c) => c.month === prevMonth && c.is_current) ??
    charts.find((c) => c.month === prevMonth) ??
    null;

  // R14-01: scn_save_seating ghi phien ban moi lam current - editor mount
  // tren nguon loi/thieu (students/charts) roi bam Luu se dat mot so do
  // sai len current. Bat cu loi nao -> khoa editor, hien notice.
  const srcErrors = Object.entries({
    classes_source: classesErr,
    seating_charts: chartsErr?.message ?? null,
    students: studentsErr?.message ?? null,
    conduct_records: praiseErr?.message ?? null,
  }).filter(([, e]) => e);
  const loadError = srcErrors.length > 0;
  if (loadError) {
    console.error(
      "[register/seating] load:",
      srcErrors.map(([k, e]) => `${k}: ${e}`).join("; "),
    );
  }

  return (
    <>
      <PageHeader
        section="Sổ chủ nhiệm"
        title="Sơ đồ lớp"
        description={`Lớp ${cls.name} · Tháng ${curMonth.slice(5)}/${curMonth.slice(0, 4)} · Kéo thả để đổi chỗ ngồi`}
      />
      <ClassChips
        classes={classes}
        selectedId={cls.id}
        href="/register/seating"
        params={praise === "1" ? { praise: "1" } : {}}
      />
      {loadError ? (
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải được dữ liệu. Vui lòng thử lại.
        </p>
      ) : (
        <SeatingGrid
          key={cls.id}
          classId={cls.id}
          className={cls.name}
          month={currentMonth}
          currentVersion={current?.version ?? 0}
          initialLayout={current?.layout ?? null}
          previousLayout={previous?.layout ?? null}
          students={students}
          initialPraise={praise === "1"}
          praiseReasons={Object.fromEntries(praiseReasons)}
        />
      )}
    </>
  );
}
