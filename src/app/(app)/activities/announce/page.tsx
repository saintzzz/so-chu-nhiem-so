import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AnnounceList } from "@/components/activities/announce-list";
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
  if (!iso) return "Chưa ấn định";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export default async function ActivitiesAnnouncePage() {
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
        .eq("status", "approved")
        .order("activity_date", { ascending: false })
    : { data: [] };
  const activities = (actData ?? []) as Activity[];

  const activityIds = activities.map((a) => a.id);
  const { data: attData } = activityIds.length
    ? await supabase
        .from("activity_attendance")
        .select("activity_id,student_id")
        .in("activity_id", activityIds)
    : { data: [] };
  const attendance = (attData ?? []) as {
    activity_id: string;
    student_id: string;
  }[];
  const regCount = new Map<string, number>();
  for (const r of attendance) {
    regCount.set(r.activity_id, (regCount.get(r.activity_id) ?? 0) + 1);
  }

  const { data: studentData } = classIds.length
    ? await supabase
        .from("students")
        .select("id,class_id")
        .in("class_id", classIds)
        .eq("status", "active")
    : { data: [] };
  const classStudentCount = new Map<string, number>();
  for (const s of (studentData ?? []) as { id: string; class_id: string }[]) {
    classStudentCount.set(
      s.class_id,
      (classStudentCount.get(s.class_id) ?? 0) + 1,
    );
  }

  return (
    <div>
      <PageHeader
        section="Phân hệ VII - Hoạt động GD"
        title="Thông báo & đăng ký"
        description="Gửi thông báo đến phụ huynh và đăng ký danh sách học sinh tham gia hoạt động đã được duyệt."
      />
      <AnnounceList
        activities={activities.map((a) => ({
          id: a.id,
          title: a.title,
          className: className.get(a.class_id) ?? "—",
          activityDate: fmtDate(a.activity_date),
          description: a.description,
          registered: regCount.get(a.id) ?? 0,
          studentCount: classStudentCount.get(a.class_id) ?? 0,
        }))}
      />
    </div>
  );
}
