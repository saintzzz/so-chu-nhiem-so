// @ts-nocheck - fixture cho scanner, khong phai production code.
// Fixture: moi idiom hop le phai PASS - khong duoc co hit nao.
import { must, mustRows } from "@/lib/supabase/must";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

const ENTITIES = [{ table: "students" }];

export async function good(supabase: any, e: { table: string }) {
  const { count } = await must(
    supabase.from(e.table).select("*", { count: "exact", head: true }),
    e.table,
  );
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: "x" })
    .eq("id", "1");
  if (error) return error;
  const { rows } = mustRows(
    await fetchAllRows((f: number, t: number) =>
      supabase.from("students").select("id").order("id").range(f, t),
    ),
    "students",
  );
  const { data: upd, error: updErr } = await supabase
    .from("activities")
    .update({ status: "pending" })
    .eq("id", "1")
    .eq("status", "draft")
    .select("id");
  if (updErr) return { error: updErr.message };
  if (!upd?.length) return { error: "stale" };
  // school_id eq tren bang nho per-school la bounded
  const { data: staff } = await must(
    supabase.from("profiles").select("id").eq("school_id", "s1"),
  );
  return { count, rows, staff };
}
