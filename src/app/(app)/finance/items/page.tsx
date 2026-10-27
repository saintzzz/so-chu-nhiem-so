import { requireRoles } from "@/lib/auth";
import { hasAnyRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ItemsBoard, type FeeItem } from "@/components/finance/items-board";

export default async function FeeItemsPage() {
  const profile = await requireRoles(["ke_toan", "bgh", "admin", "so_gd"]);
  const canWrite = hasAnyRole(profile, ["ke_toan", "bgh", "admin"]);
  const supabase = await createClient();

  const [{ data: items, error: e1 }, { data: classes, error: e2 }] = await Promise.all([
    supabase.from("fee_items").select("*").order("created_at"),
    supabase.from("classes").select("id, name").eq("status", "active").order("name"),
  ]);
  if (e1 || e2) {
    return (
      <div>
        <PageHeader section="Khoản thu" title="Danh mục khoản thu" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không tải được dữ liệu - vui lòng thử lại.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader section="Khoản thu" title="Danh mục khoản thu" />
      <ItemsBoard
        items={(items ?? []) as FeeItem[]}
        canWrite={canWrite}
        classes={(classes ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
