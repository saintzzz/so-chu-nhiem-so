import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { fetchAllRowsIn } from "@/lib/supabase/fetch-all";
import { compareVietnameseName, PERIODS } from "@/lib/utils";
import { hasAnyRole } from "@/lib/roles";

// CR-073: TKB xem theo giao vien - bgh/pht xem moi GV, gvbm/gvcn/
// to_truong xem TKB cua chinh minh (teacher_scope RLS).
const WEEKDAYS = [2, 3, 4, 5, 6, 7] as const;

export default async function ByTeacherPage({
  searchParams,
}: {
  searchParams: Promise<{ teacher?: string }>;
}) {
  const profile = await requireRoles(["bgh", "pht", "gvcn", "gvbm", "to_truong"]);
  const isAdmin = hasAnyRole(profile, ["bgh", "pht"]);
  const { teacher: teacherParam } = await searchParams;
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const { data: teachers } = await must(
    supabase
      .from("profiles")
      .select("id,full_name")
      .eq("school_id", sid)
      .or("role.in.(gvcn,gvbm,to_truong),concurrent_roles.ov.{gvcn,gvbm,to_truong}"),
    "teachers",
  );
  const list = (teachers ?? []) as { id: string; full_name: string }[];
  list.sort((a, b) => compareVietnameseName(a.full_name, b.full_name));

  // teacher scope: nhan vien chi xem TKB cua minh, admin chon duoc.
  const teacherId = isAdmin
    ? (teacherParam && list.some((t) => t.id === teacherParam) ? teacherParam : list[0]?.id)
    : profile.id;

  const { data: classRows } = await must(
    supabase.from("classes").select("id").eq("school_id", sid), "classes",
  );
  const classIds = (classRows ?? []).map((c) => c.id);

  const entryRes = await fetchAllRowsIn<{
    weekday: number; period: number; room: string | null;
    subjects: { name: string } | { name: string }[] | null;
    classes: { name: string } | { name: string }[] | null;
  }>(
    (chunk, f, t) =>
      supabase
        .from("timetable_entries")
        .select("weekday,period,room,subjects(name),classes(name)")
        .eq("teacher_id", teacherId ?? "")
        .in("class_id", chunk)
        .order("id")
        .range(f, t),
    classIds.length ? classIds : ["none"],
  );
  if (entryRes.error) {
    return (
      <div>
        <PageHeader section="Thời khóa biểu" title="Thời khóa biểu theo giáo viên" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không tải được dữ liệu - vui lòng thử lại.
        </p>
      </div>
    );
  }
  const entries = (entryRes.rows ?? []) as {
    weekday: number; period: number; room: string | null;
    subjects: { name: string } | { name: string }[] | null;
    classes: { name: string } | { name: string }[] | null;
  }[];
  const grid = new Map(entries.map((e) => [`${e.weekday}-${e.period}`, e]));
  const one = <T,>(x: T | T[] | null) => (Array.isArray(x) ? x[0] : x);

  return (
    <div>
      <PageHeader
        section="Thời khóa biểu"
        title="Thời khóa biểu theo giáo viên"
        description={isAdmin ? "Xem phân công giảng dạy của từng giáo viên trong trường." : "Thời khóa biểu giảng dạy của bạn."}
      />
      {isAdmin && (
        <div className="mb-4 flex flex-wrap gap-2">
          {list.map((t) => (
            <Link key={t.id} href={`/schedule/by-teacher?teacher=${t.id}`}
              className={`rounded-full px-3 py-1.5 text-sm border ${t.id === teacherId ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground"}`}>
              {t.full_name}
            </Link>
          ))}
        </div>
      )}
      <div className="relative overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tiết</th>
              {WEEKDAYS.map((d) => (
                <th key={d} className="px-3 py-2 text-left font-medium">Thứ {d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-muted-foreground">Tiết {p}</td>
                {WEEKDAYS.map((d) => {
                  const e = grid.get(`${d}-${p}`);
                  return (
                    <td key={d} className="px-2 py-1.5 align-top">
                      {e && (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5">
                          <p className="font-medium leading-tight">{one(e.subjects)?.name ?? "?"}</p>
                          <p className="text-xs text-muted-foreground">
                            {one(e.classes)?.name ?? "-"}{e.room ? ` - ${e.room}` : ""}
                          </p>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Tổng: <b className="tabular-nums">{entries.length}</b> tiết/tuần
        {teacherId && ` - ${list.find((t) => t.id === teacherId)?.full_name ?? ""}`}
      </p>
    </div>
  );
}
