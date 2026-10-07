import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SchoolsBoard } from "@/components/dept/schools-board";
import type { School } from "@/types";

export default async function DeptSchoolsPage() {
  await requireRoles(["so_gd", "admin"]);
  const supabase = await createClient();

  const [{ data: schoolsRaw }, { data: profilesRaw }] = await Promise.all([
    supabase.from("schools").select("id,name,code,level").order("name"),
    supabase.from("profiles").select("id,school_id"),
  ]);

  const schools = (schoolsRaw ?? []) as Pick<
    School,
    "id" | "name" | "code" | "level"
  >[];
  const userCounts: Record<string, number> = {};
  for (const p of profilesRaw ?? []) {
    if (p.school_id) userCounts[p.school_id] = (userCounts[p.school_id] ?? 0) + 1;
  }

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Quản lý trường"
        description="Tạo trường mới và cấp tài khoản quản trị đầu tiên - trường tự tạo tài khoản giáo viên sau đó."
      />
      <SchoolsBoard schools={schools} userCounts={userCounts} />
    </div>
  );
}
