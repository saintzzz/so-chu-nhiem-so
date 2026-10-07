import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { ClassRoom, Profile } from "@/types";

interface AccessibleClasses {
  classes: ClassRoom[];
  error: string | null;
}

/**
 * Classes the current user may manage in the register module.
 * GVCN sees homeroom classes AND classes they teach (timetable_entries);
 * BGH/admin/so_gd see all classes.
 * R14-04: tra { classes, error } - truoc day nuot error lam 9 page register
 * hien "chua duoc phan cong" hoac mount editor tren danh sach rong. Caller
 * PHAI check error truoc khi render empty-state/editor.
 */
export async function getAccessibleClasses(
  profile: Profile,
): Promise<AccessibleClasses> {
  const supabase = await createClient();
  const scoped =
    profile.role === "bgh" ||
    profile.role === "admin" ||
    profile.role === "so_gd";
  if (scoped) {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .order("name");
    return {
      classes: (data ?? []) as ClassRoom[],
      error: error?.message ?? null,
    };
  }
  const { data: homeroom, error: homeroomErr } = await supabase
    .from("classes")
    .select("*")
    .eq("gvcn_id", profile.id)
    .order("name");
  if (homeroomErr) return { classes: [], error: homeroomErr.message };
  const list = (homeroom ?? []) as ClassRoom[];
  // timetable_entries cua GV co the vuot PostgREST cap -> fetchAllRows;
  // truncate/loi tra ve cho caller, khong duoc tra danh sach thieu.
  const taughtRes = await fetchAllRows<{
    class_id: string;
    classes: ClassRoom[] | ClassRoom | null;
  }>((f, t) =>
    supabase
      .from("timetable_entries")
      .select("class_id,classes(*)")
      .eq("teacher_id", profile.id)
      .order("id")
      .range(f, t),
  );
  if (taughtRes.error || taughtRes.truncated) {
    return {
      classes: [],
      error: taughtRes.error ?? "timetable_entries truncated",
    };
  }
  const seen = new Set(list.map((c) => c.id));
  for (const t of taughtRes.rows) {
    // Embed many-to-one tra object; untyped client goi la array - chiu ca 2.
    const cls = Array.isArray(t.classes) ? (t.classes[0] ?? null) : t.classes;
    if (cls && !seen.has(t.class_id)) {
      seen.add(t.class_id);
      list.push(cls);
    }
  }
  list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return { classes: list, error: null };
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

/**
 * Fixed notice rendered INSTEAD of editors/data content when a source
 * query failed - never render empty-state as if the data were empty.
 */
export function LoadErrorNotice() {
  return (
    <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
      Không tải được dữ liệu. Vui lòng thử lại.
    </p>
  );
}
