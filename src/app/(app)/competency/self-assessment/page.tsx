import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, FLOW_STATUS } from "@/components/status-badge";
import { SelfAssessmentForm } from "@/components/competency/self-assessment-form";

interface YearRow {
  id: string;
  name: string;
}

interface AssessmentRow {
  id: string;
  self_review: string | null;
  plan: string | null;
  status: string;
}

const ASSESSMENT_STATUS: Record<
  string,
  { label: string; tone: "muted" | "warning" | "primary" | "success" }
> = {
  draft: { label: "Nháp", tone: "muted" },
  submitted: FLOW_STATUS.submitted,
  reviewed: FLOW_STATUS.reviewed,
  approved: FLOW_STATUS.approved,
};

export default async function SelfAssessmentPage() {
  const profile = await requireRoles(["gvcn"]);
  const supabase = await createClient();

  const { data: yearRaw } = await supabase
    .from("academic_years")
    .select("id,name")
    .eq("school_id", profile.school_id)
    .eq("is_current", true)
    .maybeSingle();
  const year = (yearRaw ?? null) as YearRow | null;

  const { data: assessRaw } = year
    ? await supabase
        .from("teacher_assessments")
        .select("id,self_review,plan,status")
        .eq("teacher_id", profile.id)
        .eq("academic_year_id", year.id)
        .maybeSingle()
    : { data: null };
  const assessment = (assessRaw ?? null) as AssessmentRow | null;
  const status = ASSESSMENT_STATUS[assessment?.status ?? "draft"] ??
    ASSESSMENT_STATUS.draft;

  return (
    <>
      <PageHeader
        section="Năng lực giáo viên chủ nhiệm"
        title="Tự đánh giá & kế hoạch"
        description={
          year
            ? `Đánh giá năng lực chủ nhiệm năm học ${year.name}`
            : "Chưa có năm học hiện tại"
        }
        actions={<StatusBadge label={status.label} tone={status.tone} />}
      />

      {!year ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không tìm thấy năm học đang hoạt động.
        </div>
      ) : (
        <div className="max-w-3xl rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm-token)]">
          <SelfAssessmentForm
            teacherId={profile.id}
            yearId={year.id}
            assessmentId={assessment?.id ?? null}
            initialReview={assessment?.self_review ?? ""}
            initialPlan={assessment?.plan ?? ""}
            status={assessment?.status ?? "draft"}
          />
        </div>
      )}
    </>
  );
}
