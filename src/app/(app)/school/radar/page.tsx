import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { EarlyWarning } from "@/types";
import { buildRadarData, type RiskLevel } from "@/lib/school/radar";
import { WarningList } from "@/components/school/warning-list";
import { RadarRefreshButton } from "@/components/school/radar-refresh";

const LEVEL_META: Record<
  RiskLevel,
  { label: string; tone: "muted" | "warning" | "error"; ring: string }
> = {
  low: {
    label: "Ổn định",
    tone: "muted",
    ring: "border-l-success",
  },
  medium: {
    label: "Cần theo dõi",
    tone: "warning",
    ring: "border-l-warning",
  },
  high: {
    label: "Cảnh báo",
    tone: "error",
    ring: "border-l-error",
  },
  critical: {
    label: "Nghiêm trọng",
    tone: "error",
    ring: "border-l-error",
  },
};

export default async function SchoolRadarPage() {
  const profile = await requireRoles(["bgh", "pht", "admin"]);
  const supabase = await createClient();

  // Compute thuan doc - viec ghi canh bao vao early_warnings do server action
  // refreshRadarWarnings (nut "Lam moi canh bao") dam nhiem.
  const { classes, classIds, anchor, risks, errors } = await buildRadarData(
    supabase,
    profile,
  );
  const flagged = risks.filter((r) => r.level !== "low");

  const { data: warnRows } = await supabase
    .from("early_warnings")
    .select("*")
    .eq("school_id", profile.school_id ?? "")
    .in("status", ["open", "acknowledged"])
    .order("created_at", { ascending: false })
    .limit(50);
  const warnings = ((warnRows ?? []) as EarlyWarning[]).filter(
    (w) => !w.class_id || classIds.includes(w.class_id),
  );
  const warnStudentIds = [
    ...new Set(warnings.map((w) => w.student_id).filter((x): x is string => !!x)),
  ];
  const { data: warnStudents } = warnStudentIds.length
    ? await supabase
        .from("students")
        .select("id,full_name")
        .in("id", warnStudentIds)
    : { data: [] };
  const warnStudentName = new Map(
    ((warnStudents ?? []) as { id: string; full_name: string }[]).map((s) => [
      s.id,
      s.full_name,
    ]),
  );
  const classNameMap = new Map(classes.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader
        section="Quản trị"
        title="Radar cảnh báo sớm"
        description={`Tổng hợp tín hiệu rủi ro theo lớp - 30 ngày tính đến ${anchor
          .split("-")
          .reverse()
          .join("/")}`}
      />

      {errors.length > 0 ? (
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải đủ dữ liệu nguồn để tính radar - kết quả có thể thiếu
          chính xác. Vui lòng thử lại sau.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {risks.map((r) => {
              const meta = LEVEL_META[r.level];
              return (
                <div
                  key={r.classId}
                  className={cn(
                    "rounded-xl border border-l-4 border-border bg-card p-4 shadow-[var(--shadow-sm-token)]",
                    meta.ring,
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">Lớp {r.className}</h3>
                    <StatusBadge label={meta.label} tone={meta.tone} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Vắng KP (30n)</dt>
                      <dd className="font-medium">{r.unexcused}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Điểm &lt;5</dt>
                      <dd className="font-medium">{r.lowGrades}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Sự cố mở</dt>
                      <dd className="font-medium">{r.openIncidents}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">HS cần tư vấn</dt>
                      <dd className="font-medium">{r.pendingCounseling}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                    Điểm rủi ro:{" "}
                    <span className="font-semibold text-foreground">
                      {r.score}
                    </span>
                  </p>
                </div>
              );
            })}
            {risks.length === 0 && (
              <p className="col-span-full rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Chưa có lớp nào trong trường.
              </p>
            )}
          </div>

          <h2 className="mb-3 mt-8 text-base font-semibold">
            Chi tiết theo lớp{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({flagged.length} lớp cần chú ý)
            </span>
          </h2>
          <DataTable
            columns={[
              "Lớp",
              "Vắng không phép (30 ngày)",
              "Số điểm <5",
              "Sự cố đang mở",
              "Ca tư vấn chờ xử lý",
              "Điểm rủi ro",
              "Mức độ",
            ]}
          >
            {risks.map((r) => {
              const meta = LEVEL_META[r.level];
              return (
                <tr key={r.classId}>
                  <td className="font-medium">{r.className}</td>
                  <td>{r.unexcused}</td>
                  <td>{r.lowGrades}</td>
                  <td>{r.openIncidents}</td>
                  <td>{r.pendingCounseling}</td>
                  <td className="font-semibold">{r.score}</td>
                  <td>
                    <StatusBadge label={meta.label} tone={meta.tone} />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </>
      )}

      <h2 className="mb-3 mt-8 flex items-center justify-between text-base font-semibold">
        <span>
          Cảnh báo cần xử lý{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({warnings.filter((w) => w.status === "open").length} đang mở)
          </span>
        </span>
        <RadarRefreshButton />
      </h2>
      <WarningList
        rows={warnings.map((w) => ({
          id: w.id,
          className: w.class_id ? (classNameMap.get(w.class_id) ?? "-") : "-",
          studentName: w.student_id
            ? (warnStudentName.get(w.student_id) ?? null)
            : null,
          category: w.category,
          severity: w.severity,
          title: w.title,
          detail: w.detail,
          suggestion: w.suggestion,
          status: w.status,
        }))}
      />
    </>
  );
}
