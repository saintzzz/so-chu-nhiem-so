import { createClient } from "@/lib/supabase/server";
import type { ClassRoom, Profile } from "@/types";

/**
 * Classes the current user may manage in the register module.
 * GVCN sees homeroom classes AND classes they teach (timetable_entries);
 * BGH/admin/so_gd see all classes.
 */
export async function getAccessibleClasses(
  profile: Profile,
): Promise<ClassRoom[]> {
  const supabase = await createClient();
  const scoped =
    profile.role === "bgh" ||
    profile.role === "admin" ||
    profile.role === "so_gd";
  if (scoped) {
    const { data } = await supabase
      .from("classes")
      .select("*")
      .order("name");
    return (data ?? []) as ClassRoom[];
  }
  const { data: homeroom } = await supabase
    .from("classes")
    .select("*")
    .eq("gvcn_id", profile.id)
    .order("name");
  const list = (homeroom ?? []) as ClassRoom[];
  const { data: taught } = await supabase
    .from("timetable_entries")
    .select("class_id,classes(*)")
    .eq("teacher_id", profile.id);
  const seen = new Set(list.map((c) => c.id));
  for (const t of (taught ?? []) as unknown as {
    class_id: string;
    classes: ClassRoom | null;
  }[]) {
    if (t.classes && !seen.has(t.class_id)) {
      seen.add(t.class_id);
      list.push(t.classes);
    }
  }
  list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return list;
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
