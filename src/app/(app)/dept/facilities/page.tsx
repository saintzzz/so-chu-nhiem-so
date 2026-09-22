import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";

export default async function DeptFacilitiesPage() {
  const profile = await requireRoles(["so_gd", "phong_gd", "ubnd", "admin"]);
  const supabase = await createClient();

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
    ? allSchools.filter((s) => s.org_unit_id && scopedOrgIds.has(s.org_unit_id))
    : allSchools;
  const schoolIds = scopedSchools.map((s) => s.id);
  const schoolName = new Map(scopedSchools.map((s) => [s.id, s.name]));
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  const [{ data: campusRows }, { data: eqRows }] = await Promise.all([
    schoolIds.length
      ? supabase
          .from("campuses")
          .select("id,school_id,name,kind,distance_km,address")
          .in("school_id", schoolIds)
      : Promise.resolve({ data: [] }),
    schoolIds.length
      ? supabase
          .from("equipment")
          .select("id,school_id,campus_id,name,category,quantity,condition")
          .in("school_id", schoolIds)
      : Promise.resolve({ data: [] }),
  ]);
  const campuses = (campusRows ?? []) as {
    id: string;
    school_id: string;
    name: string;
    kind: string;
    distance_km: number | null;
    address: string | null;
  }[];
  const equipment = (eqRows ?? []) as {
    id: string;
    school_id: string;
    campus_id: string | null;
    name: string;
    category: string;
    quantity: number;
    condition: string;
  }[];
  const campusName = new Map(campuses.map((c) => [c.id, c.name]));
  const broken = equipment.filter(
    (e) => e.condition === "hong_nhe" || e.condition === "hong_nang",
  );

  const KIND: Record<string, string> = {
    main: "Cơ sở chính",
    phan_hieu: "Phân hiệu",
    diem_truong: "Điểm trường",
  };
  const COND: Record<string, { label: string; tone: "success" | "warning" | "error" | "muted" }> = {
    tot: { label: "Tốt", tone: "success" },
    hong_nhe: { label: "Hỏng nhẹ", tone: "warning" },
    hong_nang: { label: "Hỏng nặng", tone: "error" },
    thanh_ly: { label: "Thanh lý", tone: "muted" },
  };

  return (
    <div>
      <PageHeader
        section="Giám sát & báo cáo"
        title="Cơ sở vật chất & thiết bị các trường"
        description="Cơ sở/phân hiệu và tình trạng thiết bị trên địa bàn quản lý."
      />

      <h2 className="mb-2 text-sm font-semibold">Cơ sở / phân hiệu</h2>
      <DataTable
        columns={["Cơ sở", "Trường", "Đơn vị quản lý", "Loại", "Khoảng cách", "Địa chỉ"]}
        footer={<span>{campuses.length} cơ sở</span>}
      >
        {campuses.map((c) => {
          const sch = scopedSchools.find((s) => s.id === c.school_id);
          return (
            <tr key={c.id}>
              <td className="font-medium">{c.name}</td>
              <td className="text-muted-foreground">{schoolName.get(c.school_id) ?? "-"}</td>
              <td className="text-muted-foreground">
                {sch?.org_unit_id ? (orgName.get(sch.org_unit_id) ?? "-") : "-"}
              </td>
              <td>
                <StatusBadge
                  label={KIND[c.kind] ?? c.kind}
                  tone={c.kind === "main" ? "primary" : "muted"}
                />
              </td>
              <td>{c.distance_km !== null ? `${c.distance_km} km` : "-"}</td>
              <td className="max-w-56 text-sm text-muted-foreground">{c.address ?? "-"}</td>
            </tr>
          );
        })}
        {campuses.length === 0 && (
          <tr>
            <td colSpan={6} className="py-8 text-center text-muted-foreground">
              Chưa có cơ sở nào.
            </td>
          </tr>
        )}
      </DataTable>

      <h2 className="mb-2 mt-6 text-sm font-semibold">
        Thiết bị hỏng / cần xử lý ({broken.length})
      </h2>
      <DataTable
        columns={["Thiết bị", "Trường", "Cơ sở", "Số lượng", "Tình trạng"]}
        footer={<span>{broken.length} mục</span>}
      >
        {broken.map((e) => (
          <tr key={e.id}>
            <td className="font-medium">{e.name}</td>
            <td className="text-muted-foreground">{schoolName.get(e.school_id) ?? "-"}</td>
            <td className="text-muted-foreground">
              {e.campus_id ? (campusName.get(e.campus_id) ?? "-") : "Toàn trường"}
            </td>
            <td>{e.quantity}</td>
            <td>
              <StatusBadge
                label={COND[e.condition]?.label ?? e.condition}
                tone={COND[e.condition]?.tone ?? "muted"}
              />
            </td>
          </tr>
        ))}
        {broken.length === 0 && (
          <tr>
            <td colSpan={5} className="py-8 text-center text-muted-foreground">
              Không có thiết bị hỏng.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
