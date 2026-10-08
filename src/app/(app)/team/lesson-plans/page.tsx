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
  // Codex R1-P1: khong do ca lich su (content_json nang) vao bang client.
  // Giao an `submitted` doc day du vi la queue can xu ly; lich su con lai
  // cap 300 dong moi nhat + hien note khi bi cat.
  const [classRes, subRes, pendRes, profRes] = await Promise.all([
    fetchAllRows<Pick<ClassRoom, "id" | "name">>((f, t) =>
      supabase
        .from("classes")
        .select("id,name")
        .eq("school_id", sid)
        .eq("status", "active")
        .order("name")
        .order("id")
        .range(f, t),
    ),
    fetchAllRows<Pick<Subject, "id" | "name">>((f, t) =>
      supabase
        .from("subjects")
        .select("id,name")
        .eq("school_id", sid)
        .order("name")
        .order("id")
        .range(f, t),
    ),
    fetchAllRows<LessonPlan>((f, t) =>
      supabase
        .from("lesson_plans")
        .select("*")
        .eq("school_id", sid)
        .eq("status", "submitted")
        .order("created_at", { ascending: false })
        .order("id")
        .range(f, t),
    ),
    fetchAllRows<Pick<Profile, "id" | "full_name">>((f, t) =>
      supabase
        .from("profiles")
        .select("id,full_name")
        .eq("school_id", sid)
        .order("full_name")
        .order("id")
        .range(f, t),
    ),
  ]);
  const histRes = await fetchAllRows<LessonPlan>(
    (f, t) =>
      supabase
        .from("lesson_plans")
        .select("*")
        .eq("school_id", sid)
        .neq("status", "submitted")
        .order("created_at", { ascending: false })
        .order("id")
        .range(f, t),
    1000,
    300,
  );

  const srcErrors = Object.entries({
    classes: classRes.error,
    subjects: subRes.error,
    lesson_plans_pending: pendRes.error,
    lesson_plans_history: histRes.error,
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
  // Codex R6: plan co the chuyen status giua 2 query (pend truoc, hist sau)
  // -> xuat hien o ca hai. Hist la doc sau nen trang thai moi hon - bo
  // id trung phia pend.
  const histIds = new Set(histRes.rows.map((p) => p.id));
  const plans = [
    ...pendRes.rows.filter((p) => !histIds.has(p.id)),
    ...histRes.rows,
  ];

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
        <>
          {histRes.truncated && (
            <p className="mb-3 text-xs text-muted-foreground">
              Chỉ hiển thị 300 giáo án đã xử lý mới nhất - giáo án chờ duyệt
              luôn hiển thị đầy đủ.
            </p>
          )}
          <LessonPlanBoard
            mode="team"
            schoolId={sid}
            classes={classRes.rows.map((c) => ({ id: c.id, name: c.name }))}
            subjects={subRes.rows.map((s) => ({ id: s.id, name: s.name }))}
            plans={plans.map((p) => ({
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
        </>
      )}
    </div>
  );
}
