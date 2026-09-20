import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ApprovalsQueue } from "@/components/school/approvals-queue";
import type {
  Activity,
  ClassRoom,
  LessonPlan,
  Profile,
  Subject,
  SubstituteRequest,
} from "@/types";

export default async function ApprovalsPage() {
  const profile = await requireRoles(["bgh", "pht"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [
    { data: classData },
    { data: subData },
    { data: profData },
    { data: lpData },
    { data: subReqData },
    { data: actData },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .eq("school_id", sid)
      .eq("status", "active"),
    supabase.from("subjects").select("*").eq("school_id", sid),
    supabase.from("profiles").select("id,full_name").eq("school_id", sid),
    supabase
      .from("lesson_plans")
      .select("*")
      .eq("school_id", sid)
      .eq("status", "team_approved")
      .order("created_at", { ascending: false }),
    supabase
      .from("substitute_requests")
      .select("*")
      .eq("school_id", sid)
      .eq("status", "pending")
      .order("date"),
    supabase
      .from("activities")
      .select("*")
      .eq("status", "pending")
      .order("activity_date"),
  ]);

  const classes = (classData ?? []) as ClassRoom[];
  // PHT chỉ duyệt trong phạm vi cơ sở phụ trách
  const scopedIds =
    profile.role === "pht" && profile.campus_id
      ? new Set(
          classes
            .filter((c) => c.campus_id === profile.campus_id)
            .map((c) => c.id),
        )
      : null;
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const subjectName = new Map(
    ((subData ?? []) as Subject[]).map((s) => [s.id, s.name]),
  );
  const teacherName = new Map(
    ((profData ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  const plans = ((lpData ?? []) as LessonPlan[]).filter(
    (p) => !scopedIds || scopedIds.has(p.class_id),
  );
  const subs = ((subReqData ?? []) as SubstituteRequest[]).filter(
    (r) => !scopedIds || scopedIds.has(r.class_id),
  );
  const acts = ((actData ?? []) as Activity[]).filter(
    (a) => !scopedIds || scopedIds.has(a.class_id),
  );

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Trung tâm phê duyệt"
        description="Tất cả mục chờ Ban Giám Hiệu quyết định - giáo án đã qua tổ duyệt, điều động dạy thay, kế hoạch hoạt động."
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Giáo án chờ duyệt" value={plans.length} tone={plans.length ? "warning" : "default"} />
        <StatCard label="Điều động chờ duyệt" value={subs.length} tone={subs.length ? "warning" : "default"} />
        <StatCard label="Hoạt động chờ duyệt" value={acts.length} tone={acts.length ? "warning" : "default"} />
      </div>
      <ApprovalsQueue
        lessonPlans={plans.map((p) => ({
          id: p.id,
          title: p.title,
          teacher: teacherName.get(p.teacher_id) ?? "-",
          className: className.get(p.class_id) ?? "-",
          subject: p.subject_id ? (subjectName.get(p.subject_id) ?? "-") : "-",
          week: p.week,
          content: p.content,
        }))}
        substitutes={subs.map((r) => ({
          id: r.id,
          date: r.date,
          period: r.period,
          className: className.get(r.class_id) ?? "-",
          subject: r.subject_id ? (subjectName.get(r.subject_id) ?? "-") : "-",
          absent: teacherName.get(r.absent_teacher_id) ?? "-",
          substitute: r.substitute_teacher_id
            ? (teacherName.get(r.substitute_teacher_id) ?? "-")
            : null,
          reason: r.reason,
        }))}
        activities={acts.map((a) => ({
          id: a.id,
          title: a.title,
          className: className.get(a.class_id) ?? "-",
          date: a.activity_date,
          description: a.description,
        }))}
      />
    </div>
  );
}
