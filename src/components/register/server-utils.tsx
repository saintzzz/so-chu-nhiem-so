import { createClient } from "@/lib/supabase/server";
import type { ClassRoom, Profile } from "@/types";

/**
 * Classes the current user may manage in the register module.
 * GVCN sees their homeroom class; BGH/admin/so_gd see all classes.
 */
export async function getAccessibleClasses(
  profile: Profile,
): Promise<ClassRoom[]> {
  const supabase = await createClient();
  const scoped =
    profile.role === "bgh" ||
    profile.role === "admin" ||
    profile.role === "so_gd";
  let query = supabase.from("classes").select("*").order("name");
  if (!scoped) query = query.eq("gvcn_id", profile.id);
  const { data } = await query;
  return (data ?? []) as ClassRoom[];
}

/** Pick a class from the list using the `?class=` search param. */
export function pickClass(
  classes: ClassRoom[],
  classParam: string | undefined,
): ClassRoom | null {
  if (classes.length === 0) return null;
  const found = classes.find((c) => c.id === classParam);
  return found ?? classes[0];
}

/** Empty state card used when the user has no accessible class. */
export function EmptyClassNotice() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
      Bạn chưa được phân công lớp chủ nhiệm trong năm học này.
    </div>
  );
}
