import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { KpiClient } from "@/components/register/kpi-client";
import {
  EmptyClassNotice,
  getAccessibleClasses,
  pickClass,
} from "@/components/register/server-utils";
import type { Kpi } from "@/components/register/types";

export default async function KpiPage({
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
          title="Đăng ký KPI"
        />
        <EmptyClassNotice />
      </>
    );
  }

  const { data } = await supabase
    .from("kpis")
    .select("*")
    .eq("class_id", cls.id)
    .order("period");

  const kpis = (data ?? []) as Kpi[];

  return (
    <>
      <PageHeader
        section="Phân hệ IX - Sổ chủ nhiệm"
        title="Đăng ký KPI"
        description={`Lớp ${cls.name} · Chỉ tiêu chất lượng theo kỳ (chuyên cần, tỉ lệ khá, vi phạm).`}
      />
      <KpiClient classId={cls.id} kpis={kpis} />
    </>
  );
}
