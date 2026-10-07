import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { todayVN, sanitizeOrTerm } from "@/lib/utils";
import { sanitizeSpreadsheetCell } from "@/lib/excel";

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
  const type =
    sp.get("type") === "records"
      ? "records"
      : sp.get("type") === "digest"
        ? "digest"
        : "audit";
  const from = sp.get("from");
  const to = sp.get("to");
  const actor = sp.get("actor");
  const q = sp.get("q")?.trim() || undefined;
  const supabase = await createClient();

  // R11-03: moi nguon loi hoac bi cat ngam (cap LIMIT) deu tra 422 thay vi
  // CSV thieu du lieu nhu thanh cong - nguoi dung phai thu hep bo loc.
  const sourceFailed = (label: string, detail: string) => {
    console.error(`[audit-export] ${label}: ${detail}`);
    return NextResponse.json(
      {
        error:
          "Dữ liệu vượt quá giới hạn xuất hoặc tải lỗi - hãy thu hẹp bộ lọc (ngày, lớp, học sinh).",
      },
      { status: 422 },
    );
  };

  let rows: Record<string, unknown>[] = [];
  let header: string[];

  if (type === "audit") {
    const res = await fetchAllRows<Record<string, unknown>>(
      (f, t) => {
        let query = supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id")
          .range(f, t);
        if (from && DATE_RE.test(from)) query = query.gte("created_at", `${from}T00:00:00`);
        if (to && DATE_RE.test(to)) query = query.lte("created_at", `${to}T23:59:59`);
        if (actor) query = query.eq("actor_id", actor);
        if (q) query = query.or(`action.ilike.%${sanitizeOrTerm(q)}%,entity.ilike.%${sanitizeOrTerm(q)}%`);
        return query;
      },
      1000,
      LIMIT,
    );
    if (res.error || res.truncated) {
      return sourceFailed(
        "audit_logs",
        res.error ?? `truncated at ${LIMIT} rows`,
      );
    }
    rows = res.rows;
    header = ["created_at", "actor_id", "action", "entity", "entity_id", "payload"];
  } else if (type === "digest") {
    const res = await fetchAllRows<Record<string, unknown>>(
      (f, t) => {
        let query = supabase
          .from("digest_deliveries")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id")
          .range(f, t);
        if (from && DATE_RE.test(from)) query = query.gte("created_at", `${from}T00:00:00`);
        if (to && DATE_RE.test(to)) query = query.lte("created_at", `${to}T23:59:59`);
        if (q) query = query.or(`email.ilike.%${sanitizeOrTerm(q)}%,status.ilike.%${sanitizeOrTerm(q)}%`);
        return query;
      },
      1000,
      LIMIT,
    );
    if (res.error || res.truncated) {
      return sourceFailed(
        "digest_deliveries",
        res.error ?? `truncated at ${LIMIT} rows`,
      );
    }
    rows = res.rows;
    header = ["created_at", "week_start", "email", "status", "run_id", "attempts", "error"];
  } else {
    let classQuery = supabase.from("classes").select("id");
    if (profile.role === "gvcn") classQuery = classQuery.eq("gvcn_id", profile.id);
    else if (profile.school_id) classQuery = classQuery.eq("school_id", profile.school_id);
    const { data: cls, error: clsErr } = await classQuery;
    if (clsErr) {
      return sourceFailed("classes", clsErr.message);
    }
    const classIds = ((cls ?? []) as { id: string }[]).map((c) => c.id);
    const stsRes = classIds.length
      ? await fetchAllRows<{ id: string }>((f, t) =>
          supabase
            .from("students")
            .select("id")
            .in("class_id", classIds)
            .order("id")
            .range(f, t),
        )
      : { rows: [] as { id: string }[], error: null, truncated: false };
    if (stsRes.error || stsRes.truncated) {
      return sourceFailed(
        "students",
        stsRes.error ?? "students fetch truncated",
      );
    }
    const studentIds = stsRes.rows.map((s) => s.id);
    const selStudent = sp.get("student");
    const scope = selStudent && studentIds.includes(selStudent) ? [selStudent] : studentIds;
    if (scope.length) {
      const res = await fetchAllRows<Record<string, unknown>>(
        (f, t) => {
          let query = supabase
            .from("student_record_history")
            .select("*")
            .in("student_id", scope)
            .order("changed_at", { ascending: false })
            .order("id")
            .range(f, t);
          if (from && DATE_RE.test(from)) query = query.gte("changed_at", `${from}T00:00:00`);
          if (to && DATE_RE.test(to)) query = query.lte("changed_at", `${to}T23:59:59`);
          if (actor) query = query.eq("changed_by", actor);
          if (q) query = query.eq("field", q);
          return query;
        },
        1000,
        LIMIT,
      );
      if (res.error || res.truncated) {
        return sourceFailed(
          "student_record_history",
          res.error ?? `truncated at ${LIMIT} rows`,
        );
      }
      rows = res.rows;
    }
    header = ["changed_at", "student_id", "field", "old_value", "new_value", "changed_by"];
  }

  const esc = (v: unknown) =>
    `"${sanitizeSpreadsheetCell(v).replaceAll('"', '""')}"`;
  const csv =
    "\uFEFF" +
    [header.join(","), ...rows.map((r) => header.map((h) => esc(r[h])).join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${type}-${todayVN()}.csv"`,
    },
  });
}
