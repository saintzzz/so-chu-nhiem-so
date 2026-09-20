import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CampusManager } from "@/components/school/campus-manager";
import { Tt15Form } from "@/components/school/tt15-form";
import { formatDateTime } from "@/lib/utils";
import type { Campus, ClassRoom, Tt15Evaluation } from "@/types";

const KIND_LABEL: Record<Campus["kind"], string> = {
  main: "Cơ sở chính",
  phan_hieu: "Phân hiệu",
  diem_truong: "Điểm trường",
};

const RATING_LABEL: Record<
  string,
  { label: string; tone: "success" | "primary" | "warning" | "error" }
> = {
  muc_1: { label: "Mức 1", tone: "success" },
  muc_2: { label: "Mức 2", tone: "primary" },
  muc_3: { label: "Mức 3", tone: "warning" },
  chua_dat: { label: "Chưa đạt", tone: "error" },
};
const EVAL_STATUS: Record<
  string,
  { label: string; tone: "muted" | "warning" | "success" }
> = {
  draft: { label: "Nháp", tone: "muted" },
  submitted: { label: "Đã nộp", tone: "warning" },
  verified: { label: "Đã kiểm chứng", tone: "success" },
};

export default async function CampusesPage() {
  const profile = await requireRoles(["bgh", "pht", "ke_toan"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: campusData }, { data: classData }, { data: evalData }] =
    await Promise.all([
      supabase.from("campuses").select("*").eq("school_id", sid).order("kind"),
      supabase
        .from("classes")
        .select("*")
        .eq("school_id", sid)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("tt15_evaluations")
        .select("*")
        .eq("school_id", sid)
        .order("created_at", { ascending: false }),
    ]);
  const campuses = (campusData ?? []) as Campus[];
  const classes = (classData ?? []) as ClassRoom[];
  const evals = (evalData ?? []) as Tt15Evaluation[];
  const campusName = new Map(campuses.map((c) => [c.id, c.name]));

  const countByCampus = new Map<string, number>();
  for (const c of classes) {
    if (c.campus_id)
      countByCampus.set(c.campus_id, (countByCampus.get(c.campus_id) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Cơ sở & đánh giá TT15"
        description="Quản lý điểm trường/phân hiệu và tự đánh giá kiểm định chất lượng (TT15) theo từng cơ sở."
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Tổng cơ sở" value={campuses.length} />
        <StatCard
          label="Phân hiệu / điểm trường"
          value={campuses.filter((c) => c.kind !== "main").length}
        />
        <StatCard
          label="Lớp chưa gán cơ sở"
          value={classes.filter((c) => !c.campus_id).length}
          tone={classes.some((c) => !c.campus_id) ? "warning" : "success"}
        />
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Danh sách cơ sở</h2>
        <DataTable columns={["Tên", "Loại", "Khoảng cách", "Địa chỉ", "Số lớp"]}>
          {campuses.map((c) => (
            <tr key={c.id}>
              <td className="font-medium">{c.name}</td>
              <td>
                <StatusBadge
                  label={KIND_LABEL[c.kind]}
                  tone={c.kind === "main" ? "primary" : "muted"}
                />
              </td>
              <td>
                {c.kind === "main"
                  ? "-"
                  : `${c.distance_km ?? "?"} km từ trung tâm`}
              </td>
              <td className="text-muted-foreground">{c.address ?? "-"}</td>
              <td>{countByCampus.get(c.id) ?? 0}</td>
            </tr>
          ))}
          {campuses.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-muted-foreground">
                Chưa có cơ sở nào - thêm cơ sở chính trước.
              </td>
            </tr>
          )}
        </DataTable>
      </div>

      <CampusManager
        campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
        classes={classes.map((c) => ({
          id: c.id,
          name: c.name,
          campus_id: c.campus_id,
        }))}
      />

      {/* Đánh giá chất lượng TT15 theo cơ sở */}
      <h2 className="mb-2 mt-8 text-sm font-semibold">
        Đánh giá chất lượng theo TT15
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Tự đánh giá kiểm định chất lượng giáo dục theo từng cơ sở - 5 nhóm
        tiêu chuẩn, tổng 100 điểm.
      </p>
      {profile.role === "bgh" && (
        <Tt15Form campuses={campuses.map((c) => ({ id: c.id, name: c.name }))} />
      )}
      <DataTable
        columns={["Cơ sở", "Kỳ", "Tổng điểm", "Xếp mức", "Trạng thái", "Tạo lúc"]}
      >
        {evals.map((e) => (
          <tr key={e.id}>
            <td className="font-medium">
              {e.campus_id ? (campusName.get(e.campus_id) ?? "-") : "Toàn trường"}
            </td>
            <td>{e.term}</td>
            <td className="font-semibold">{e.total ?? "-"}/100</td>
            <td>
              {e.rating ? (
                <StatusBadge
                  label={RATING_LABEL[e.rating]?.label ?? e.rating}
                  tone={RATING_LABEL[e.rating]?.tone ?? "muted"}
                />
              ) : (
                "-"
              )}
            </td>
            <td>
              <StatusBadge
                label={EVAL_STATUS[e.status]?.label ?? e.status}
                tone={EVAL_STATUS[e.status]?.tone ?? "muted"}
              />
            </td>
            <td className="text-muted-foreground">
              {formatDateTime(e.created_at)}
            </td>
          </tr>
        ))}
        {evals.length === 0 && (
          <tr>
            <td colSpan={6} className="py-8 text-center text-muted-foreground">
              Chưa có đánh giá nào - tạo đánh giá đầu tiên ở trên.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
