import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { requireFeature } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { UsersBoard } from "@/components/school/users-board";
import { FeatureMatrix } from "@/components/school/feature-permissions";
import { compareVietnameseName } from "@/lib/utils";
import type { Campus, Profile } from "@/types";

interface Department {
  id: string;
  name: string;
  subject_ids?: string[];
}

export default async function SchoolUsersPage() {
  const profile = await requireRoles(["bgh", "admin"]);
  await requireFeature("school.users");
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: profRaw }, { data: campusRaw }, { data: deptRaw }, { data: subjRaw }, { data: tsRaw }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,email,role,campus_id,department_id,phone,staff_code,employment_type,qualification,concurrent_roles")
        .eq("school_id", sid)
        .neq("id", profile.id)
        .in("role", ["gvcn", "gvbm", "to_truong", "pht", "ke_toan"]),
      supabase.from("campuses").select("id,name").eq("school_id", sid),
      supabase.from("departments").select("id,name,subject_ids").eq("school_id", sid),
      supabase.from("subjects").select("id,name").eq("school_id", sid).order("name"),
      supabase
        .from("teacher_subjects")
        .select("teacher_id,subject_id"),
    ]);
  const { data: grants } = await supabase
    .from("feature_grants")
    .select("id,feature,role,user_id,effect");
  const users = (profRaw ?? []) as (Pick<
    Profile,
    "id" | "full_name" | "email" | "role" | "campus_id" | "department_id" | "phone"
  > & {
    staff_code?: string | null;
    employment_type?: string | null;
    qualification?: string | null;
    concurrent_roles?: string[];
  })[];
  // gom mon theo GV cho board
  const subjectsByTeacher = new Map<string, string[]>();
  for (const r of tsRaw ?? []) {
    const arr = subjectsByTeacher.get(r.teacher_id) ?? [];
    arr.push(r.subject_id);
    subjectsByTeacher.set(r.teacher_id, arr);
  }
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
        subjects={(subjRaw ?? []) as { id: string; name: string }[]}
        teacherSubjects={Object.fromEntries(subjectsByTeacher)}
        grants={grants ?? []}
      />
      <h2 className="mb-2 mt-8 text-sm font-semibold">
        Ma trận quyền chức năng theo vai trò
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Mặc định theo vai trò hệ thống - bấm Cấm/Cho để tùy chỉnh theo trường.
        Quyền riêng của từng giáo viên (nút Quyền riêng trong bảng trên) sẽ ghi
        đè cấu hình này.
      </p>
      <FeatureMatrix grants={grants ?? []} />
    </div>
  );
}
