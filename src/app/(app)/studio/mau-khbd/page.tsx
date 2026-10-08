import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ArrowLeft } from "lucide-react";
import { requireRoles } from "@/lib/auth";
import { requireFeature } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { KhbdTemplatesManager } from "@/components/tvc/khbd-templates-manager";
import { hasAnyRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function StudioKhbdTemplatesPage() {
  const profile = await requireRoles([
    "gvcn",
    "gvbm",
    "to_truong",
    "bgh",
    "admin",
  ]);
  await requireFeature("studio");
  const supabase = await createClient();
  const { data: tpls } = await supabase
    .from("tvc_khbd_templates")
    .select("id, name, activities, include_review, include_signoff, is_default, school_id")
    .order("is_default", { ascending: false })
    .order("name");

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
        title="Biểu mẫu kế hoạch bài dạy"
        description="Khung mặc định tham khảo Phụ lục IV CV 5512 - trường có thể tự cấu hình biểu mẫu riêng (không phải mẫu bắt buộc)"
      />
      <KhbdTemplatesManager
        templates={(tpls as never[]) ?? []}
        canManage={canManage}
      />
    </div>
  );
}
