// @ts-nocheck - fixture cho scanner, khong phai production code.
// Fixture: moi pattern phai bi gate bat. Mot instance moi rule.
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { notify } from "./actions";

const ENTITIES = [{ table: "students" }];

export async function bad(supabase: any, e: { table: string }, status: string, ids: string[]) {
  // 1. dynamic table name - error bi bo
  const { count } = await supabase.from(e.table).select("*", { count: "exact", head: true });

  // 2. awaited query discarded (expression statement)
  await supabase.from("notifications").update({ read_at: "x" }).eq("id", "1");

  // 3. fetchAllRows khong mustRows, khong bind error
  const { rows } = await fetchAllRows((f: number, t: number) =>
    supabase.from("students").select("id").order("id").range(f, t),
  );

  // 4. fetchAllRows callback khong .order()
  const { rows: r2 } = await fetchAllRows((f: number, t: number) =>
    supabase.from("students").select("id").range(f, t),
  );
  if (!r2.length) return null;

  // 5. .in("school_id") tren bang lon -> khong bound
  const { data: p } = await supabase
    .from("students")
    .select("id")
    .in("school_id", ids);

  // 6. status transition via patch var - khong CAS
  const patch = { status };
  await supabase.from("counseling_cases").update(patch).eq("id", "1");

  // 7. predicate status nhung khong .select() verify rows
  const { error } = await supabase
    .from("activities")
    .update({ status: "pending" })
    .eq("id", "1")
    .eq("status", "draft");
  if (error) return error;

  // 8. action result discarded
  await notify("x");

  // 9. builder var awaited sau - error khong bind (r26: intake/audit)
  let bq = supabase.from("audit_logs").select("*").order("created_at");
  bq = bq.eq("actor_id", "1");
  const { data: logs } = await bq.range(0, 9);

  // 10. builder var awaited truc tiep - error khong bind
  const cq = supabase.from("classes").select("*").order("name");
  const { data: cls } = await cq;

  // 11. .in("class_id") tren bang lon -> khong bound (r26: plans/audit)
  const { data: st } = await supabase
    .from("students")
    .select("id")
    .in("class_id", ids);

  // 12. discarded await tren chain reo builder var
  const uq = supabase.from("notifications").update({ read_at: "x" }).eq("id", "1");
  await uq;

  return { count, rows, p, logs, cls, st };
}
