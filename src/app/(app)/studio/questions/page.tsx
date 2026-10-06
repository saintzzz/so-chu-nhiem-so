import { PageHeader } from "@/components/page-header";
import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Question, Subject } from "@/types/tvc";
import { QuestionBank } from "@/components/tvc/question-bank";

export const dynamic = "force-dynamic";

export default async function StudioQuestionsPage() {
  await requireRoles(["gvcn", "gvbm", "to_truong", "bgh", "admin"]);
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
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        section="Công cụ số giáo viên"
        title="Ngân hàng câu hỏi"
        description="Kho câu hỏi cá nhân - mỗi câu gắn mã yêu cầu cần đạt, dùng để sinh đề theo ma trận (DC-03)"
      />
      <QuestionBank
        initial={qs as unknown as Question[]}
        subjects={(subs as Subject[]) ?? []}
        total={qCount ?? qs.length}
      />
    </div>
  );
}
