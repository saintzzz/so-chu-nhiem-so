import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { requireRoles, hasAnyRole } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { PageHeader } from "@/components/page-header";
import DocumentsBoard from "@/components/documents/board";

export const dynamic = "force-dynamic";

// CR-076: van_thu - so cong van den/di. Read bgh|admin|pht|ke_toan
// (RLS cung chan); write chi bgh|admin qua RPC.
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ dir?: string }>;
}) {
  const profile = await requireRoles(["bgh", "admin", "pht", "ke_toan"]);
  await requireModule("van_thu");
  const supabase = await createClient();
  const { dir } = await searchParams;
  const sid = profile.school_id ?? "";
  const direction = dir === "di" ? "di" : "den";

  const [{ data: docs }, { data: staff }] = sid
    ? await Promise.all([
        must(supabase
          .from("vt_documents")
          .select("id,direction,doc_no,doc_type,issued_date,from_org,to_org,subject,note,status,deadline,handler_id,created_at")
          .eq("school_id", sid)
          .eq("direction", direction)
          .order("issued_date", { ascending: false })
          .limit(200), "vt_documents"),
        must(supabase
          .from("profiles")
          .select("id,full_name")
          .eq("school_id", sid)
          .in("role", ["bgh", "admin", "pht", "ke_toan", "gvcn", "gvbm"])
          .limit(200), "profiles"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <>
      <PageHeader
        section="Học sinh & chất lượng"
        title="Sổ công văn"
        description="Công văn đến và đi - đăng ký, phân xử lý, theo hạn"
      />
      <DocumentsBoard
        direction={direction}
        docs={(docs ?? []) as Parameters<typeof DocumentsBoard>[0]["docs"]}
        staff={(staff ?? []) as Parameters<typeof DocumentsBoard>[0]["staff"]}
        canWrite={hasAnyRole(profile, ["bgh", "admin"])}
      />
    </>
  );
}
