import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActivityPlanner } from "@/components/activities/activity-planner";
import type { Activity, ClassRoom, Profile } from "@/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function scopedClasses(
  supabase: Supabase,
  profile: Profile,
): Promise<ClassRoom[]> {
  const wideRoles = ["bgh", "so_gd", "admin", "to_truong"];
  let query = supabase.from("classes").select("*").order("name");
  if (wideRoles.includes(profile.role)) {
    if (profile.school_id) query = query.eq("school_id", profile.school_id);
  } else {
    query = query.eq("gvcn_id", profile.id);
  }
  const { data } = await query;
  return (data ?? []) as ClassRoom[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export default async function ActivitiesPlanPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const classes = await scopedClasses(supabase, profile);
  const classIds = classes.map((c) => c.id);
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const { data: actData } = classIds.length
    ? await supabase
        .from("activities")
        .select("*")
        .in("class_id", classIds)
        .order("activity_date", { ascending: false })
    : { data: [] };
  const activities = (actData ?? []) as Activity[];

  const isBgh = ["bgh", "admin"].includes(profile.role);
  const canCreate = !isBgh;

  return (
    <div>
      <PageHeader
        section="Phân hệ VII - Hoạt động GD"
        title="Lập kế hoạch & phê duyệt"
        description={
          isBgh
            ? "Phê duyệt kế hoạch hoạt động giáo dục do GVCN các lớp gửi lên."
            : "Tạo kế hoạch hoạt động giáo dục của lớp và gửi Ban Giám Hiệu phê duyệt."
        }
      />
      <ActivityPlanner
        activities={activities.map((a) => ({
          id: a.id,
          title: a.title,
          className: className.get(a.class_id) ?? "—",
          activityDate: fmtDate(a.activity_date),
          description: a.description,
          status: a.status,
        }))}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        canCreate={canCreate}
        isBgh={isBgh}
      />
    </div>
  );
}
