import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Tt15Form } from "@/components/school/tt15-form";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/utils";
import type { Campus, Tt15Evaluation } from "@/types";

export default async function Tt15Page() {
  const profile = await requireRoles(["bgh"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: campusData }, { data: evalData }] = await Promise.all([
    supabase.from("campuses").select("*").eq("school_id", sid),
    supabase
      .from("tt15_evaluations")
      .select("*")
      .eq("school_id", sid)
      .order("created_at", { ascending: false }),
  ]);
  const campuses = (campusData ?? []) as Campus[];
  const evals = (evalData ?? []) as Tt15Evaluation[];
  const campusName = new Map(campuses.map((c) => [c.id, c.name]));

  const RATING_LABEL: Record<string, { label: string; tone: "success" | "primary" | "warning" | "error" }> = {
    muc_1: { label: "Mức 1", tone: "success" },
    muc_2: { label: "Mức 2", tone: "primary" },
    muc_3: { label: "Mức 3", tone: "warning" },
    chua_dat: { label: "Chưa đạt", tone: "error" },
  };
  const STATUS_LABEL: Record<string, { label: string; tone: "muted" | "warning" | "success" }> = {
    draft: { label: "Nháp", tone: "muted" },
    submitted: { label: "Đã nộp", tone: "warning" },
    verified: { label: "Đã kiểm chứng", tone: "success" },
  };

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Đánh giá chất lượng theo TT15"
        description="Tự đánh giá kiểm định chất lượng giáo dục theo từng cơ sở - 5 nhóm tiêu chuẩn, tổng 100 điểm."
      />
      <Tt15Form
        campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
      />
      <h2 className="mb-2 mt-8 text-sm font-semibold">Lịch sử đánh giá</h2>
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
                label={STATUS_LABEL[e.status]?.label ?? e.status}
                tone={STATUS_LABEL[e.status]?.tone ?? "muted"}
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
