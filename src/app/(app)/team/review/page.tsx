import { requireRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, FLOW_STATUS } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { approveAssessment } from "./actions";
import type { Profile } from "@/types";

type AssessmentStatus = "draft" | "submitted" | "reviewed" | "approved";

interface TeacherAssessment {
  id: string;
  teacher_id: string;
  self_review: string | null;
  plan: string | null;
  status: AssessmentStatus;
}

const STATUS_META: Record<
  AssessmentStatus,
  { label: string; tone: "muted" | "primary" | "warning" | "success" }
> = {
  draft: { label: "Nháp", tone: "muted" },
  submitted: { label: "Đã nộp", tone: "primary" },
  reviewed: { label: "Đã xem xét", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "success" },
};

export default async function TeamReviewPage() {
  const profile = await requireRoles(["to_truong"]);
  const supabase = await createClient();

  const { data: teacherRows } = await supabase
    .from("profiles")
    .select("id,full_name")
    .eq("department_id", profile.department_id ?? "")
    .in("role", ["gvcn", "gvbm", "to_truong"]);
  const teachers = (teacherRows ?? []) as Pick<Profile, "id" | "full_name">[];
  const teacherIds = teachers.map((t) => t.id);
  const teacherNameOf = new Map(teachers.map((t) => [t.id, t.full_name]));

  const { data: rows } = teacherIds.length
    ? await supabase
        .from("teacher_assessments")
        .select("id,teacher_id,self_review,plan,status")
        .in("teacher_id", teacherIds)
        .neq("status", "draft")
    : { data: [] };
  const assessments = (rows ?? []) as TeacherAssessment[];
  const order: Record<AssessmentStatus, number> = {
    submitted: 0,
    reviewed: 1,
    approved: 2,
    draft: 3,
  };
  assessments.sort((a, b) => order[a.status] - order[b.status]);

  return (
    <>
      <PageHeader
        section="Tổ chuyên môn"
        title="Duyệt đánh giá năng lực"
        description="Xem xét và phê duyệt đánh giá năng lực của giáo viên trong tổ"
      />

      {assessments.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Chưa có đánh giá năng lực nào được nộp.
        </p>
      ) : (
        <div className="space-y-4">
          {assessments.map((a) => {
            const meta = STATUS_META[a.status] ?? FLOW_STATUS.draft;
            const canApprove = a.status === "submitted" || a.status === "reviewed";
            return (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">
                      {teacherNameOf.get(a.teacher_id) ?? "Giáo viên"}
                    </h3>
                    <StatusBadge label={meta.label} tone={meta.tone} />
                  </div>
                  {canApprove && (
                    <form action={approveAssessment.bind(null, a.id)}>
                      <Button type="submit" size="sm">
                        Duyệt
                      </Button>
                    </form>
                  )}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-muted/60 p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Tự đánh giá
                    </p>
                    <p className="whitespace-pre-line text-sm">
                      {a.self_review || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Kế hoạch phát triển
                    </p>
                    <p className="whitespace-pre-line text-sm">
                      {a.plan || "—"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
