import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SuggestionsClient } from "@/components/register/suggestions-client";
import {
  EmptyClassNotice,
  getAccessibleClasses,
  pickClass,
} from "@/components/register/server-utils";
import type { TaskRow } from "@/components/register/types";

export default async function SuggestionsPage({
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
          title="Gợi ý công việc (AI)"
        />
        <EmptyClassNotice />
      </>
    );
  }

  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("class_id", cls.id)
    .eq("source", "suggested")
    .order("due_date");

  const tasks = (data ?? []) as TaskRow[];

  return (
    <>
      <PageHeader
        section="Sổ chủ nhiệm"
        title="Gợi ý công việc (AI)"
        description={`Lớp ${cls.name} · Các công việc được hệ thống đề xuất từ lịch năm học và dữ liệu lớp.`}
      />
      <SuggestionsClient classId={cls.id} tasks={tasks} />
    </>
  );
}
