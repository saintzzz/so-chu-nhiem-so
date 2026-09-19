import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PlansClient } from "@/components/register/plans-client";
import {
  EmptyClassNotice,
  getAccessibleClasses,
  pickClass,
} from "@/components/register/server-utils";
import type { TaskRow } from "@/components/register/types";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["gvcn"]);
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  const classes = await getAccessibleClasses(profile);
  const cls = pickClass(classes, classParam);

  if (!cls) {
    return (
      <>
        <PageHeader
          section="Sổ chủ nhiệm"
          title="Kế hoạch tháng / Sơ kết tuần"
        />
        <EmptyClassNotice />
      </>
    );
  }

  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("class_id", cls.id)
    .neq("status", "dismissed")
    .order("due_date");

  const tasks = (data ?? []) as TaskRow[];

  return (
    <>
      <PageHeader
        section="Sổ chủ nhiệm"
        title="Kế hoạch tháng / Sơ kết tuần"
        description={`Lớp ${cls.name} · Kế hoạch công tác chủ nhiệm theo tháng và tổng kết tuần.`}
      />
      <PlansClient classId={cls.id} tasks={tasks} />
    </>
  );
}
