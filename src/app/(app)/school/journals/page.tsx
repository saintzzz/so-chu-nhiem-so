import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateVN } from "@/lib/utils";

export default async function SchoolJournalsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const profile = await requireRoles(["bgh", "pht"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";
  const sp = await searchParams;
  const dateParam =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;

  let qCls = supabase
    .from("classes")
    .select("id,name,campus_id")
    .eq("school_id", sid)
    .eq("status", "active")
    .order("name");
  // PHT chỉ xem sổ đầu bài của phân hiệu mình phụ trách
  if (profile.role === "pht" && profile.campus_id) {
    qCls = qCls.eq("campus_id", profile.campus_id);
  }
  const { data: clsRaw } = await qCls;
  const classes = (clsRaw ?? []) as {
    id: string;
    name: string;
    campus_id: string | null;
  }[];
  const classIds = classes.map((c) => c.id);
  const classOf = new Map(classes.map((c) => [c.id, c.name]));

  // period_logs -> timetable_entries (class_id) -> teacher/subject
  const { data: ttRaw } = classIds.length
    ? await supabase
        .from("timetable_entries")
        .select("id,class_id,subject_id,teacher_id,weekday,period")
        .in("class_id", classIds)
    : { data: [] };
  const entries = (ttRaw ?? []) as {
    id: string;
    class_id: string;
    subject_id: string;
    teacher_id: string;
    weekday: number;
    period: number;
  }[];
  const entryIds = entries.map((e) => e.id);
  const entryOf = new Map(entries.map((e) => [e.id, e]));

  let q = supabase
    .from("period_logs")
    .select("id,timetable_entry_id,date,lesson_title,lesson_content,logged_by")
    .in("timetable_entry_id", entryIds.length ? entryIds : ["00000000-0000-0000-0000-000000000000"])
    .order("date", { ascending: false })
    .limit(80);
  if (dateParam) q = q.eq("date", dateParam);
  const { data: logRaw } = await q;
  const logs = (logRaw ?? []) as {
    id: string;
    timetable_entry_id: string;
    date: string;
    lesson_title: string | null;
    lesson_content: string | null;
    logged_by: string | null;
  }[];

  const teacherIds = [
    ...new Set(
      entries.map((e) => e.teacher_id).filter(Boolean) as string[],
    ),
  ];
  const subjectIds = [...new Set(entries.map((e) => e.subject_id))];
  const [{ data: profRaw }, { data: subRaw }] = await Promise.all([
    teacherIds.length
      ? supabase.from("profiles").select("id,full_name").in("id", teacherIds)
      : Promise.resolve({ data: [] }),
    subjectIds.length
      ? supabase.from("subjects").select("id,name").in("id", subjectIds)
      : Promise.resolve({ data: [] }),
  ]);
  const teacherOf = new Map(
    ((profRaw ?? []) as { id: string; full_name: string }[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );
  const subjectOf = new Map(
    ((subRaw ?? []) as { id: string; name: string }[]).map((s) => [
      s.id,
      s.name,
    ]),
  );

  return (
    <div>
      <PageHeader
        section="Giám sát & báo cáo"
        title="Sổ đầu bài toàn trường"
        description="Nhật ký giảng dạy các lớp - theo dõi tiết học đã ghi sổ."
      />
      <form method="get" className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <label className="text-sm text-muted-foreground">Ngày</label>
        <input
          key={dateParam ?? ""}
          type="date"
          name="date"
          defaultValue={dateParam ?? ""}
          className="h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none"
        />
        <button type="submit" className="h-8 rounded-lg border border-border px-3 text-sm hover:bg-muted">
          Xem
        </button>
        {dateParam && (
          <a href="/school/journals" className="text-sm text-primary hover:underline">
            Tất cả
          </a>
        )}
      </form>
      <DataTable
        columns={["Ngày", "Lớp", "Tiết", "Môn", "Giáo viên", "Nội dung tiết học"]}
        footer={<span>{logs.length} bản ghi gần nhất</span>}
      >
        {logs.map((l) => {
          const e = entryOf.get(l.timetable_entry_id);
          return (
            <tr key={l.id}>
              <td className="whitespace-nowrap">{fmtDateVN(l.date)}</td>
              <td className="font-medium">{e ? (classOf.get(e.class_id) ?? "-") : "-"}</td>
              <td>{e ? `T${e.weekday + 1}/Tiết ${e.period}` : "-"}</td>
              <td>{e ? (subjectOf.get(e.subject_id) ?? "-") : "-"}</td>
              <td className="text-muted-foreground">
                {e?.teacher_id ? (teacherOf.get(e.teacher_id) ?? "-") : "-"}
              </td>
              <td className="max-w-md">
                <div className="text-sm">
                  {l.lesson_title && <p className="font-medium">{l.lesson_title}</p>}
                  <p className="line-clamp-2 text-muted-foreground">{l.lesson_content ?? "-"}</p>
                </div>
              </td>
            </tr>
          );
        })}
        {logs.length === 0 && (
          <tr>
            <td colSpan={6} className="py-8 text-center text-muted-foreground">
              Chưa có nhật ký giảng dạy nào{dateParam ? " trong ngày này" : ""}.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
