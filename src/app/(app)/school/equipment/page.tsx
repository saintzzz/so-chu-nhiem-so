import { PageHeader } from "@/components/page-header";
import { requireModule } from "@/lib/modules";
import { StatCard } from "@/components/stat-card";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EquipmentBoard } from "@/components/school/equipment-board";
import type { Campus } from "@/types";
import { hasRole } from "@/lib/roles";
import { must } from "@/lib/supabase/must";

export default async function EquipmentPage() {
  const profile = await requireRoles(["bgh", "pht", "ke_toan"]);
  await requireModule("van_hanh_nang_cao");
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: eqRaw }, { data: cpRaw }, { data: issRaw }] = await Promise.all([
    must(supabase
      .from("equipment")
      .select("*")
      .eq("school_id", sid)
      .order("category")
      .order("name"), "equipment"),
    must(supabase.from("campuses").select("id,name").eq("school_id", sid), "campuses"),
    must(supabase
      .from("equipment_issues")
      .select("id, equipment_id, reported_date, kind, description, status, resolution_note")
      .eq("school_id", sid)
      .order("reported_date", { ascending: false })
      .limit(50), "issues"),
  ]);
  const items = (eqRaw ?? []) as {
    id: string;
    name: string;
    category: string;
    quantity: number;
    condition: string;
    campus_id: string | null;
    note: string | null;
  }[];
  const totalQty = items.reduce((a, b) => a + b.quantity, 0);
  const broken = items.filter(
    (i) => i.condition === "hong_nhe" || i.condition === "hong_nang",
  );

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Thiết bị số & Cơ sở vật chất"
        description="Danh mục thiết bị, tình trạng và phân bổ theo cơ sở."
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Tổng số thiết bị" value={totalQty} />
        <StatCard
          label="Đang hỏng"
          value={broken.reduce((a, b) => a + b.quantity, 0)}
          tone={broken.length ? "warning" : "success"}
        />
        <StatCard
          label="Danh mục"
          value={items.length}
          tone="primary"
        />
      </div>
      <EquipmentBoard
        items={items}
        campuses={(cpRaw ?? []) as Pick<Campus, "id" | "name">[]}
        canDelete={hasRole(profile, "bgh") || hasRole(profile, "ke_toan")}
        issues={(issRaw ?? []) as never[]}
        canIssues
      />
    </div>
  );
}
