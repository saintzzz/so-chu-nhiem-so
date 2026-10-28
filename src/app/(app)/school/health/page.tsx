import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { requireRoles, hasAnyRole } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import { PageHeader } from "@/components/page-header";
import HealthBoard from "@/components/health/board";

export const dynamic = "force-dynamic";

// CR-075: y te + BHYT hoc sinh. Read bgh|admin|pht (gvcn lop minh qua RLS).
export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["bgh", "admin", "pht"]);
  await requireModule("y_te_bhyt");
  const supabase = await createClient();
  const { class: classId } = await searchParams;
  const sid = profile.school_id ?? "";

  const { data: classes } = sid
    ? await must(supabase
        .from("classes")
        .select("id,name,grade")
        .eq("school_id", sid)
        .order("grade")
        .order("name"), "classes")
    : { data: [] };

  const cls = (classes ?? []).find((c) => c.id === classId) ?? classes?.[0] ?? null;

  const [{ data: students }, { data: healthRows }, { data: bhytRows }] = cls && sid
    ? await Promise.all([
        must(supabase
          .from("students")
          .select("id,full_name,code,dob,gender")
          .eq("class_id", cls.id)
          .order("full_name"), "students"),
        must(supabase
          .from("yt_health_records")
          .select("id,student_id,checked_at,height_cm,weight_kg,vision_left,vision_right,dental,conclusion")
          .eq("school_id", sid)
          .order("checked_at", { ascending: false })
          .limit(500), "yt_health_records"),
        must(supabase
          .from("yt_bhyt_cards")
          .select("student_id,card_no,kcbb_code,valid_from,valid_to,status")
          .eq("school_id", sid)
          .limit(500), "yt_bhyt_cards"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <>
      <PageHeader
        section="Quản trị"
        title="Y tế & BHYT học sinh"
        description="Sổ khám sức khỏe định kỳ và thẻ bảo hiểm y tế theo lớp"
      />
      <HealthBoard
        classes={classes ?? []}
        currentClassId={cls?.id ?? null}
        students={(students ?? []) as Parameters<typeof HealthBoard>[0]["students"]}
        health={(healthRows ?? []) as Parameters<typeof HealthBoard>[0]["health"]}
        bhyt={(bhytRows ?? []) as Parameters<typeof HealthBoard>[0]["bhyt"]}
        canWrite={hasAnyRole(profile, ["bgh", "admin"])}
      />
    </>
  );
}
