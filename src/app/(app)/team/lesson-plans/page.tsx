import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { LessonPlanBoard } from "@/components/academics/lesson-plan-board";
import type { ClassRoom, LessonPlan, Profile, Subject } from "@/types";

export default async function TeamLessonPlansPage() {
  const profile = await requireRoles(["to_truong"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  // CR-035/R16: bat moi loi doc nguon - nguoi duyet khong duoc thay danh
  // sach rong khi query that bai hoac bi cat ngam.
  const [classRes, subRes, planRes, profRes] = await Promise.all([
    fetchAllRows<Pick<ClassRoom, "id" | "name">>((f, t) =>
      supabase
        .from("classes")
        .select("id,name")
        .eq("school_id", sid)
        .eq("status", "active")
        .order("name")
        .range(f, t),
    ),
    fetchAllRows<Pick<Subject, "id" | "name">>((f, t) =>
      supabase
        .from("subjects")
        .select("id,name")
        .eq("school_id", sid)
        .order("name")
        .range(f, t),
    ),
    fetchAllRows<LessonPlan>((f, t) =>
      supabase
        .from("lesson_plans")
        .select("*")
        .eq("school_id", sid)
        .order("created_at", { ascending: false })
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
  ]);

  const srcErrors = Object.entries({
    classes: classRes.error,
    subjects: subRes.error,
    lesson_plans: planRes.error ?? (planRes.truncated ? "truncated" : null),
    profiles: profRes.error ?? (profRes.truncated ? "truncated" : null),
  }).filter(([, e]) => e);
  const loadError = srcErrors.length > 0;
  if (loadError) {
    console.error(
      "[team/lesson-plans] load:",
      srcErrors.map(([k, e]) => `${k}: ${e}`).join("; "),
    );
  }

  const teacherNames = Object.fromEntries(
    profRes.rows.map((p) => [p.id, p.full_name]),
  );

  return (
    <div>
      <PageHeader
        section="Tổ chuyên môn"
        title="Duyệt giáo án"
        description="Giáo án giáo viên nộp - tổ duyệt xong chuyển Ban Giám Hiệu phê duyệt cuối."
      />
      {loadError ? (
        <p className="rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error">
          Không tải được dữ liệu. Vui lòng thử lại.
        </p>
      ) : (
        <LessonPlanBoard
          mode="team"
          schoolId={sid}
          classes={classRes.rows.map((c) => ({ id: c.id, name: c.name }))}
          subjects={subRes.rows.map((s) => ({ id: s.id, name: s.name }))}
          plans={planRes.rows.map((p) => ({
            id: p.id,
            teacher_id: p.teacher_id,
            class_id: p.class_id,
            subject_id: p.subject_id,
            week: p.week,
            periods: p.periods,
            title: p.title,
            content: p.content,
            content_json: p.content_json,
            file_path: p.file_path,
            file_name: p.file_name,
            status: p.status,
            review_note: p.review_note,
            created_at: p.created_at,
          }))}
          teacherNames={teacherNames}
        />
      )}
    </div>
  );
}
