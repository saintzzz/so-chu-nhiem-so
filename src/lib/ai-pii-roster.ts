import type { SupabaseClient } from "@supabase/supabase-js";
import type { PiiName } from "@/lib/ai-privacy";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

/** CR-049 r8 H4: roster ten HS cua truong -> bang alias cho PII
 *  minimization. Fail-closed (error/truncated tra ve error) + paginate
 *  - roster loi ma van goi AI se lo ten that ra provider. */
export async function schoolPiiNames(
  supabase: SupabaseClient,
  schoolId: string,
  prefix = "HS",
): Promise<{ names: PiiName[]; error?: never } | { names?: never; error: true }> {
  const { data: clsRows, error: clsErr } = await supabase
    .from("classes")
    .select("id")
    .eq("school_id", schoolId)
    .eq("status", "active");
  if (clsErr) return { error: true };
  const clsIds = (clsRows ?? []).map((c) => c.id as string);
  const stuRes = clsIds.length
    ? await fetchAllRows<{ full_name: string }>((f, t) =>
        supabase
          .from("students")
          .select("full_name")
          .in("class_id", clsIds)
          .eq("status", "active")
          .order("id")
          .range(f, t),
      )
    : { rows: [] as { full_name: string }[], error: null, truncated: false };
  if (stuRes.error || stuRes.truncated) return { error: true };
  return {
    names: stuRes.rows
      .map((s) => s.full_name)
      .filter(Boolean)
      .map((name, i) => ({
        name,
        alias: `${prefix}${String(i + 1).padStart(3, "0")}`,
      })),
  };
}
