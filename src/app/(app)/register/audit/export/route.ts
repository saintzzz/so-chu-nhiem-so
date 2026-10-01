import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LIMIT = 5000;

/**
 * GET /register/audit/export - xuat CSV nhat ky thao tac / lich su ho so
 * theo dung bo loc cua trang /register/audit (gvcn, bgh).
 */
export async function GET(req: NextRequest) {
  const profile = await getProfile();
  if (!profile || !["gvcn", "bgh"].includes(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") === "records" ? "records" : "audit";
  const from = sp.get("from");
  const to = sp.get("to");
  const actor = sp.get("actor");
  const q = sp.get("q")?.trim() || undefined;
  const supabase = await createClient();

  let rows: Record<string, unknown>[] = [];
  let header: string[];

  if (type === "audit") {
    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (from && DATE_RE.test(from)) query = query.gte("created_at", `${from}T00:00:00`);
    if (to && DATE_RE.test(to)) query = query.lte("created_at", `${to}T23:59:59`);
    if (actor) query = query.eq("actor_id", actor);
    if (q) query = query.or(`action.ilike.%${q}%,entity.ilike.%${q}%`);
    const { data } = await query;
    rows = (data ?? []) as Record<string, unknown>[];
    header = ["created_at", "actor_id", "action", "entity", "entity_id", "payload"];
  } else {
    let classQuery = supabase.from("classes").select("id");
    if (profile.role === "gvcn") classQuery = classQuery.eq("gvcn_id", profile.id);
    else if (profile.school_id) classQuery = classQuery.eq("school_id", profile.school_id);
    const { data: cls } = await classQuery;
    const classIds = ((cls ?? []) as { id: string }[]).map((c) => c.id);
    const { data: sts } = classIds.length
      ? await supabase.from("students").select("id").in("class_id", classIds)
      : { data: [] };
    const studentIds = ((sts ?? []) as { id: string }[]).map((s) => s.id);
    const selStudent = sp.get("student");
    const scope = selStudent && studentIds.includes(selStudent) ? [selStudent] : studentIds;
    if (scope.length) {
      let query = supabase
        .from("student_record_history")
        .select("*")
        .in("student_id", scope)
        .order("changed_at", { ascending: false })
        .limit(LIMIT);
      if (from && DATE_RE.test(from)) query = query.gte("changed_at", `${from}T00:00:00`);
      if (to && DATE_RE.test(to)) query = query.lte("changed_at", `${to}T23:59:59`);
      if (actor) query = query.eq("changed_by", actor);
      if (q) query = query.eq("field", q);
      const { data } = await query;
      rows = (data ?? []) as Record<string, unknown>[];
    }
    header = ["changed_at", "student_id", "field", "old_value", "new_value", "changed_by"];
  }

  const esc = (v: unknown) =>
    `"${String(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v).replaceAll('"', '""')}"`;
  const csv =
    "\uFEFF" +
    [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h])).join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
