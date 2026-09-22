import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StrategyBoard } from "@/components/school/strategy-board";

export default async function SchoolStrategyPage() {
  const profile = await requireRoles(["bgh", "pht"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const { data } = await supabase
    .from("school_kpis")
    .select("*")
    .eq("school_id", sid)
    .order("period")
    .order("created_at", { ascending: false });
  const kpis = (data ?? []) as {
    id: string;
    period: string;
    title: string;
    target: string | null;
    actual: string | null;
    unit: string | null;
    status: string;
    note: string | null;
  }[];

  const dat = kpis.filter((k) => k.status === "dat").length;
  const doing = kpis.filter((k) => k.status === "dang_thuc_hien").length;

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Chiến lược & Mục tiêu KPI toàn trường"
        description="Mục tiêu chất lượng, chỉ tiêu năm học và tiến độ thực hiện của trường."
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Tổng chỉ tiêu" value={kpis.length} />
        <StatCard label="Đang thực hiện" value={doing} tone="primary" />
        <StatCard
          label="Đã đạt"
          value={dat}
          tone={dat > 0 ? "success" : "default"}
        />
      </div>
      <StrategyBoard kpis={kpis} />
    </div>
  );
}
