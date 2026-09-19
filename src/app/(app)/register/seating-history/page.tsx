import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SeatingHistoryClient } from "@/components/register/seating-history-client";
import {
  EmptyClassNotice,
  getAccessibleClasses,
  pickClass,
} from "@/components/register/server-utils";
import type { SeatingChart } from "@/types";

export default async function SeatingHistoryPage({
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
          title="Lịch sử phiên bản sơ đồ"
        />
        <EmptyClassNotice />
      </>
    );
  }

  const { data } = await supabase
    .from("seating_charts")
    .select("*")
    .eq("class_id", cls.id)
    .order("month", { ascending: false })
    .order("version", { ascending: false });

  const charts = (data ?? []) as SeatingChart[];

  return (
    <>
      <PageHeader
        section="Sổ chủ nhiệm"
        title="Lịch sử phiên bản sơ đồ"
        description={`Lớp ${cls.name} · ${charts.length} phiên bản đã lưu`}
      />
      <SeatingHistoryClient classId={cls.id} charts={charts} />
    </>
  );
}
