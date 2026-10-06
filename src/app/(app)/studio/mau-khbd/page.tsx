import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KhbdTemplatesManager } from "@/components/tvc/khbd-templates-manager";

export const dynamic = "force-dynamic";

export default async function StudioKhbdTemplatesPage() {
  const profile = await requireRoles([
    "gvcn",
    "gvbm",
    "to_truong",
    "bgh",
    "admin",
  ]);
  const supabase = await createClient();
  const { data: tpls } = await supabase
    .from("tvc_khbd_templates")
    .select("id, name, activities, include_review, include_signoff, is_default, school_id")
    .order("is_default", { ascending: false })
    .order("name");

  const canManage = ["to_truong", "bgh", "admin"].includes(profile.role);
  return (
    <div className="mx-auto max-w-6xl">
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
