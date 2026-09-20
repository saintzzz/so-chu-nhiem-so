import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { ChartCard, BarChart } from "@/components/charts";
import { AiInsightCard } from "@/components/ai/ai-insight-card";
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
  const profile = await requireRoles(["so_gd", "phong_gd", "ubnd", "admin"]);
  const supabase = await createClient();

  // Phạm vi theo cấp: so_gd xem toàn tỉnh; phong_gd xem các UBND/xã con;
  // ubnd chỉ xem trường thuộc đơn vị mình.
  const { data: orgData } = await supabase
    .from("org_units")
    .select("id,type,name,parent_id");
  const orgs = (orgData ?? []) as {
    id: string;
    type: string;
    name: string;
    parent_id: string | null;
  }[];

  let scopedOrgIds: Set<string> | null = null;
  if (profile.role === "phong_gd" && profile.org_unit_id) {
    scopedOrgIds = new Set(
      orgs
        .filter((o) => o.parent_id === profile.org_unit_id)
        .map((o) => o.id)
        .concat(profile.org_unit_id),
    );
  } else if (profile.role === "ubnd" && profile.org_unit_id) {
    scopedOrgIds = new Set([profile.org_unit_id]);
  }

  const { data: schoolRows } = await supabase
    .from("schools")
    .select("id,name,org_unit_id");
  const allSchools = (schoolRows ?? []) as {
    id: string;
    name: string;
    org_unit_id: string | null;
  }[];
  const scopedSchools = scopedOrgIds
    ? allSchools.filter(
        (s) => s.org_unit_id && scopedOrgIds.has(s.org_unit_id),
      )
    : allSchools;
  const scopedSchoolIds = new Set(scopedSchools.map((s) => s.id));
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

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

  const { data: scopedClassRows } = await supabase
    .from("classes")
    .select("id,name,school_id")
    .order("name");
  const classes = ((scopedClassRows ?? []) as Pick<
    ClassRoom,
    "id" | "name" | "school_id"
  >[]).filter((c) => scopedSchoolIds.has(c.school_id));
  const scopedClassIds = classes.map((c) => c.id);

  const { data: scopedStudents } = scopedClassIds.length
    ? await supabase
        .from("students")
        .select("id")
        .in("class_id", scopedClassIds)
    : { data: [] };
  const scopedStudentIds = ((scopedStudents ?? []) as { id: string }[]).map(
    (s) => s.id,
  );

  const [
    teachersRes,
    attTotalRes,
    attPresentRes,
    openIncidentsRes,
    emulationRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", TEACHER_ROLES)
      .in("school_id", [...scopedSchoolIds].length ? [...scopedSchoolIds] : ["none"]),
    scopedStudentIds.length
      ? supabase
          .from("attendance_records")
          .select("id", { count: "exact", head: true })
          .gte("date", windowStart)
          .in("student_id", scopedStudentIds)
      : Promise.resolve({ count: 0 }),
    scopedStudentIds.length
      ? supabase
          .from("attendance_records")
          .select("id", { count: "exact", head: true })
          .gte("date", windowStart)
          .in("status", ["present", "late"])
          .in("student_id", scopedStudentIds)
      : Promise.resolve({ count: 0 }),
    scopedClassIds.length
      ? supabase
          .from("incidents")
          .select("id", { count: "exact", head: true })
          .in("status", ["new", "following"])
          .in("class_id", scopedClassIds)
      : Promise.resolve({ count: 0 }),
    scopedClassIds.length
      ? supabase
          .from("emulation_scores")
          .select("class_id,score")
          .eq("period", EMULATION_PERIOD)
          .in("class_id", scopedClassIds)
      : Promise.resolve({ data: [] }),
  ]);

  const attRate =
    (attTotalRes.count ?? 0) > 0
      ? (((attPresentRes.count ?? 0) / (attTotalRes.count ?? 1)) * 100).toFixed(
          1,
        ) + "%"
      : "-";

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
        title={
          profile.role === "so_gd" || profile.role === "admin"
            ? "Dashboard cấp Sở Giáo dục và Đào tạo"
            : `Dashboard ${orgName.get(profile.org_unit_id ?? "") ?? "đơn vị"}`
        }
        description={
          scopedOrgIds
            ? `Phạm vi: ${orgName.get(profile.org_unit_id ?? "") ?? "đơn vị của bạn"} - ${scopedSchools.length} trường`
            : "Số liệu tổng hợp toàn hệ thống - trường, lớp, giáo viên, học sinh"
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Trường học" value={scopedSchools.length} />
        <StatCard label="Lớp học" value={classes.length} />
        <StatCard label="Giáo viên" value={teachersRes.count ?? 0} />
        <StatCard label="Học sinh" value={scopedStudentIds.length} />
      </div>

      <div className="mt-4">
        <AiInsightCard
          endpoint="/api/ai/dept-brief"
          payload={{}}
          title="Báo cáo AI cho cấp quản lý"
          buttonLabel="Tổng hợp báo cáo"
        />
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

      {/* Phân cấp quản lý: Sở -> Phòng -> UBND -> Trường */}
      <h2 className="mb-3 mt-6 text-base font-semibold">
        Phân cấp quản lý địa bàn
      </h2>
      <DataTable columns={["Cấp", "Đơn vị", "Trực thuộc", "Số trường"]}>
        {orgs
          .filter(
            (o) =>
              !scopedOrgIds ||
              scopedOrgIds.has(o.id) ||
              (profile.role === "phong_gd" &&
                o.id === profile.org_unit_id),
          )
          .map((o) => {
            const schoolCount = allSchools.filter(
              (s) =>
                s.org_unit_id === o.id ||
                (o.type === "phong" &&
                  s.org_unit_id &&
                  orgs.find(
                    (x) => x.id === s.org_unit_id && x.parent_id === o.id,
                  )),
            ).length;
            return (
              <tr key={o.id}>
                <td>
                  <StatusBadge
                    label={
                      o.type === "so"
                        ? "Sở GD&ĐT"
                        : o.type === "phong"
                          ? "Phòng GD&ĐT"
                          : "UBND"
                    }
                    tone={
                      o.type === "so"
                        ? "primary"
                        : o.type === "phong"
                          ? "warning"
                          : "muted"
                    }
                  />
                </td>
                <td className="font-medium">{o.name}</td>
                <td className="text-muted-foreground">
                  {o.parent_id ? (orgName.get(o.parent_id) ?? "-") : "-"}
                </td>
                <td>{schoolCount}</td>
              </tr>
            );
          })}
        {orgs.length === 0 && (
          <tr>
            <td colSpan={4} className="py-8 text-center text-muted-foreground">
              Chưa cấu hình đơn vị hành chính.
            </td>
          </tr>
        )}
      </DataTable>

      {/* Trường trong phạm vi */}
      <h2 className="mb-3 mt-6 text-base font-semibold">
        Trường trong phạm vi quản lý ({scopedSchools.length})
      </h2>
      <DataTable columns={["Trường", "Thuộc đơn vị", "Số lớp"]}>
        {scopedSchools.map((s) => (
          <tr key={s.id}>
            <td className="font-medium">{s.name}</td>
            <td className="text-muted-foreground">
              {s.org_unit_id ? (orgName.get(s.org_unit_id) ?? "-") : "-"}
            </td>
            <td>
              {classes.filter((c) => c.school_id === s.id).length}
            </td>
          </tr>
        ))}
        {scopedSchools.length === 0 && (
          <tr>
            <td colSpan={3} className="py-8 text-center text-muted-foreground">
              Không có trường nào trong phạm vi đơn vị.
            </td>
          </tr>
        )}
      </DataTable>
    </>
  );
}
