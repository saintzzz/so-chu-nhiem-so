import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateOnly, todayVN } from "@/lib/utils";
import type { Campus, ClassRoom, DailyReport } from "@/types";

export default async function SchoolDailyReportsPage() {
  const profile = await requireRoles(["bgh", "pht"]);
  const supabase = await createClient();

  const { data: classData } = await supabase
    .from("classes")
    .select("*")
    .eq("school_id", profile.school_id ?? "")
    .eq("status", "active")
    .order("name");
  let classes = (classData ?? []) as ClassRoom[];

  // PHT chỉ xem các lớp thuộc cơ sở mình phụ trách
  if (profile.role === "pht" && profile.campus_id) {
    classes = classes.filter((c) => c.campus_id === profile.campus_id);
  }
  const classIds = classes.map((c) => c.id);

  const { data: campusData } = await supabase
    .from("campuses")
    .select("*")
    .eq("school_id", profile.school_id ?? "");
  const campuses = (campusData ?? []) as Campus[];
  const campusName = new Map(campuses.map((c) => [c.id, c.name]));

  // Ngày báo cáo = ngày có attendance gần nhất của trường (đồng nhất với trang GVCN)
  let today = todayVN();
  const { data: latestAtt } = await supabase
    .from("attendance_records")
    .select("date, students!inner(classes!inner(school_id))")
    .eq("students.classes.school_id", profile.school_id ?? "")
    .order("date", { ascending: false })
    .limit(1);
  const d = (latestAtt ?? []) as { date: string }[];
  if (d[0]?.date) today = d[0].date;

  const { data: repData } = classIds.length
    ? await supabase
        .from("daily_reports")
        .select("*")
        .in("class_id", classIds)
        .eq("date", today)
    : { data: [] };
  const reports = (repData ?? []) as DailyReport[];
  const byClass = new Map(reports.map((r) => [r.class_id, r]));

  const { data: gvcnData } = await supabase
    .from("profiles")
    .select("id,full_name")
    .in(
      "id",
      classes.map((c) => c.gvcn_id).filter((x): x is string => !!x),
    );
  const gvcnName = new Map(
    ((gvcnData ?? []) as { id: string; full_name: string }[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  const submitted = reports.filter((r) => r.status === "submitted").length;
  const totalAbsent = reports.reduce((s, r) => s + r.absent_count, 0);
  const totalViolations = reports.reduce((s, r) => s + r.violation_count, 0);

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Báo cáo ngày từ giáo viên chủ nhiệm"
        description={`${formatDateOnly(today, { weekday: "long", day: "numeric", month: "numeric", year: "numeric" })} - theo dõi tình hình từng lớp và tỉ lệ nộp báo cáo.`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Đã nộp"
          value={`${submitted}/${classes.length}`}
          tone={submitted === classes.length ? "success" : "warning"}
        />
        <StatCard label="Học sinh vắng" value={totalAbsent} tone={totalAbsent > 10 ? "warning" : "default"} />
        <StatCard label="Vi phạm" value={totalViolations} tone={totalViolations > 0 ? "warning" : "default"} />
        <StatCard label="Cơ sở" value={campuses.length} />
      </div>

      <DataTable
        columns={[
          "Lớp",
          "Cơ sở",
          "Giáo viên chủ nhiệm",
          "Vắng",
          "Muộn",
          "Vi phạm",
          "Khen thưởng",
          "Trạng thái",
          "Nội dung",
        ]}
      >
        {classes.map((c) => {
          const r = byClass.get(c.id);
          return (
            <tr key={c.id}>
              <td className="font-medium">{c.name}</td>
              <td className="text-muted-foreground">
                {c.campus_id ? (campusName.get(c.campus_id) ?? "-") : "-"}
              </td>
              <td>{c.gvcn_id ? (gvcnName.get(c.gvcn_id) ?? "-") : "-"}</td>
              <td>{r?.absent_count ?? "-"}</td>
              <td>{r?.late_count ?? "-"}</td>
              <td>{r?.violation_count ?? "-"}</td>
              <td>{r?.commendation_count ?? "-"}</td>
              <td>
                {r?.status === "submitted" ? (
                  <StatusBadge label="Đã nộp" tone="success" />
                ) : r ? (
                  <StatusBadge label="Nháp" tone="muted" />
                ) : (
                  <StatusBadge label="Chưa nộp" tone="warning" />
                )}
              </td>
              <td className="max-w-64">
                {r?.content ? (
                  <details>
                    <summary className="cursor-pointer text-primary">
                      Xem nội dung
                    </summary>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {r.content}
                    </p>
                  </details>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          );
        })}
        {classes.length === 0 && (
          <tr>
            <td colSpan={9} className="py-8 text-center text-muted-foreground">
              Không có lớp nào trong phạm vi phụ trách.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
