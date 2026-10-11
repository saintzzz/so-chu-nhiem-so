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
  // builder var + conditional chain BEN TRONG pager callback: fetchAllRows
  // phan trang nen bound theo dinh nghia - khong duoc flag (dashboard r26).
  const { rows: attRows } = mustRows(
    await fetchAllRows((f: number, t: number) => {
      let q = supabase.from("attendance_records").select("id").in("student_id", ["a", "b"]);
      q = q.gte("date", "2026-01-01");
      return q.order("id").range(f, t);
    }),
    "attendance_records",
  );
  // bounded-ok: Set <=3 id khong the vuot page/URL - exemption hop le.
  const targets = new Set<string>(["a", "b"]);
  const { data: profs, error: profsErr } = await supabase
    .from("profiles")
    .select("id")
    .in("id", [...targets]);
  if (profsErr) return profsErr;
  // Helper tu xu ly loi ben trong (log) - call site khong can bind.
  const releaseClaim = async (tok: string) => {
    const { error: relErr } = await supabase
      .from("activity_announcements")
      .update({ email_claim_token: null })
      .eq("id", "x");
    if (relErr) console.error(relErr.message);
    return tok;
  };
  // discarded-ok: releaseClaim tu log loi rpc ben trong
  await releaseClaim("t");
  return { count, rows, staff, attRows, profs };
}
