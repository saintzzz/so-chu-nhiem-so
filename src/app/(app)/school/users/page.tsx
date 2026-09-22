import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UsersBoard } from "@/components/school/users-board";
import { compareVietnameseName } from "@/lib/utils";
import type { Campus, Profile } from "@/types";

interface Department {
  id: string;
  name: string;
}

export default async function SchoolUsersPage() {
  const profile = await requireRoles(["bgh"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: profRaw }, { data: campusRaw }, { data: deptRaw }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,email,role,campus_id,department_id,phone")
        .eq("school_id", sid)
        .neq("id", profile.id)
        .in("role", ["gvcn", "gvbm", "to_truong", "pht", "ke_toan"]),
      supabase.from("campuses").select("id,name").eq("school_id", sid),
      supabase.from("departments").select("id,name").eq("school_id", sid),
    ]);
  const users = (profRaw ?? []) as Pick<
    Profile,
    "id" | "full_name" | "email" | "role" | "campus_id" | "department_id" | "phone"
  >[];
  users.sort((a, b) => compareVietnameseName(a.full_name, b.full_name));

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Quản lý tài khoản giáo viên"
        description="Phân vai trò, cơ sở và tổ chuyên môn cho từng giáo viên trong trường."
      />
      <UsersBoard
        users={users}
        campuses={(campusRaw ?? []) as Pick<Campus, "id" | "name">[]}
        departments={(deptRaw ?? []) as Department[]}
      />
    </div>
  );
}
