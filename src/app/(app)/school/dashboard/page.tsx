import Link from "next/link";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { disabledModules } from "@/lib/modules";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ChartCard, BarChart } from "@/components/charts";
import { StatusBadge, SEVERITY, FLOW_STATUS } from "@/components/status-badge";
import type {
  AttendanceRecord,
  ClassRoom,
  EmulationScore,
  Incident,
  School,
} from "@/types";
import { currentPeriodVN, currentSemesterVN, isoDateVN, todayVN } from "@/lib/utils";
import { hasRole } from "@/lib/roles";
import { must } from "@/lib/supabase/must";

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
  return isoDateVN(d);
}

function formatDate(isoDate: string): string {
  return isoDate.slice(0, 10).split("-").reverse().join("/");
}

export default async function SchoolDashboardPage() {
  const profile = await requireRoles(["bgh", "admin", "pht"]);
  const supabase = await createClient();
  const EMULATION_PERIOD = currentPeriodVN();
  const KPI_PERIOD = currentSemesterVN();

  const { data: classRows } = await must(supabase
    .from("classes")
    .select("id,name,campus_id")
    .eq("school_id", profile.school_id ?? "")
    .order("name"), "classes");
  let classes = (classRows ?? []) as Pick<
    ClassRoom,
    "id" | "name" | "campus_id"
  >[];
  // PHT chỉ xem các lớp thuộc cơ sở mình phụ trách; chưa phân công campus
  // thì fail-closed - không được đọc toàn trường.
  if (hasRole(profile, "pht")) {
    classes = profile.campus_id
      ? classes.filter((c) => c.campus_id === profile.campus_id)
      : [];
  }
  const classIds = classes.map((c) => c.id);
  const classNameOf = new Map(classes.map((c) => [c.id, c.name]));

  // Anchor "today" to the newest data so the demo dashboard is never empty.
  // Lọc theo lớp qua embedded join - tránh tải toàn bộ student_id vào .in().
  const { data: latestAtt } = classIds.length
    ? await must(supabase
        .from("attendance_records")
        .select("date,students!inner(class_id)")
        .in("students.class_id", classIds)
        .order("date", { ascending: false })
        .limit(1), "attendance_records")
    : { data: [] };
  const anchor =
    ((latestAtt ?? [])[0] as Pick<AttendanceRecord, "date"> | undefined)
      ?.date ?? todayVN();
  const weekStart = addDays(anchor, -6);
  const monthStart = addDays(anchor, -29);

  const [incidentWeekRes, incidentsRes, emulationRes, kpiRes, attCounts] = await Promise.all([
    classIds.length
      ? must(
          supabase
            .from("incidents")
            .select("id", { count: "exact", head: true })
            .in("class_id", classIds)
            .gte("occurred_at", weekStart),
          "incidents",
        )
      : Promise.resolve({ count: 0 }),
    classIds.length
      ? must(
          supabase
            .from("incidents")
            .select("id,class_id,type,severity,status,description,occurred_at")
            .in("class_id", classIds)
            .order("occurred_at", { ascending: false })
            .limit(6),
          "incidents",
        )
      : Promise.resolve({ data: [] }),
    classIds.length
      ? must(
          supabase
            .from("emulation_scores")
            .select("class_id,score")
            .eq("period", EMULATION_PERIOD)
            .in("class_id", classIds),
          "emulation_scores",
        )
      : Promise.resolve({ data: [] }),
    classIds.length
      ? must(
          supabase
            .from("kpis")
            .select("id,class_id,period,status")
            .eq("period", KPI_PERIOD)
            .in("class_id", classIds),
          "kpis",
        )
      : Promise.resolve({ data: [] }),
    classIds.length
      ? Promise.all([
          must(
            supabase
              .from("attendance_records")
              .select("status,students!inner(class_id)", {
                count: "exact",
                head: true,
              })
              .in("students.class_id", classIds)
              .gte("date", monthStart),
            "attendance_records",
          ),
          must(
            supabase
              .from("attendance_records")
              .select("status,students!inner(class_id)", {
                count: "exact",
                head: true,
              })
              .in("students.class_id", classIds)
              .gte("date", monthStart)
              .in("status", ["present", "late"]),
            "attendance_records",
          ),
        ])
      : Promise.resolve([{ count: 0 }, { count: 0 }]),
  ]);

  const incidentsThisWeek = incidentWeekRes.count ?? 0;
  const incidents = (incidentsRes.data ?? []) as Pick<
    Incident,
    "id" | "class_id" | "type" | "severity" | "status" | "description" | "occurred_at"
  >[];

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

  // Chi can ti le - dung 2 count thay vi tai toan bo rows (query OFFSET
  // tren ~10k rows + join students tung timeout tren prod, crash trang).
  const [attTotalRes, attPresentRes] = attCounts;
  const attTotal = attTotalRes.count ?? 0;
  const attended = attPresentRes.count ?? 0;
  const attRate = attTotal
    ? ((attended / attTotal) * 100).toFixed(1) + "%"
    : "-";

  const recentIncidents = incidents;

  const { data: schoolRow } = profile.school_id
    ? await must(supabase
        .from("schools")
        .select("name")
        .eq("id", profile.school_id)
        .maybeSingle(), "schools")
    : { data: null };
  const schoolName =
    (schoolRow as Pick<School, "name"> | null)?.name ?? "Trường";

  // CR-071: viec cho phe duyet - chi dem module dang bat, head-count,
  // tenant-scoped. Strip an khi tong = 0.
  const sid = profile.school_id ?? "";
  const disabled = await disabledModules();
  const countPending = async (
    table: string,
    statusCol: string,
    statusVal: string,
    mod: string,
  ) =>
    sid && !disabled.has(mod)
      ? must(
          supabase
            .from(table)
            .select("id", { count: "exact", head: true })
            .eq("school_id", sid)
            .eq(statusCol, statusVal),
          table,
        ).then((r) => r.count ?? 0)
      : 0;
  const [mvPending, ddPending, hbPending, tnPending, subPending] =
    await Promise.all([
      countPending("sm_requests", "status", "pending", "bien_dong_hs"),
      countPending("dd_assignments", "status", "pending", "dieu_dong"),
      countPending("hb_exports", "status", "gvcn_signed", "hoc_ba"),
      countPending("tn_decisions", "decision", "pending", "xet_tot_nghiep"),
      countPending(
        "substitute_requests",
        "status",
        "pending",
        "van_hanh_nang_cao",
      ),
    ]);
  const pendingItems = [
    { label: "Biến động học sinh", count: mvPending, href: "/movements" },
    {
      label: "Điều động giáo viên",
      count: ddPending,
      href: "/schedule/mobilization",
    },
    { label: "Học bạ chờ ký", count: hbPending, href: "/records/exports" },
    {
      label: "Xét tốt nghiệp",
      count: tnPending,
      href: "/school/graduation",
    },
    {
      label: "Điều động dạy thay",
      count: subPending,
      href: "/school/substitutes",
    },
  ].filter((i) => i.count > 0);
  const pendingTotal = pendingItems.reduce((s, i) => s + i.count, 0);

  return (
    <>
      <PageHeader
        section="Quản trị"
        title="Dashboard cấp trường"
        description={`${schoolName} - theo dõi an toàn, thi đua và KPI của trường`}
      />

      {pendingTotal > 0 && (
        <div className="mb-4 rounded-xl border border-warning bg-warning-bg p-3 shadow-[var(--shadow-sm-token)]">
          <h2 className="mb-2 text-sm font-semibold">
            Việc chờ phê duyệt ({pendingTotal})
          </h2>
          <div className="flex flex-wrap gap-2">
            {pendingItems.map((i) => (
              <Link
                prefetch={false}
                key={i.href}
                href={i.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                {i.label}
                <span className="rounded-md bg-warning-bg px-1.5 text-xs font-semibold text-warning">
                  {i.count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

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
            data={chartData}
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
