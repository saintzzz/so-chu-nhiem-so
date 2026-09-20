import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CampusManager } from "@/components/school/campus-manager";
import type { Campus, ClassRoom } from "@/types";

const KIND_LABEL: Record<Campus["kind"], string> = {
  main: "Cơ sở chính",
  phan_hieu: "Phân hiệu",
  diem_truong: "Điểm trường",
};

export default async function CampusesPage() {
  const profile = await requireRoles(["bgh"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: campusData }, { data: classData }] = await Promise.all([
    supabase.from("campuses").select("*").eq("school_id", sid).order("kind"),
    supabase
      .from("classes")
      .select("*")
      .eq("school_id", sid)
      .eq("status", "active")
      .order("name"),
  ]);
  const campuses = (campusData ?? []) as Campus[];
  const classes = (classData ?? []) as ClassRoom[];

  const countByCampus = new Map<string, number>();
  for (const c of classes) {
    if (c.campus_id)
      countByCampus.set(c.campus_id, (countByCampus.get(c.campus_id) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Cơ sở / phân hiệu"
        description="Quản lý các điểm trường và phân hiệu - mỗi lớp thuộc một cơ sở để BGH/PHT theo dõi đúng phạm vi."
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
    </div>
  );
}
