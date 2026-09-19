import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, FLOW_STATUS } from "@/components/status-badge";
import { DataTable } from "@/components/data-table";
import { EvidenceForm } from "@/components/competency/evidence-form";

interface YearRow {
  id: string;
  name: string;
}

interface AssessmentRow {
  id: string;
  status: string;
}

interface EvidenceRow {
  id: string;
  title: string;
  url: string | null;
  note: string | null;
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

export default async function EvidencePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: yearRaw } = await supabase
    .from("academic_years")
    .select("id,name")
    .eq("is_current", true)
    .maybeSingle();
  const year = (yearRaw ?? null) as YearRow | null;

  const { data: assessRaw } = year
    ? await supabase
        .from("teacher_assessments")
        .select("id,status")
        .eq("teacher_id", profile.id)
        .eq("academic_year_id", year.id)
        .maybeSingle()
    : { data: null };
  const assessment = (assessRaw ?? null) as AssessmentRow | null;

  const { data: evRaw } = assessment
    ? await supabase
        .from("assessment_evidence")
        .select("id,title,url,note")
        .eq("assessment_id", assessment.id)
    : { data: [] };
  const evidence = (evRaw ?? []) as EvidenceRow[];
  const status = ASSESSMENT_STATUS[assessment?.status ?? "draft"] ??
    ASSESSMENT_STATUS.draft;

  return (
    <>
      <PageHeader
        section="Phân hệ XII - Năng lực GVCN"
        title="Minh chứng & đánh giá cuối năm"
        description={
          year
            ? `Minh chứng đánh giá năng lực năm học ${year.name}`
            : "Chưa có năm học hiện tại"
        }
        actions={<StatusBadge label={status.label} tone={status.tone} />}
      />

      {!assessment ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Bạn chưa có bản tự đánh giá năng lực cho năm học này.{" "}
          <Link
            href="/competency/self-assessment"
            className="font-medium text-primary hover:underline"
          >
            Tạo đánh giá trước
          </Link>{" "}
          để đính kèm minh chứng.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DataTable
              columns={["Minh chứng", "Liên kết", "Ghi chú", "Trạng thái"]}
              footer={<span>{evidence.length} minh chứng</span>}
            >
              {evidence.map((e) => (
                <tr key={e.id}>
                  <td className="font-medium">{e.title}</td>
                  <td>
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Xem
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="max-w-64 truncate text-muted-foreground">
                    {e.note ?? "-"}
                  </td>
                  <td>
                    <StatusBadge label={status.label} tone={status.tone} />
                  </td>
                </tr>
              ))}
              {evidence.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Chưa có minh chứng nào. Thêm minh chứng ở form bên cạnh.
                  </td>
                </tr>
              )}
            </DataTable>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
            <h3 className="mb-3 text-base font-semibold">Thêm minh chứng</h3>
            <EvidenceForm assessmentId={assessment.id} />
          </div>
        </div>
      )}
    </>
  );
}
