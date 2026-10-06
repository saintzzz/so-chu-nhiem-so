import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { requireFeature } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Question, Subject } from "@/types/tvc";
import { QuestionBank } from "@/components/tvc/question-bank";
import { subjectNameToCode } from "@/lib/tvc/subject-code";

export const dynamic = "force-dynamic";

export default async function StudioQuestionsPage() {
  const profile = await requireRoles(["gvcn", "gvbm", "to_truong", "bgh", "admin"]);
  await requireFeature("studio");
  const supabase = await createClient();
  const [{ data: subs }, { count: qCount }, { data: firstRows }] =
    await Promise.all([
      supabase.from("tvc_subjects").select("*").order("code"),
      supabase
        .from("tvc_questions")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("tvc_questions")
        .select(
          "id, owner_id, code, stem, qtype, level, points, standard_ids, subject_code, grade, source, review_state, created_at",
        )
        .order("created_at", { ascending: false })
        .range(0, 99),
    ]);
  const qs = firstRows ?? [];

  // CR-032: mon cua to chuyen mon -> to truong loc "Mon cua to toi"
  let deptSubjectCodes: string[] = [];
  if (profile.department_id) {
    const { data: dept } = await supabase
      .from("departments")
      .select("subject_ids")
      .eq("id", profile.department_id)
      .single();
    const sids = (dept?.subject_ids as string[] | null) ?? [];
    if (sids.length) {
      const { data: subs2 } = await supabase
        .from("subjects")
        .select("name")
        .in("id", sids);
      deptSubjectCodes = (subs2 ?? [])
        .map((s) => subjectNameToCode(s.name))
        .filter((c): c is string => !!c);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        section="Công cụ số giáo viên"
        title="Ngân hàng câu hỏi"
        description="Ngân hàng câu hỏi chung của trường - GV đóng góp, tổ trưởng/BGH duyệt; dùng để sinh đề theo ma trận (DC-03)"
      />
      <QuestionBank
        initial={qs as unknown as Question[]}
        subjects={(subs as Subject[]) ?? []}
        total={qCount ?? qs.length}
        meId={profile.id}
        isReviewer={["to_truong", "bgh", "admin"].includes(profile.role)}
        isAdmin={["bgh", "admin"].includes(profile.role)}
        schoolId={profile.school_id ?? undefined}
        deptSubjectCodes={deptSubjectCodes}
      />
    </div>
  );
}
