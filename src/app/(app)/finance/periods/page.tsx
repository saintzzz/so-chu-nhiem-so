import { requireRoles } from "@/lib/auth";
import { hasAnyRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PeriodsBoard, type FeePeriod } from "@/components/finance/periods-board";

export default async function FeePeriodsPage() {
  const profile = await requireRoles(["ke_toan", "bgh", "admin", "so_gd"]);
  const canWrite = hasAnyRole(profile, ["ke_toan", "bgh", "admin"]);
  const supabase = await createClient();

  const { data: periods, error } = await supabase
    .from("fee_periods")
    .select("id, name, due_date, status")
    .order("created_at", { ascending: false });
  if (error) {
    return (
      <div>
        <PageHeader section="Khoản thu" title="Đợt thu" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không tải được dữ liệu - vui lòng thử lại.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader section="Khoản thu" title="Đợt thu" />
      <PeriodsBoard periods={(periods ?? []) as FeePeriod[]} canWrite={canWrite} />
    </div>
  );
}
