import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ArrowLeft } from "lucide-react";
import { requireRoles } from "@/lib/auth";
import { requireFeature } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { CurriculumStandard, Subject } from "@/types/tvc";
import { StandardsManager } from "@/components/tvc/standards-manager";
import { hasAnyRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function StudioYccdPage() {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong", "bgh", "admin"]);
  await requireFeature("studio");
  const supabase = await createClient();
  const [{ data: stds }, { data: subs }] = await Promise.all([
    supabase
      .from("tvc_curriculum_standards")
      .select("id, code, subject_code, grade, strand, lesson_ref, description, competencies, school_id, status")
      .order("grade")
      .order("code")
      .limit(1000),
    supabase.from("tvc_subjects").select("*").order("code"),
  ]);

  const canManage = hasAnyRole(profile, ["to_truong", "bgh", "admin"]);
  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/studio"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Tất cả công cụ
      </Link>
      <PageHeader
        section="Công cụ số giáo viên"
        title="Yêu cầu cần đạt của trường"
        description="YCCĐ hệ thống (không sửa được) + YCCĐ riêng của trường - tổ trưởng/BGH thêm, sửa, xoá"
      />
      <StandardsManager
        standards={(stds as CurriculumStandard[]) ?? []}
        subjects={(subs as Subject[]) ?? []}
        canManage={canManage}
      />
    </div>
  );
}
