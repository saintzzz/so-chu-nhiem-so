import { requireRoles } from "@/lib/auth";
import { formatDateOnly } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus, ClassRoom, Student } from "@/types";
import { PageHeader } from "@/components/page-header";
import { ClassChips } from "@/components/class-chips";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { ChartCard, BarChart } from "@/components/charts";
import { AttendanceRangeNav } from "@/components/attendance/date-controls";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

interface AttDayRow {
  date: string;
  status: AttendanceStatus;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function fetchAllAttendance(
  supabase: ServerSupabase,
  studentIds: string[],
  range: { from: string; to: string },
): Promise<AttDayRow[]> {
  const out: AttDayRow[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 30000; from += pageSize) {
    let q = supabase
      .from("attendance_records")
      .select("date,status")
      .in("student_id", studentIds)
      .order("date", { ascending: false })
      .range(from, from + pageSize - 1);
    if (range.from) q = q.gte("date", range.from);
    if (range.to) q = q.lte("date", range.to);
    const { data } = await q;
    const rows = (data ?? []) as AttDayRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const MONTH_LABEL = (ym: string) => {
  const [y, m] = ym.split("-");
  return `Tháng ${Number(m)}/${y}`;
};

export default async function AttendanceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; from?: string; to?: string }>;
}) {
  const profile = await requireRoles(["gvcn", "bgh"]);
  const {
    class: classParam,
    from: fromParam,
    to: toParam,
  } = await searchParams;
  const supabase = await createClient();

  let classQuery = supabase
    .from("classes")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (profile.role === "gvcn") {
    classQuery = classQuery.eq("gvcn_id", profile.id);
  } else if (profile.school_id) {
    classQuery = classQuery.eq("school_id", profile.school_id);
  }
  const { data: classData } = await classQuery;
  const classes = (classData ?? []) as ClassRoom[];
  const selected = classes.find((c) => c.id === classParam) ?? classes[0];

  if (!selected) {
    return (
      <div>
        <PageHeader
          section="Chuyên cần"
          title="Lịch sử chuyên cần"
        />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Bạn chưa được phân công lớp nào.
        </p>
      </div>
    );
  }

  const { data: studentData } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", selected.id)
    .eq("status", "active");
  const students = (studentData ?? []) as Pick<Student, "id">[];
  const ids = students.map((s) => s.id);
  const range = {
    from: fromParam && DATE_RE.test(fromParam) ? fromParam : "",
    to: toParam && DATE_RE.test(toParam) ? toParam : "",
  };
  const hasRange = !!(range.from || range.to);
  const records = ids.length
    ? await fetchAllAttendance(supabase, ids, range)
    : [];

  const anchor =
    range.to || records[0]?.date || new Date().toISOString().slice(0, 10);
  const windowStart = range.from || addDays(anchor, -29);

  // Tổng hợp theo ngày
  interface DayCount {
    present: number;
    excused: number;
    unexcused: number;
    late: number;
  }
  const byDay = new Map<string, DayCount>();
  for (const r of records) {
    const c = byDay.get(r.date) ?? {
      present: 0,
      excused: 0,
      unexcused: 0,
      late: 0,
    };
    c[r.status] += 1;
    byDay.set(r.date, c);
  }

  // Tổng hợp theo tháng
  interface MonthCount extends DayCount {
    days: number;
  }
  const byMonth = new Map<string, MonthCount>();
  for (const [date, c] of byDay) {
    const ym = date.slice(0, 7);
    const m = byMonth.get(ym) ?? {
      present: 0,
      excused: 0,
      unexcused: 0,
      late: 0,
      days: 0,
    };
    m.present += c.present;
    m.excused += c.excused;
    m.unexcused += c.unexcused;
    m.late += c.late;
    m.days += 1;
    byMonth.set(ym, m);
  }
  const months = [...byMonth.entries()].sort((a, b) =>
    b[0].localeCompare(a[0]),
  );

  // 30 ngày gần nhất
  const last30 = [...byDay.entries()]
    .filter(([d]) => d >= windowStart)
    .sort((a, b) => b[0].localeCompare(a[0]));
  const sum30 = last30.reduce(
    (acc, [, c]) => {
      acc.present += c.present;
      acc.excused += c.excused;
      acc.unexcused += c.unexcused;
      acc.late += c.late;
      return acc;
    },
    { present: 0, excused: 0, unexcused: 0, late: 0 },
  );
  const total30 = sum30.present + sum30.excused + sum30.unexcused + sum30.late;
  const pct30 =
    total30 > 0
      ? Math.round(((sum30.present + sum30.late) / total30) * 1000) / 10
      : null;

  return (
    <div>
      <PageHeader
        section="Chuyên cần"
        title="Lịch sử chuyên cần"
        description={`Tổng hợp chuyên cần của lớp ${selected.name} theo tháng và theo ngày.`}
      />
      <ClassChips
        classes={classes}
        selectedId={selected.id}
        href="/attendance/history"
      />
      <AttendanceRangeNav
        from={range.from}
        to={range.to}
        params={{ class: selected.id }}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={
            hasRange
              ? "% chuyên cần (khoảng chọn)"
              : "% chuyên cần (30 ngày)"
          }
          value={pct30 !== null ? `${pct30}%` : "-"}
          tone={pct30 !== null && pct30 >= 95 ? "success" : "warning"}
        />
        <StatCard label="Vắng có phép" value={sum30.excused} tone="warning" />
        <StatCard label="Vắng không phép" value={sum30.unexcused} tone="error" />
        <StatCard label="Đi muộn" value={sum30.late} tone="warning" />
      </div>

      {months.length > 0 && (
        <div className="mb-4">
          <ChartCard
            title={`Số lượt vắng không phép theo ngày (${hasRange ? "khoảng chọn" : "30 ngày"})`}
            ariaDescription="Biểu đồ cột số lượt vắng không phép mỗi ngày trong 30 ngày gần nhất"
          >
            <BarChart
              data={last30
                .slice()
                .reverse()
                .map(([d, c]) => ({
                  label: `${new Date(`${d}T00:00:00`).getDate()}`,
                  value: c.unexcused,
                }))}
              height={180}
            />
          </ChartCard>
        </div>
      )}

      <h2 className="mb-3 text-base font-semibold">Tổng hợp theo tháng</h2>
      <div className="mb-6">
        <DataTable
          columns={[
            "Tháng",
            "Số ngày điểm danh",
            "Có mặt",
            "Vắng có phép",
            "Vắng không phép",
            "Đi muộn",
            "% chuyên cần",
          ]}
        >
          {months.map(([ym, m]) => {
            const total = m.present + m.excused + m.unexcused + m.late;
            const pct =
              total > 0
                ? Math.round(((m.present + m.late) / total) * 1000) / 10
                : null;
            return (
              <tr key={ym}>
                <td className="font-medium">{MONTH_LABEL(ym)}</td>
                <td>{m.days}</td>
                <td className="text-success">{m.present}</td>
                <td className="text-warning">{m.excused}</td>
                <td className="text-error">{m.unexcused}</td>
                <td className="text-warning">{m.late}</td>
                <td className="font-medium">
                  {pct !== null ? `${pct}%` : "-"}
                </td>
              </tr>
            );
          })}
          {months.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-muted-foreground">
                Chưa có dữ liệu chuyên cần.
              </td>
            </tr>
          )}
        </DataTable>
      </div>

      <h2 className="mb-3 text-base font-semibold">
        Chi tiết theo ngày {hasRange ? "(khoảng chọn)" : "(30 ngày gần nhất)"}
      </h2>
      <DataTable
        columns={[
          "Ngày",
          "Có mặt",
          "Vắng có phép",
          "Vắng không phép",
          "Đi muộn",
          "% chuyên cần",
        ]}
      >
        {last30.map(([d, c]) => {
          const total = c.present + c.excused + c.unexcused + c.late;
          const pct =
            total > 0
              ? Math.round(((c.present + c.late) / total) * 100)
              : null;
          return (
            <tr key={d}>
              <td className="font-medium">
                {formatDateOnly(d, {
                  weekday: "short",
                  day: "numeric",
                  month: "numeric",
                })}
              </td>
              <td className="text-success">{c.present}</td>
              <td className="text-warning">{c.excused}</td>
              <td className="text-error">{c.unexcused}</td>
              <td className="text-warning">{c.late}</td>
              <td>{pct !== null ? `${pct}%` : "-"}</td>
            </tr>
          );
        })}
        {last30.length === 0 && (
          <tr>
            <td colSpan={6} className="py-8 text-center text-muted-foreground">
              Chưa có dữ liệu trong 30 ngày gần nhất.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
