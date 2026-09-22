import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Campus } from "@/types";

const REQUIRED_POSITIONS: { key: string; label: string }[] = [
  { key: "y_te", label: "Nhân viên y tế" },
  { key: "thu_vien", label: "Thủ thư / thư viện" },
  { key: "giao_vu", label: "Giáo vụ / văn thư" },
  { key: "tam_ly", label: "Tư vấn tâm lý" },
  { key: "cntt", label: "Công nghệ thông tin" },
  { key: "thiet_bi", label: "Thiết bị dạy học" },
  { key: "tai_chinh", label: "Kế toán / tài chính" },
];

export default async function Nq37Page() {
  const profile = await requireRoles(["bgh", "pht", "ke_toan"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: cpRaw }, { data: clsRaw }, { data: staffRaw }, { data: profRaw }] =
    await Promise.all([
      supabase
        .from("campuses")
        .select("id,name,kind")
        .eq("school_id", sid)
        .order("name"),
      supabase
        .from("classes")
        .select("id,campus_id")
        .eq("school_id", sid)
        .eq("status", "active"),
      supabase
        .from("support_staff")
        .select("id,campus_id,position,standardized")
        .eq("school_id", sid),
      supabase
        .from("profiles")
        .select("id,role,campus_id")
        .eq("school_id", sid)
        .in("role", ["gvcn", "gvbm", "to_truong", "pht", "bgh"]),
    ]);
  const campuses = (cpRaw ?? []) as Pick<Campus, "id" | "name" | "kind">[];
  const classes = (clsRaw ?? []) as { id: string; campus_id: string | null }[];
  const staff = (staffRaw ?? []) as {
    id: string;
    campus_id: string | null;
    position: string;
    standardized: boolean;
  }[];
  const profiles = (profRaw ?? []) as {
    id: string;
    role: string;
    campus_id: string | null;
  }[];
  const teachers = profiles.filter((p) =>
    ["gvcn", "gvbm", "to_truong"].includes(p.role),
  );
  const leaders = profiles.filter((p) => ["bgh", "pht"].includes(p.role));

  const rows = campuses.map((cp) => {
    const clsCount = classes.filter((c) => c.campus_id === cp.id).length;
    const teacherCount = teachers.filter(
      (t) => t.campus_id === cp.id || t.campus_id === null,
    ).length;
    const s = staff.filter(
      (x) => x.campus_id === cp.id || x.campus_id === null,
    );
    const haveStd = new Set(
      s.filter((x) => x.standardized).map((x) => x.position),
    );
    const missing = REQUIRED_POSITIONS.filter((p) => !haveStd.has(p.key));
    const needPht = cp.kind !== "main";
    const hasPht = leaders.some(
      (l) => l.role === "pht" && l.campus_id === cp.id,
    );
    const ratio = clsCount > 0 ? teacherCount / clsCount : null;
    return {
      cp,
      clsCount,
      teacherCount,
      ratio,
      stdCount: haveStd.size,
      missing,
      needPht,
      hasPht,
      compliant: missing.length === 0 && (!needPht || hasPht),
    };
  });
  const compliant = rows.filter((r) => r.compliant).length;

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Định mức biên chế theo Nghị quyết 37"
        description="So sánh nhân sự thực tế với định mức: giáo viên trên lớp, 7 vị trí hỗ trợ đạt chuẩn, Phó Hiệu trưởng cho phân hiệu."
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard
          label="Cơ sở đạt định mức"
          value={`${compliant}/${rows.length}`}
          tone={compliant === rows.length && rows.length > 0 ? "success" : "warning"}
        />
        <StatCard label="Giáo viên toàn trường" value={teachers.length} />
        <StatCard
          label="Nhân sự hỗ trợ đạt chuẩn"
          value={staff.filter((s) => s.standardized).length}
          tone="primary"
        />
      </div>
      <DataTable
        columns={[
          "Cơ sở",
          "Số lớp",
          "Giáo viên",
          "GV/lớp",
          "Vị trí hỗ trợ đạt chuẩn",
          "Phó Hiệu trưởng",
          "Kết luận",
        ]}
        footer={<span>{rows.length} cơ sở</span>}
      >
        {rows.map((r) => (
          <tr key={r.cp.id}>
            <td className="font-medium">{r.cp.name}</td>
            <td>{r.clsCount}</td>
            <td>{r.teacherCount}</td>
            <td>{r.ratio !== null ? r.ratio.toFixed(2) : "-"}</td>
            <td>
              {r.stdCount}/{REQUIRED_POSITIONS.length}
              {r.missing.length > 0 && (
                <p className="mt-0.5 text-xs text-warning">
                  Thiếu: {r.missing.map((m) => m.label).join(", ")}
                </p>
              )}
            </td>
            <td>
              {r.needPht ? (
                <StatusBadge
                  label={r.hasPht ? "Đã có" : "Chưa bố trí"}
                  tone={r.hasPht ? "success" : "warning"}
                />
              ) : (
                <span className="text-muted-foreground">Không yêu cầu</span>
              )}
            </td>
            <td>
              <StatusBadge
                label={r.compliant ? "Đạt định mức" : "Chưa đạt"}
                tone={r.compliant ? "success" : "warning"}
              />
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="py-8 text-center text-muted-foreground">
              Chưa có cơ sở nào - khai báo tại trang Cơ sở & đánh giá TT15.
            </td>
          </tr>
        )}
      </DataTable>
      <p className="mt-3 text-xs text-muted-foreground">
        Quản lý nhân sự hỗ trợ tại trang{" "}
        <a href="/school/staff" className="text-primary hover:underline">
          Nhân sự trường
        </a>
        .
      </p>
    </div>
  );
}
