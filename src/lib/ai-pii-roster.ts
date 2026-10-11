import type { SupabaseClient } from "@supabase/supabase-js";
import type { PiiName } from "@/lib/ai-privacy";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

/** CR-049 r8 H4 + r9 H9: roster ten HS cua truong -> bang alias cho PII
 *  minimization. Fail-closed (error/truncated tra ve error) + paginate
 *  - roster loi ma van goi AI se lo ten that ra provider.
 *  r9: lay TAT CA lop/HS (ke ca inactive/chuyen truong) - bao cao lich
 *  su, canh bao, free text co the nhac toi HS da nghi hoc; roster thieu
 *  nguoi = ten nguoi do khong bi alias. */
export async function schoolPiiNames(
  supabase: SupabaseClient,
  schoolId: string,
  prefix = "HS",
): Promise<{ names: PiiName[]; error?: never } | { names?: never; error: true }> {
  const clsRes = await fetchAllRows<{ id: string }>((f, t) =>
    supabase
      .from("classes")
      .select("id")
      .eq("school_id", schoolId)
      .order("id")
      .range(f, t),
  );
  if (clsRes.error || clsRes.truncated) return { error: true };
  const clsIds = clsRes.rows.map((c) => c.id);
  // Chunk .in() de tranh URL qua dai tren truong nhieu lop.
  const rows: { full_name: string }[] = [];
  for (let i = 0; i < clsIds.length; i += 200) {
    const chunk = clsIds.slice(i, i + 200);
    const stuRes = await fetchAllRows<{ full_name: string }>((f, t) =>
      supabase
        .from("students")
        .select("full_name")
        .in("class_id", chunk)
        .order("id")
        .range(f, t),
    );
    if (stuRes.error || stuRes.truncated) return { error: true };
    rows.push(...stuRes.rows);
  }
  return {
    names: rows
      .map((s) => s.full_name)
      .filter(Boolean)
      .map((name, i) => ({
        name,
        alias: `${prefix}${String(i + 1).padStart(3, "0")}`,
      })),
  };
}
