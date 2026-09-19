import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { ChartCard, BarChart } from "@/components/charts";
import type {
  AttendanceRecord,
  ClassRoom,
  EmulationScore,
} from "@/types";

const EMULATION_PERIOD = "2026-T9";
const TEACHER_ROLES = ["gvcn", "gvbm", "to_truong"];

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function DeptDashboardPage() {
  await requireRoles(["so_gd", "admin"]);
  const supabase = await createClient();

  // Anchor to the newest attendance date so demo stats are never empty.
  const { data: latestAtt } = await supabase
    .from("attendance_records")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  const anchor =
    ((latestAtt ?? [])[0] as Pick<AttendanceRecord, "date"> | undefined)
      ?.date ?? new Date().toISOString().slice(0, 10);
  const windowStart = addDays(anchor, -29);

  const [
    schoolsRes,
    classesRes,
    teachersRes,
    studentsRes,
    attTotalRes,
    attPresentRes,
    openIncidentsRes,
    classRowsRes,
    emulationRes,
  ] = await Promise.all([
    supabase.from("schools").select("id", { count: "exact", head: true }),
    supabase.from("classes").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", TEACHER_ROLES),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .gte("date", windowStart),
    supabase
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .gte("date", windowStart)
      .in("status", ["present", "late"]),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "following"]),
    supabase.from("classes").select("id,name").order("name"),
    supabase
      .from("emulation_scores")
      .select("class_id,score")
      .eq("period", EMULATION_PERIOD),
  ]);

  const attRate =
    (attTotalRes.count ?? 0) > 0
      ? (((attPresentRes.count ?? 0) / (attTotalRes.count ?? 1)) * 100).toFixed(
          1,
        ) + "%"
      : "-";

  const classes = (classRowsRes.data ?? []) as Pick<
    ClassRoom,
    "id" | "name"
  >[];

  const totals = new Map<string, number>();
  for (const row of (emulationRes.data ?? []) as Pick<
    EmulationScore,
    "class_id" | "score"
  >[]) {
    totals.set(row.class_id, (totals.get(row.class_id) ?? 0) + row.score);
  }
  const ranking = classes
    .map((c) => ({ name: c.name, value: totals.get(c.id) ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const chartData = ranking.map((r) => ({ label: r.name, value: r.value }));

  return (
    <>
      <PageHeader
        section="Quản trị"
        title="Dashboard cấp Sở GD&ĐT"
        description="Số liệu tổng hợp toàn hệ thống - trường, lớp, giáo viên, học sinh"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Trường học" value={schoolsRes.count ?? 0} />
        <StatCard label="Lớp học" value={classesRes.count ?? 0} />
        <StatCard label="Giáo viên" value={teachersRes.count ?? 0} />
        <StatCard label="Học sinh" value={studentsRes.count ?? 0} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard
          label={`Tỷ lệ chuyên cần 30 ngày (đến ${anchor
            .split("-")
            .reverse()
            .join("/")})`}
          value={attRate}
          tone="success"
        />
        <StatCard
          label="Sự cố đang mở"
          value={openIncidentsRes.count ?? 0}
          tone={(openIncidentsRes.count ?? 0) > 0 ? "warning" : "success"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={`Điểm thi đua theo lớp - ${EMULATION_PERIOD}`}
          ariaDescription="Biểu đồ cột điểm thi đua các lớp"
        >
          {chartData.length ? (
            <BarChart data={chartData} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Chưa có dữ liệu thi đua.
            </p>
          )}
        </ChartCard>

        <DataTable
          columns={["Hạng", "Lớp", "Tổng điểm thi đua", "Ghi chú"]}
          footer={<span>Kỳ {EMULATION_PERIOD}</span>}
        >
          {ranking.map((r, i) => (
            <tr key={r.name}>
              <td className="font-medium">{i + 1}</td>
              <td>{r.name}</td>
              <td className="font-semibold">{r.value}</td>
              <td>
                {i === 0 && r.value > 0 && (
                  <StatusBadge label="Dẫn đầu" tone="success" />
                )}
                {i === ranking.length - 1 && ranking.length > 1 && (
                  <StatusBadge label="Cuối bảng" tone="warning" />
                )}
              </td>
            </tr>
          ))}
          {ranking.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-muted-foreground">
                Chưa có dữ liệu.
              </td>
            </tr>
          )}
        </DataTable>
      </div>
    </>
  );
}
