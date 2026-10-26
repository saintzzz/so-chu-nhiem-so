import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { PageHeader } from "@/components/page-header";
import { MODULES } from "@/lib/modules";
import { ModuleMatrix } from "./toggles";

// CR-060: admin/so_gd bat-tat module theo truong. Khong co row = mac dinh BAT.
export default async function DeptModulesPage() {
  await requireRoles(["so_gd", "admin"]);
  const supabase = await createClient();

  const { data: schools } = await must(
    supabase.from("schools").select("id, name, code").order("name"),
    "schools",
  );
  const { data: flags } = await must(
    supabase.from("school_features").select("school_id, module, enabled"),
    "school_features",
  );

  // matrix[schoolId][module] = enabled (default true)
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const s of schools ?? []) {
    matrix[s.id] = {};
    for (const m of MODULES) matrix[s.id][m.key] = true;
  }
  for (const f of flags ?? []) {
    if (matrix[f.school_id]) matrix[f.school_id][f.module] = f.enabled;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title="Module theo trường"
        description="Bật/tắt module bán kèm cho từng trường - menu và route của module tắt sẽ bị ẩn với toàn bộ tài khoản trường đó"
      />
      <ModuleMatrix
        schools={(schools ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code ?? "",
        }))}
        modules={[...MODULES]}
        matrix={matrix}
      />
    </div>
  );
}
