import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StaffBoard } from "@/components/school/staff-board";
import type { Campus, SupportStaff } from "@/types";

export default async function StaffPage() {
  const profile = await requireRoles(["bgh", "ke_toan", "pht"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: staffData }, { data: campusData }] = await Promise.all([
    supabase
      .from("support_staff")
      .select("*")
      .eq("school_id", sid)
      .order("position"),
    supabase.from("campuses").select("*").eq("school_id", sid),
  ]);

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Nhân sự hỗ trợ"
        description="Nhân viên y tế, thư viện, giáo vụ, tâm lý, CNTT, thiết bị - theo định mức hỗ trợ của NQ37."
      />
      <StaffBoard
        staff={((staffData ?? []) as SupportStaff[]).map((s) => ({
          id: s.id,
          full_name: s.full_name,
          position: s.position,
          campus_id: s.campus_id,
          qualification: s.qualification,
          standardized: s.standardized,
        }))}
        campuses={((campusData ?? []) as Campus[]).map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />
    </div>
  );
}
