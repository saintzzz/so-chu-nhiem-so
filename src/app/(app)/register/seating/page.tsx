import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SeatingGrid } from "@/components/register/seating-grid";
import {
  EmptyClassNotice,
  getAccessibleClasses,
  pickClass,
} from "@/components/register/server-utils";
import { CURRENT_MONTH, PREV_MONTH } from "@/components/register/types";
import type { SeatingChart, Student } from "@/types";

export default async function SeatingPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireProfile();
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  const classes = await getAccessibleClasses(profile);
  const cls = pickClass(classes, classParam);

  if (!cls) {
    return (
      <>
        <PageHeader
          section="Phân hệ IX - Sổ chủ nhiệm"
          title="Sơ đồ lớp"
        />
        <EmptyClassNotice />
      </>
    );
  }

  const currentMonth = `${CURRENT_MONTH}-01`;
  const prevMonth = `${PREV_MONTH}-01`;

  const [{ data: chartsData }, { data: studentsData }] = await Promise.all([
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

  const current =
    charts.find((c) => c.month === currentMonth && c.is_current) ??
    charts.find((c) => c.month === currentMonth) ??
    null;
  const previous =
    charts.find((c) => c.month === prevMonth && c.is_current) ??
    charts.find((c) => c.month === prevMonth) ??
    null;

  return (
    <>
      <PageHeader
        section="Phân hệ IX - Sổ chủ nhiệm"
        title="Sơ đồ lớp"
        description={`Lớp ${cls.name} · Tháng ${CURRENT_MONTH.slice(5)}/${CURRENT_MONTH.slice(0, 4)} · Kéo thả để đổi chỗ ngồi`}
      />
      <SeatingGrid
        classId={cls.id}
        className={cls.name}
        month={currentMonth}
        currentVersion={current?.version ?? 0}
        initialLayout={current?.layout ?? null}
        previousLayout={previous?.layout ?? null}
        students={students}
      />
    </>
  );
}
