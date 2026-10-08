import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { AnnounceList } from "@/components/activities/announce-list";
import type { Activity, ClassRoom, Profile, Role } from "@/types";
import { hasAnyRole } from "@/lib/roles";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function scopedClasses(
  supabase: Supabase,
  profile: Profile,
): Promise<ClassRoom[]> {
  const wideRoles: Role[] = ["bgh", "so_gd", "admin", "to_truong"];
  let query = supabase.from("classes").select("*").order("name");
  if (hasAnyRole(profile, wideRoles)) {
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
  const profile = await requireRoles(["gvcn", "bgh"]);
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

  // R6-03: phan trang - PostgREST cat ngam o ~1000 rows se lam sai so dang ky.
  // activity_attendance khong co cot id -> order composite (activity_id,
  // student_id) la khoa on dinh cho range paging.
  const activityIds = activities.map((a) => a.id);
  const emptyRes = { rows: [], error: null, truncated: false };
  const [attRes, stuRes] = await Promise.all([
    activityIds.length
      ? fetchAllRows<{ activity_id: string; student_id: string }>((f, t) =>
          supabase
            .from("activity_attendance")
            .select("activity_id,student_id")
            .in("activity_id", activityIds)
            .order("activity_id")
            .order("student_id")
            .range(f, t),
        )
      : Promise.resolve(emptyRes),
    classIds.length
      ? fetchAllRows<{ id: string; class_id: string }>((f, t) =>
          supabase
            .from("students")
            .select("id,class_id")
            .in("class_id", classIds)
            .eq("status", "active")
            .order("id")
            .range(f, t),
        )
      : Promise.resolve(emptyRes),
  ]);
  // Loi/truncated -> hien thong bao thay vi render so lieu thieu chinh xac.
  const errors: string[] = [];
  if (attRes.error || attRes.truncated) errors.push("attendance");
  if (stuRes.error || stuRes.truncated) errors.push("students");

  const regCount = new Map<string, number>();
  for (const r of attRes.rows) {
    regCount.set(r.activity_id, (regCount.get(r.activity_id) ?? 0) + 1);
  }

  const classStudentCount = new Map<string, number>();
  for (const s of stuRes.rows) {
    classStudentCount.set(
      s.class_id,
      (classStudentCount.get(s.class_id) ?? 0) + 1,
    );
  }

  return (
    <div>
      <PageHeader
        section="Hoạt động giáo dục"
        title="Thông báo & đăng ký"
        description="Gửi thông báo đến phụ huynh và đăng ký danh sách học sinh tham gia hoạt động đã được duyệt."
      />
      {errors.length > 0 ? (
        <p className="rounded-xl border border-l-4 border-l-error border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Không tải đủ dữ liệu nguồn để hiển thị số đăng ký - kết quả có thể
          thiếu chính xác. Vui lòng thử lại sau.
        </p>
      ) : (
        <AnnounceList
          activities={activities.map((a) => ({
            id: a.id,
            title: a.title,
            className: className.get(a.class_id) ?? "-",
            activityDate: fmtDate(a.activity_date),
            description: a.description,
            registered: regCount.get(a.id) ?? 0,
            studentCount: classStudentCount.get(a.class_id) ?? 0,
          }))}
        />
      )}
    </div>
  );
}
