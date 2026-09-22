import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";

const ORG_TYPE: Record<string, string> = {
  so: "Sở Giáo dục và Đào tạo",
  phong: "Phòng Giáo dục và Đào tạo",
  ubnd: "UBND / xã / phường",
};

export default async function DeptWardsPage() {
  const profile = await requireRoles(["so_gd", "phong_gd", "ubnd", "admin"]);
  const supabase = await createClient();

  const { data: orgData } = await supabase
    .from("org_units")
    .select("id,type,name,parent_id")
    .order("name");
  const orgs = (orgData ?? []) as {
    id: string;
    type: string;
    name: string;
    parent_id: string | null;
  }[];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  // Phạm vi: so_gd thấy tất cả đơn vị con; phong_gd thấy đơn vị con + chính mình; ubnd chỉ mình.
  let visible: typeof orgs;
  if (profile.role === "phong_gd" && profile.org_unit_id) {
    visible = orgs.filter(
      (o) => o.parent_id === profile.org_unit_id || o.id === profile.org_unit_id,
    );
  } else if (profile.role === "ubnd" && profile.org_unit_id) {
    visible = orgs.filter((o) => o.id === profile.org_unit_id);
  } else {
    visible = orgs;
  }

  const { data: schoolRows } = await supabase
    .from("schools")
    .select("id,name,org_unit_id");
  const schools = (schoolRows ?? []) as {
    id: string;
    name: string;
    org_unit_id: string | null;
  }[];
  const byOrg = new Map<string, { id: string; name: string }[]>();
  for (const s of schools) {
    if (!s.org_unit_id) continue;
    byOrg.set(s.org_unit_id, [...(byOrg.get(s.org_unit_id) ?? []), s]);
  }

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Danh sách đơn vị hành chính"
        description="Các phòng, UBND/xã thuộc phạm vi quản lý và trường học trên từng địa bàn."
      />
      <DataTable
        columns={["Đơn vị", "Cấp", "Trực thuộc", "Số trường", "Trường trên địa bàn"]}
        footer={<span>{visible.length} đơn vị</span>}
      >
        {visible.map((o) => {
          const list = byOrg.get(o.id) ?? [];
          return (
            <tr key={o.id}>
              <td className="font-medium">{o.name}</td>
              <td>
                <StatusBadge
                  label={ORG_TYPE[o.type] ?? o.type}
                  tone={o.type === "so" ? "primary" : o.type === "phong" ? "success" : "muted"}
                />
              </td>
              <td className="text-muted-foreground">
                {o.parent_id ? (orgName.get(o.parent_id) ?? "-") : "-"}
              </td>
              <td>{list.length}</td>
              <td className="max-w-md">
                <span className="line-clamp-2 text-sm text-muted-foreground">
                  {list.map((s) => s.name).join(", ") || "-"}
                </span>
              </td>
            </tr>
          );
        })}
        {visible.length === 0 && (
          <tr>
            <td colSpan={5} className="py-8 text-center text-muted-foreground">
              Không có đơn vị nào trong phạm vi quản lý.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
