import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { LessonPlanBoard } from "@/components/academics/lesson-plan-board";
import type { ClassRoom, LessonPlan, Subject } from "@/types";

export default async function LessonPlansPage() {
  const profile = await requireRoles(["gvbm", "gvcn"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  // CR-035/R16: moi query nguon phu bat error - doc loi ma render "chua co
  // gi" + form nộp se gay hieu lam. lesson_plans phan trang de khong bi
  // PostgREST cat ngam (~1000 rows).
  const [classRes, subRes, planRes] = await Promise.all([
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
    fetchAllRows<LessonPlan>(
      (f, t) =>
        supabase
          .from("lesson_plans")
          .select("*")
          .eq("teacher_id", profile.id)
          .order("created_at", { ascending: false })
          .range(f, t),
      1000,
      300,
    ),
  ]);

  const srcErrors = Object.entries({
    classes: classRes.error,
    subjects: subRes.error,
    lesson_plans: planRes.error,
  }).filter(([, e]) => e);
  const loadError = srcErrors.length > 0;
  if (loadError) {
    console.error(
      "[academics/lesson-plans] load:",
      srcErrors.map(([k, e]) => `${k}: ${e}`).join("; "),
    );
  }

  return (
    <div>
      <PageHeader
        section="Học tập"
        title="Giáo án / Kế hoạch bài dạy"
        description="Soạn và nộp giáo án - tổ chuyên môn duyệt trước, Ban Giám Hiệu phê duyệt cuối."
      />
      {loadError ? (
        <p className="rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error">
          Không tải được dữ liệu. Vui lòng thử lại.
        </p>
      ) : (
        <>
          {planRes.truncated && (
            <p className="mb-3 text-xs text-muted-foreground">
              Chỉ hiển thị 300 giáo án mới nhất.
            </p>
          )}
          <LessonPlanBoard
          mode="teacher"
          schoolId={sid}
          classes={classRes.rows.map((c) => ({ id: c.id, name: c.name }))}
          subjects={subRes.rows.map((s) => ({ id: s.id, name: s.name }))}
          plans={planRes.rows.map((p) => ({
            id: p.id,
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
          teacherNames={{}}
          />
        </>
      )}
    </div>
  );
}
