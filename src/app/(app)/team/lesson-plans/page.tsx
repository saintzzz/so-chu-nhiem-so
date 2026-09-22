import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LessonPlanBoard } from "@/components/academics/lesson-plan-board";
import type { ClassRoom, LessonPlan, Profile, Subject } from "@/types";

export default async function TeamLessonPlansPage() {
  const profile = await requireRoles(["to_truong"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [
    { data: classData },
    { data: subData },
    { data: planData },
    { data: profData },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .eq("school_id", sid)
      .eq("status", "active")
      .order("name"),
    supabase.from("subjects").select("*").eq("school_id", sid).order("name"),
    supabase
      .from("lesson_plans")
      .select("*")
      .eq("school_id", sid)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("profiles")
      .select("id,full_name")
      .eq("school_id", sid),
  ]);

  const teacherNames = Object.fromEntries(
    ((profData ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  return (
    <div>
      <PageHeader
        section="Tổ chuyên môn"
        title="Duyệt giáo án"
        description="Giáo án giáo viên nộp - tổ duyệt xong chuyển Ban Giám Hiệu phê duyệt cuối."
      />
      <LessonPlanBoard
        mode="team"
        schoolId={sid}
        classes={((classData ?? []) as ClassRoom[]).map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        subjects={((subData ?? []) as Subject[]).map((s) => ({
          id: s.id,
          name: s.name,
        }))}
        plans={((planData ?? []) as LessonPlan[]).map((p) => ({
          id: p.id,
          teacher_id: p.teacher_id,
          class_id: p.class_id,
          subject_id: p.subject_id,
          week: p.week,
          periods: p.periods,
          title: p.title,
          content: p.content,
          file_path: p.file_path,
          file_name: p.file_name,
          status: p.status,
          review_note: p.review_note,
          created_at: p.created_at,
        }))}
        teacherNames={teacherNames}
      />
    </div>
  );
}
