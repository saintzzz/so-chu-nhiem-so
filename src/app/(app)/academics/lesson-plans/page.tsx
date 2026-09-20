import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LessonPlanBoard } from "@/components/academics/lesson-plan-board";
import type { ClassRoom, LessonPlan, Subject } from "@/types";

export default async function LessonPlansPage() {
  const profile = await requireRoles(["gvbm", "gvcn"]);
  const supabase = await createClient();
  const sid = profile.school_id ?? "";

  const [{ data: classData }, { data: subData }, { data: planData }] =
    await Promise.all([
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
        .eq("teacher_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  return (
    <div>
      <PageHeader
        section="Học tập"
        title="Giáo án / Kế hoạch bài dạy"
        description="Soạn và nộp giáo án - tổ chuyên môn duyệt trước, Ban Giám Hiệu phê duyệt cuối."
      />
      <LessonPlanBoard
        mode="teacher"
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
          class_id: p.class_id,
          subject_id: p.subject_id,
          week: p.week,
          periods: p.periods,
          title: p.title,
          content: p.content,
          status: p.status,
          review_note: p.review_note,
          created_at: p.created_at,
        }))}
        teacherNames={{}}
      />
    </div>
  );
}
