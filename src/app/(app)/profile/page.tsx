import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { requireRoles, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/nav";
import { ProfileForm } from "@/components/profile/profile-form";
import type { Campus, ClassRoom, School } from "@/types";

export default async function ProfilePage() {
  const profile = await requireRoles(STAFF_ROLES);
  const supabase = await createClient();

  const [{ data: schoolRaw }, { data: campusRaw }, { data: deptRaw }, { data: classesRaw }, { data: tsRaw }] =
    await Promise.all([
      profile.school_id
        ? supabase.from("schools").select("id,name").eq("id", profile.school_id).maybeSingle()
        : Promise.resolve({ data: null }),
      profile.campus_id
        ? supabase.from("campuses").select("id,name").eq("id", profile.campus_id).maybeSingle()
        : Promise.resolve({ data: null }),
      profile.department_id
        ? supabase.from("departments").select("id,name").eq("id", profile.department_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("classes").select("id,name").eq("gvcn_id", profile.id).order("name"),
      supabase
        .from("teacher_subjects")
        .select("subject_id,subjects(name)")
        .eq("teacher_id", profile.id),
    ]);

  const school = (schoolRaw ?? null) as Pick<School, "id" | "name"> | null;
  const campus = (campusRaw ?? null) as Pick<Campus, "id" | "name"> | null;
  const dept = (deptRaw ?? null) as { id: string; name: string } | null;
  const homeroom = (classesRaw ?? []) as Pick<ClassRoom, "id" | "name">[];
  const subjects = ((tsRaw ?? []) as unknown as {
    subjects: { name: string } | null;
  }[])
    .map((r) => r.subjects?.name)
    .filter(Boolean) as string[];

  return (
    <div>
      <PageHeader
        section="Hồ sơ cá nhân"
        title="Hồ sơ của tôi"
        description="Thông tin tài khoản và phân công trong trường."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <h2 className="mb-3 text-sm font-semibold">Thông tin chung</h2>
          <DataTable columns={["Mục", "Giá trị"]}>
            <tr>
              <td className="text-muted-foreground">Họ và tên</td>
              <td className="font-medium">{profile.full_name}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Vai trò</td>
              <td>
                <StatusBadge label={ROLE_LABELS[profile.role]} tone="primary" />
              </td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Email</td>
              <td>{profile.email ?? "-"}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Trường</td>
              <td>{school?.name ?? "-"}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Cơ sở / phân hiệu</td>
              <td>{campus?.name ?? "-"}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Tổ chuyên môn</td>
              <td>{dept?.name ?? "-"}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Lớp chủ nhiệm</td>
              <td>{homeroom.map((c) => c.name).join(", ") || "-"}</td>
            </tr>
            <tr>
              <td className="text-muted-foreground">Môn giảng dạy</td>
              <td>{subjects.join(", ") || "-"}</td>
            </tr>
          </DataTable>
        </div>
        <ProfileForm phone={profile.phone ?? ""} />
      </div>
    </div>
  );
}
