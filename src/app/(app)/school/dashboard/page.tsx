import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ChartCard, BarChart } from "@/components/charts";
import { StatusBadge, SEVERITY, FLOW_STATUS } from "@/components/status-badge";
import type {
  AttendanceRecord,
  ClassRoom,
  EmulationScore,
  Incident,
  Student,
} from "@/types";

const EMULATION_PERIOD = "2026-T9";
const KPI_PERIOD = "2026-HK1";
const KPI_SUBMITTED = new Set(["submitted", "approved", "locked", "done"]);

interface KpiRow {
  id: string;
  class_id: string;
  period: string;
  status: string;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(isoDate: string): string {
  return isoDate.slice(0, 10).split("-").reverse().join("/");
}

export default async function SchoolDashboardPage() {
  const profile = await requireRoles(["bgh", "admin"]);
  const supabase = await createClient();

  const { data: classRows } = await supabase
    .from("classes")
    .select("id,name")
    .eq("school_id", profile.school_id ?? "")
    .order("name");
  const classes = (classRows ?? []) as Pick<ClassRoom, "id" | "name">[];
  const classIds = classes.map((c) => c.id);
  const classNameOf = new Map(classes.map((c) => [c.id, c.name]));

  const { data: studentRows } = classIds.length
    ? await supabase
        .from("students")
        .select("id,class_id")
        .in("class_id", classIds)
    : { data: [] };
  const students = (studentRows ?? []) as Pick<Student, "id" | "class_id">[];
  const studentIds = students.map((s) => s.id);

  // Anchor "today" to the newest data so the demo dashboard is never empty.
  const { data: latestAtt } = studentIds.length
    ? await supabase
        .from("attendance_records")
        .select("date")
        .in("student_id", studentIds)
        .order("date", { ascending: false })
        .limit(1)
    : { data: [] };
  const anchor =
    ((latestAtt ?? [])[0] as Pick<AttendanceRecord, "date"> | undefined)
      ?.date ?? new Date().toISOString().slice(0, 10);
  const weekStart = addDays(anchor, -6);
  const monthStart = addDays(anchor, -29);

  const [incidentsRes, emulationRes, kpiRes, attRes] = await Promise.all([
    classIds.length
      ? supabase
          .from("incidents")
          .select("id,class_id,type,severity,status,description,occurred_at")
          .in("class_id", classIds)
          .order("occurred_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    classIds.length
      ? supabase
          .from("emulation_scores")
          .select("class_id,score")
          .eq("period", EMULATION_PERIOD)
          .in("class_id", classIds)
      : Promise.resolve({ data: [] }),
    classIds.length
      ? supabase
          .from("kpis")
          .select("id,class_id,period,status")
          .eq("period", KPI_PERIOD)
          .in("class_id", classIds)
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? supabase
          .from("attendance_records")
          .select("status")
          .in("student_id", studentIds)
          .gte("date", monthStart)
      : Promise.resolve({ data: [] }),
  ]);

  const incidents = (incidentsRes.data ?? []) as Pick<
    Incident,
    "id" | "class_id" | "type" | "severity" | "status" | "description" | "occurred_at"
  >[];
  const incidentsThisWeek = incidents.filter(
    (i) => i.occurred_at.slice(0, 10) >= weekStart,
  ).length;

  const emulationRows = (emulationRes.data ?? []) as Pick<
    EmulationScore,
    "class_id" | "score"
  >[];
  const totals = new Map<string, number>();
  for (const row of emulationRows) {
    totals.set(row.class_id, (totals.get(row.class_id) ?? 0) + row.score);
  }
  const chartData = classes
    .map((c) => ({ label: c.name, value: totals.get(c.id) ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const topClass = chartData[0];

  const kpis = (kpiRes.data ?? []) as KpiRow[];
  const submittedClassIds = new Set(
    kpis.filter((k) => KPI_SUBMITTED.has(k.status)).map((k) => k.class_id),
  );
  const classesMissingKpi = classes.filter(
    (c) => !submittedClassIds.has(c.id),
  ).length;

  const attRows = (attRes.data ?? []) as Pick<AttendanceRecord, "status">[];
  const attended = attRows.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const attRate = attRows.length
    ? ((attended / attRows.length) * 100).toFixed(1) + "%"
    : "-";

  const recentIncidents = incidents.slice(0, 6);

  return (
    <>
      <PageHeader
        section="Quản trị"
        title="Dashboard cấp trường"
        description="THCS Nguyễn Du - theo dõi an toàn, thi đua và KPI của trường"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sự cố an toàn trong tuần"
          value={incidentsThisWeek}
          tone={incidentsThisWeek > 0 ? "error" : "success"}
          href="/school/radar"
        />
        <StatCard
          label="Lớp dẫn đầu thi đua"
          value={topClass && topClass.value > 0 ? topClass.label : "-"}
          tone="primary"
          href="/emulation/ranking"
        />
        <StatCard
          label="Số lớp chưa nộp KPI"
          value={classesMissingKpi}
          tone={classesMissingKpi > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Tỷ lệ chuyên cần toàn trường"
          value={attRate}
          tone="success"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartCard
            title={`Điểm thi đua theo lớp - ${EMULATION_PERIOD}`}
            ariaDescription="Biểu đồ cột tổng điểm thi đua của từng lớp"
          >
            {chartData.length ? (
              <BarChart data={chartData} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Chưa có dữ liệu thi đua.
              </p>
            )}
          </ChartCard>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
            <h3 className="mb-3 text-base font-semibold">Hoạt động gần đây</h3>
            {recentIncidents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Không có sự cố nào được ghi nhận.
              </p>
            ) : (
              <ul className="space-y-3">
                {recentIncidents.map((inc) => (
                  <li
                    key={inc.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={SEVERITY[inc.severity].label}
                        tone={SEVERITY[inc.severity].tone}
                      />
                      <StatusBadge
                        label={FLOW_STATUS[inc.status].label}
                        tone={FLOW_STATUS[inc.status].tone}
                      />
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDate(inc.occurred_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium">
                      {inc.type}
                      {inc.class_id && classNameOf.get(inc.class_id) && (
                        <span className="text-muted-foreground">
                          {" "}
                          · Lớp {classNameOf.get(inc.class_id)}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {inc.description}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
