import { createClient } from "@/lib/supabase/server";
import { requireRoles, hasAnyRole } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import GraduationBoard from "@/components/graduation/board";

export const dynamic = "force-dynamic";

// CR-068: xet tot nghiep cuoi cap - bgh quan ly, gvcn nhap diem lop minh.
export default async function GraduationPage() {
  const profile = await requireRoles(["bgh", "admin", "gvcn"]);
  await requireModule("xet_tot_nghiep");
  const supabase = await createClient();
  const canManage = hasAnyRole(profile, ["bgh", "admin"]);

  const [campRes, decRes] = await Promise.all([
    supabase
      .from("tn_campaigns")
      .select("id,level,name,pass_score,require_exam,status,created_at,finalized_at")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("tn_decisions")
      .select("id,campaign_id,student_id,kqht,kqrl,exam_score,eligible,decision,note,students(full_name,student_code,classes(name))")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  return (
    <GraduationBoard
      campaigns={campRes.data ?? []}
      decisions={(decRes.data ?? []) as never[]}
      canManage={canManage}
      loadError={campRes.error?.message ?? decRes.error?.message ?? null}
    />
  );
}
