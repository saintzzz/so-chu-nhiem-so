import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
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

  // CR-035/R16: bat moi loi doc nguon. activities khong co school_id nen
  // phai scope theo class_ids cua truong (doc sau khi co danh sach lop).
  const [classRes, subRes, profRes, lpRes, subReqRes] = await Promise.all([
    fetchAllRows<ClassRoom>((f, t) =>
      supabase
        .from("classes")
        .select("*")
        .eq("school_id", sid)
        .eq("status", "active")
        .order("name")
        .range(f, t),
    ),
    fetchAllRows<Subject>((f, t) =>
      supabase
        .from("subjects")
        .select("*")
        .eq("school_id", sid)
        .order("name")
        .range(f, t),
    ),
    fetchAllRows<Pick<Profile, "id" | "full_name">>((f, t) =>
      supabase
        .from("profiles")
        .select("id,full_name")
        .eq("school_id", sid)
        .order("full_name")
        .range(f, t),
    ),
    fetchAllRows<LessonPlan>((f, t) =>
      supabase
        .from("lesson_plans")
        .select("*")
        .eq("school_id", sid)
        .eq("status", "team_approved")
        .order("created_at", { ascending: false })
        .range(f, t),
    ),
    fetchAllRows<SubstituteRequest>((f, t) =>
      supabase
        .from("substitute_requests")
        .select("*")
        .eq("school_id", sid)
        .eq("status", "pending")
        .order("date")
        .range(f, t),
    ),
  ]);

  const classes = classRes.rows;
  const classIds = classes.map((c) => c.id);
  const actRes = classIds.length
    ? await fetchAllRows<Activity>((f, t) =>
        supabase
          .from("activities")
          .select("*")
          .in("class_id", classIds)
          .eq("status", "pending")
          .order("activity_date")
          .range(f, t),
      )
    : { rows: [], error: null, truncated: false };

  const srcErrors = Object.entries({
    classes: classRes.error,
    subjects: subRes.error,
    profiles: profRes.error,
    lesson_plans: lpRes.error ?? (lpRes.truncated ? "truncated" : null),
    substitute_requests:
      subReqRes.error ?? (subReqRes.truncated ? "truncated" : null),
    activities: actRes.error ?? (actRes.truncated ? "truncated" : null),
  }).filter(([, e]) => e);
  const loadError = srcErrors.length > 0;
  if (loadError) {
    console.error(
      "[school/approvals] load:",
      srcErrors.map(([k, e]) => `${k}: ${e}`).join("; "),
    );
  }

  // PHT chỉ duyệt trong phạm vi cơ sở phụ trách; chưa gán campus -> fail-closed.
  const scopedIds =
    profile.role === "pht"
      ? new Set(
          classes
            .filter(
              (c) => profile.campus_id && c.campus_id === profile.campus_id,
            )
            .map((c) => c.id),
        )
      : null;
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const subjectName = new Map(subRes.rows.map((s) => [s.id, s.name]));
  const teacherName = new Map(profRes.rows.map((p) => [p.id, p.full_name]));

  const plans = lpRes.rows.filter(
    (p) => !scopedIds || scopedIds.has(p.class_id),
  );
  const subs = subReqRes.rows.filter(
    (r) => !scopedIds || scopedIds.has(r.class_id),
  );
  const acts = actRes.rows.filter(
    (a) => !scopedIds || scopedIds.has(a.class_id),
  );

  return (
    <div>
      <PageHeader
        section="Quản trị"
        title="Trung tâm phê duyệt"
        description="Tất cả mục chờ Ban Giám Hiệu quyết định - giáo án đã qua tổ duyệt, điều động dạy thay, kế hoạch hoạt động."
      />
      {loadError ? (
        <p className="rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error">
          Không tải được dữ liệu. Vui lòng thử lại.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <StatCard
              label="Giáo án chờ duyệt"
              value={plans.length}
              tone={plans.length ? "warning" : "default"}
            />
            <StatCard
              label="Điều động chờ duyệt"
              value={subs.length}
              tone={subs.length ? "warning" : "default"}
            />
            <StatCard
              label="Hoạt động chờ duyệt"
              value={acts.length}
              tone={acts.length ? "warning" : "default"}
            />
          </div>
          <ApprovalsQueue
            lessonPlans={plans.map((p) => ({
              id: p.id,
              title: p.title,
              teacher: teacherName.get(p.teacher_id) ?? "-",
              className: className.get(p.class_id) ?? "-",
              subject: p.subject_id
                ? (subjectName.get(p.subject_id) ?? "-")
                : "-",
              week: p.week,
              content: p.content,
              content_json: p.content_json,
            }))}
            substitutes={subs.map((r) => ({
              id: r.id,
              date: r.date,
              period: r.period,
              className: className.get(r.class_id) ?? "-",
              subject: r.subject_id
                ? (subjectName.get(r.subject_id) ?? "-")
                : "-",
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
        </>
      )}
    </div>
  );
}
