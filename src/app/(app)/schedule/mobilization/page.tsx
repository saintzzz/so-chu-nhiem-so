import { createClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/must";
import { requireRoles } from "@/lib/auth";
import { requireModule } from "@/lib/modules";
import MobilizationBoard from "@/components/mobilization/board";

export const dynamic = "force-dynamic";

// CR-070: dieu dong GV gan timetable_entry - bgh|admin|pht quan ly.
export default async function MobilizationPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await requireRoles(["bgh", "admin", "pht"]);
  await requireModule("dieu_dong");
  const supabase = await createClient();
  const { class: classId } = await searchParams;

  const [{ data: classes }, { data: teachers }, { data: assignments }] =
    await Promise.all([
      must(supabase
        .from("classes")
        .select("id,name,grade")
        .eq("school_id", profile.school_id)
        .order("grade")
        .order("name"), "classes"),
      must(supabase
        .from("profiles")
        .select("id,full_name")
        .eq("school_id", profile.school_id)
        .or("role.in.(gvbm,gvcn,to_truong,bgh,pht),concurrent_roles.ov.{gvbm,gvcn,to_truong,bgh,pht}")
        .limit(300), "profiles"),
      must(supabase
        .from("dd_assignments")
        .select("id,timetable_entry_id,teacher_id,effective_from,effective_to,status,reason,created_at")
        .eq("school_id", profile.school_id)
        .order("created_at", { ascending: false })
        .limit(200), "dd_assignments"),
    ]);

  const cls = classes?.find((c) => c.id === classId) ?? classes?.[0] ?? null;
  const { data: entries } = cls
    ? await must(supabase
        .from("timetable_entries")
        .select("id,weekday,period,room,teacher_id,subjects(name),profiles:teacher_id(full_name)")
        .eq("class_id", cls.id)
        .order("weekday")
        .order("period"), "timetable_entries")
    : { data: [] };

  return (
    <MobilizationBoard
      classes={classes ?? []}
      currentClassId={cls?.id ?? null}
      entries={(entries ?? []) as unknown as Parameters<typeof MobilizationBoard>[0]["entries"]}
      teachers={teachers ?? []}
      assignments={assignments ?? []}
    />
  );
}
