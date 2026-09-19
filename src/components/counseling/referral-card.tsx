"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge, SEVERITY, FLOW_STATUS } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

type Severity = keyof typeof SEVERITY;
type FlowStatus = keyof typeof FLOW_STATUS;

/** Card for a counseling case that may need referral to a specialist. */
export function ReferralCard({
  caseId,
  studentName,
  issue,
  severity,
  status,
  referral,
  notes,
}: {
  caseId: string;
  studentName: string;
  issue: string;
  severity: Severity;
  status: FlowStatus;
  referral: string | null;
  notes: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(referral ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(patch: { referral?: string; status?: string }) {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("counseling_cases")
        .update(patch)
        .eq("id", caseId);
      if (err) {
        setError(err.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const sev = SEVERITY[severity] ?? { label: severity, tone: "muted" as const };
  const st = FLOW_STATUS[status] ?? { label: status, tone: "muted" as const };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{studentName}</p>
          <p className="text-sm text-muted-foreground">{issue}</p>
        </div>
        <div className="flex gap-2">
          <StatusBadge label={sev.label} tone={sev.tone} />
          <StatusBadge label={st.label} tone={st.tone} />
        </div>
      </div>
      {notes && (
        <p className="mb-2 text-xs text-muted-foreground">Ghi chú: {notes}</p>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Chuyển tuyến đến (chuyên gia / cơ sở y tế / phòng tham vấn)
        <AutoGrowTextarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="VD: Chuyển đến chuyên viên tâm lý Phòng Tư vấn Sở GD&ĐT…"
          className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !text.trim()}
          onClick={() => update({ referral: text.trim(), status: "referred" })}
        >
          {pending ? "Đang lưu…" : "Lưu & chuyển tuyến"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => update({ status: "resolved" })}
        >
          Đánh dấu đã xử lý
        </Button>
        {saved && <span className="text-sm text-success">Đã lưu.</span>}
        {error && <span className="text-sm text-error">{error}</span>}
      </div>
    </div>
  );
}
