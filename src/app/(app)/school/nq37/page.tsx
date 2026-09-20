import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Campus, ClassRoom, Profile, SupportStaff } from "@/types";

/**
 * Ma trận định mức nhân sự theo tinh thần NQ37 (biên chế giáo dục):
 * mỗi cơ sở cần đủ các vị trí hỗ trợ đạt chuẩn + PHT phụ trách riêng
 * cho phân hiệu/điểm trường.
 */
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
  const profile = await requireRoles(["bgh", "ke_toan", "pht"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [
    { data: campusData },
    { data: staffData },
    { data: classData },
    { data: profData },
  ] = await Promise.all([
    supabase.from("campuses").select("*").eq("school_id", sid),
    supabase.from("support_staff").select("*").eq("school_id", sid),
    supabase
      .from("classes")
      .select("id,campus_id")
      .eq("school_id", sid)
      .eq("status", "active"),
    supabase
      .from("profiles")
      .select("id,role,campus_id,full_name")
      .eq("school_id", sid)
      .in("role", ["bgh", "pht"]),
  ]);

  const campuses = (campusData ?? []) as Campus[];
  const staff = (staffData ?? []) as SupportStaff[];
  const classes = (classData ?? []) as Pick<ClassRoom, "id" | "campus_id">[];
  const leaders = (profData ?? []) as Pick<
    Profile,
    "id" | "role" | "campus_id" | "full_name"
  >[];

  const classCount = (campusId: string) =>
    classes.filter((c) => c.campus_id === campusId).length;
  const staffFor = (campusId: string | null) =>
    staff.filter(
      (s) => s.campus_id === campusId || s.campus_id === null,
    );
  const phtFor = (campusId: string) =>
    leaders.filter((p) => p.campus_id === campusId);

  // Định mức: mỗi cơ sở cần đủ 7 vị trí; phân hiệu/điểm trường cần PHT riêng
  const rows = campuses.map((cp) => {
    const s = staffFor(cp.id);
    const haveStd = new Set(
      s.filter((x) => x.standardized).map((x) => x.position),
    );
    const missing = REQUIRED_POSITIONS.filter((p) => !haveStd.has(p.key));
    const needPht = cp.kind !== "main";
    const hasPht = phtFor(cp.id).length > 0;
    return {
      campus: cp,
      classCount: classCount(cp.id),
      staffCount: s.length,
      stdCount: haveStd.size,
      missing,
      needPht,
      hasPht,
      compliant: missing.length === 0 && (!needPht || hasPht),
    };
  });

  const compliantCount = rows.filter((r) => r.compliant).length;

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Định mức nhân sự theo NQ37"
        description="Ma trận đối chiếu nhân sự hỗ trợ thực tế với định mức từng cơ sở - vị trí thiếu hoặc chưa đạt chuẩn được đánh dấu."
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Cơ sở đạt định mức" value={`${compliantCount}/${campuses.length}`} tone={compliantCount === campuses.length ? "success" : "warning"} />
        <StatCard label="Nhân sự hỗ trợ" value={staff.length} />
        <StatCard
          label="Đạt chuẩn trình độ"
          value={staff.filter((s) => s.standardized).length}
          tone="primary"
        />
      </div>

      <DataTable
        columns={[
          "Cơ sở",
          "Số lớp",
          "Nhân sự hỗ trợ",
          "Vị trí đạt chuẩn",
          "PHT phụ trách",
          "Vị trí còn thiếu",
          "Đánh giá",
        ]}
      >
        {rows.map((r) => (
          <tr key={r.campus.id}>
            <td className="font-medium">{r.campus.name}</td>
            <td>{r.classCount}</td>
            <td>{r.staffCount}</td>
            <td>
              {r.stdCount}/{REQUIRED_POSITIONS.length}
            </td>
            <td>
              {!r.needPht ? (
                <span className="text-muted-foreground">Không yêu cầu</span>
              ) : r.hasPht ? (
                <StatusBadge label="Đã có" tone="success" />
              ) : (
                <StatusBadge label="Chưa có" tone="error" />
              )}
            </td>
            <td className="max-w-72">
              {r.missing.length === 0 ? (
                <span className="text-success">Đủ</span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {r.missing.map((m) => m.label).join(", ")}
                </span>
              )}
            </td>
            <td>
              {r.compliant ? (
                <StatusBadge label="Đạt định mức" tone="success" />
              ) : (
                <StatusBadge label="Chưa đạt" tone="warning" />
              )}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="py-8 text-center text-muted-foreground">
              Chưa có cơ sở nào - thêm tại trang Cơ sở / phân hiệu.
            </td>
          </tr>
        )}
      </DataTable>
      <p className="mt-3 text-xs text-muted-foreground">
        Định mức tham chiếu: mỗi cơ sở đủ 7 vị trí hỗ trợ đạt chuẩn trình độ;
        phân hiệu/điểm trường có Phó Hiệu trưởng phụ trách riêng (NQ37/Nghị định
        biên chế giáo dục). Nhân sự &quot;toàn trường&quot; tính chung cho mọi cơ sở.
      </p>
    </div>
  );
}
