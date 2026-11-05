import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { requireRoles } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import PrivacyBoard from "@/components/privacy/board";

export const dynamic = "force-dynamic";

// CR-115: privacy_dsr - so dong thuan PHHS + yeu cau quyen chu the.
// Chi bgh|admin (du lieu nhay cam ve consent); core - khong gate module.
export default async function PrivacyPage() {
  const profile = await requireRoles(["bgh", "admin"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: consents }, { data: requests }, { data: students }] = sid
    ? await Promise.all([
        must(supabase
          .from("consent_records")
          .select("id,student_id,subject_label,purpose,channel,granted,granted_by_name,note,created_at,revoked_at")
          .eq("school_id", sid)
          .order("created_at", { ascending: false })
          .limit(200), "consent_records"),
        must(supabase
          .from("data_requests")
          .select("id,req_type,subject_label,requester_name,requester_contact,detail,received_at,due_at,status,resolution_note,created_at")
          .eq("school_id", sid)
          .order("due_at")
          .limit(200), "data_requests"),
        must(supabase
          .from("students")
          .select("id,full_name")
          .eq("school_id", sid)
          .limit(500), "students"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <>
      <PageHeader
        section="Nhân sự & tổ chức"
        title="Dữ liệu cá nhân"
        description="Sổ ghi đồng thuận phụ huynh và tiếp nhận yêu cầu quyền chủ thể theo Luật 91/2025"
      />
      <PrivacyBoard
        consents={(consents ?? []) as Parameters<typeof PrivacyBoard>[0]["consents"]}
        requests={(requests ?? []) as Parameters<typeof PrivacyBoard>[0]["requests"]}
        students={(students ?? []) as Parameters<typeof PrivacyBoard>[0]["students"]}
      />
    </>
  );
}
