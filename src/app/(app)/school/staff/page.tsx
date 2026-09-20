import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StaffBoard } from "@/components/school/staff-board";
import { ROLE_LABELS } from "@/lib/nav";
import { compareVietnameseName } from "@/lib/utils";
import type {
  Campus,
  ClassRoom,
  Profile,
  Subject,
  SupportStaff,
} from "@/types";

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

export default async function StaffPage() {
  const profile = await requireRoles(["bgh", "ke_toan", "pht"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [
    { data: staffData },
    { data: campusData },
    { data: classData },
    { data: leaderData },
    { data: teacherData },
    { data: tsData },
    { data: subjectData },
  ] = await Promise.all([
    supabase
      .from("support_staff")
      .select("*")
      .eq("school_id", sid)
      .order("position"),
    supabase.from("campuses").select("*").eq("school_id", sid),
    supabase
      .from("classes")
      .select("id,name,campus_id,gvcn_id")
      .eq("school_id", sid)
      .eq("status", "active"),
    supabase
      .from("profiles")
      .select("id,role,campus_id,full_name")
      .eq("school_id", sid)
      .in("role", ["bgh", "pht"]),
    supabase
      .from("profiles")
      .select("id,full_name,email,role")
      .eq("school_id", sid)
      .in("role", ["gvcn", "gvbm"]),
    supabase.from("teacher_subjects").select("teacher_id,subject_id"),
    supabase.from("subjects").select("id,name").eq("school_id", sid),
  ]);

  const campuses = (campusData ?? []) as Campus[];
  const staff = (staffData ?? []) as SupportStaff[];
  const classes = (classData ?? []) as Pick<
    ClassRoom,
    "id" | "name" | "campus_id" | "gvcn_id"
  >[];
  const leaders = (leaderData ?? []) as Pick<
    Profile,
    "id" | "role" | "campus_id" | "full_name"
  >[];
  const teachers = (teacherData ?? []) as Pick<
    Profile,
    "id" | "full_name" | "email" | "role"
  >[];
  teachers.sort((a, b) => compareVietnameseName(a.full_name, b.full_name));

  const subjectNameOf = new Map(
    ((subjectData ?? []) as Pick<Subject, "id" | "name">[]).map((s) => [
      s.id,
      s.name,
    ]),
  );
  const teacherIds = new Set(teachers.map((t) => t.id));
  const subjectsOf = new Map<string, string[]>();
  for (const ts of (tsData ?? []) as {
    teacher_id: string;
    subject_id: string;
  }[]) {
    if (!teacherIds.has(ts.teacher_id)) continue;
    const name = subjectNameOf.get(ts.subject_id);
    if (!name) continue;
    const list = subjectsOf.get(ts.teacher_id) ?? [];
    list.push(name);
    subjectsOf.set(ts.teacher_id, list);
  }
  const classesOf = new Map<string, string[]>();
  for (const c of classes) {
    if (!c.gvcn_id) continue;
    const list = classesOf.get(c.gvcn_id) ?? [];
    list.push(c.name);
    classesOf.set(c.gvcn_id, list);
  }

  // Ma trận NQ37: mỗi cơ sở cần đủ 7 vị trí; phân hiệu/điểm trường cần PHT riêng
  const staffFor = (campusId: string | null) =>
    staff.filter((s) => s.campus_id === campusId || s.campus_id === null);
  const phtFor = (campusId: string) =>
    leaders.filter((p) => p.campus_id === campusId);
  const nq37Rows = campuses.map((cp) => {
    const s = staffFor(cp.id);
    const haveStd = new Set(s.filter((x) => x.standardized).map((x) => x.position));
    const missing = REQUIRED_POSITIONS.filter((p) => !haveStd.has(p.key));
    const needPht = cp.kind !== "main";
    const hasPht = phtFor(cp.id).length > 0;
    return {
      campus: cp,
      classCount: classes.filter((c) => c.campus_id === cp.id).length,
      staffCount: s.length,
      stdCount: haveStd.size,
      missing,
      needPht,
      hasPht,
      compliant: missing.length === 0 && (!needPht || hasPht),
    };
  });
  const compliantCount = nq37Rows.filter((r) => r.compliant).length;

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Nhân sự trường"
        description="Giáo viên, nhân sự hỗ trợ và ma trận định mức NQ37 theo từng cơ sở."
      />

      {/* Giáo viên */}
      <h2 className="mb-2 text-sm font-semibold">Giáo viên</h2>
      <DataTable
        columns={["Họ tên", "Vai trò", "Môn giảng dạy", "Lớp chủ nhiệm", "Email"]}
        footer={<span>{teachers.length} giáo viên</span>}
      >
        {teachers.map((t) => (
          <tr key={t.id}>
            <td className="font-medium">{t.full_name}</td>
            <td>
              <StatusBadge
                label={ROLE_LABELS[t.role]}
                tone={t.role === "gvcn" ? "success" : "muted"}
              />
            </td>
            <td>{subjectsOf.get(t.id)?.join(", ") || "-"}</td>
            <td>{classesOf.get(t.id)?.join(", ") || "-"}</td>
            <td className="text-muted-foreground">{t.email ?? "-"}</td>
          </tr>
        ))}
        {teachers.length === 0 && (
          <tr>
            <td colSpan={5} className="py-8 text-center text-muted-foreground">
              Chưa có giáo viên nào.
            </td>
          </tr>
        )}
      </DataTable>

      {/* Nhân sự hỗ trợ */}
      <h2 className="mb-2 mt-8 text-sm font-semibold">Nhân sự hỗ trợ</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Nhân viên y tế, thư viện, giáo vụ, tâm lý, CNTT, thiết bị - theo định
        mức hỗ trợ của NQ37.
      </p>
      <StaffBoard
        staff={staff.map((s) => ({
          id: s.id,
          full_name: s.full_name,
          position: s.position,
          campus_id: s.campus_id,
          qualification: s.qualification,
          standardized: s.standardized,
        }))}
        campuses={campuses.map((c) => ({ id: c.id, name: c.name }))}
      />

      {/* Định mức NQ37 */}
      <h2 className="mb-2 mt-8 text-sm font-semibold">Định mức nhân sự NQ37</h2>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard
          label="Cơ sở đạt định mức"
          value={`${compliantCount}/${campuses.length}`}
          tone={compliantCount === campuses.length ? "success" : "warning"}
        />
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
        {nq37Rows.map((r) => (
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
        {nq37Rows.length === 0 && (
          <tr>
            <td colSpan={7} className="py-8 text-center text-muted-foreground">
              Chưa có cơ sở nào - thêm tại trang Cơ sở & đánh giá TT15.
            </td>
          </tr>
        )}
      </DataTable>
      <p className="mt-3 text-xs text-muted-foreground">
        Định mức tham chiếu: mỗi cơ sở đủ 7 vị trí hỗ trợ đạt chuẩn trình độ;
        phân hiệu/điểm trường có Phó Hiệu trưởng phụ trách riêng (NQ37/Nghị
        định biên chế giáo dục). Nhân sự &quot;toàn trường&quot; tính chung cho
        mọi cơ sở.
      </p>
    </div>
  );
}
