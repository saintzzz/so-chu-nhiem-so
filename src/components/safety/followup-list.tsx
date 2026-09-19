"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge, SEVERITY, FLOW_STATUS } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { followupIncident } from "@/app/(app)/safety/actions";

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const STATUS_OPTIONS: {
  value: "new" | "following" | "resolved" | "archived";
  label: string;
}[] = [
  { value: "new", label: "Mới" },
  { value: "following", label: "Đang theo dõi" },
  { value: "resolved", label: "Đã xử lý" },
  { value: "archived", label: "Lưu trữ" },
];

export interface FollowupIncident {
  id: string;
  occurredAt: string;
  className: string;
  studentName: string;
  type: string;
  severity: keyof typeof SEVERITY;
  status: "new" | "following" | "resolved" | "archived";
  description: string;
}

function FollowupCard({ incident }: { incident: FollowupIncident }) {
  const [status, setStatus] = useState(incident.status);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const sev = SEVERITY[incident.severity];
  const st = FLOW_STATUS[incident.status];

  async function handleSave() {
    setPending(true);
    setFeedback(null);
    const res = await followupIncident(incident.id, { status, note });
    setPending(false);
    if (res.error) {
      setFeedback({ kind: "error", text: res.error });
    } else {
      setFeedback({ kind: "success", text: "Đã cập nhật theo dõi." });
      setNote("");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold">{incident.type}</p>
          <p className="text-xs text-muted-foreground">
            {incident.occurredAt} · Lớp {incident.className} ·{" "}
            {incident.studentName}
          </p>
        </div>
        <div className="flex gap-1.5">
          <StatusBadge label={sev.label} tone={sev.tone} />
          <StatusBadge label={st.label} tone={st.tone} />
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
        {incident.description}
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr_auto] md:items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Trạng thái xử lý
          </label>
          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value as
                  | "new"
                  | "following"
                  | "resolved"
                  | "archived",
              )
            }
            className={INPUT_CLS}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Ghi chú theo dõi mới
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Đã trao đổi với phụ huynh, hẹn gặp lại tuần sau..."
            className={INPUT_CLS}
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={pending || (!note.trim() && status === incident.status)}
        >
          {pending ? "Đang lưu..." : "Cập nhật"}
        </Button>
      </div>
      {feedback && (
        <p
          className={cn(
            "mt-2 rounded-lg px-3 py-2 text-sm",
            feedback.kind === "success"
              ? "bg-success-bg text-success"
              : "bg-error-bg text-error",
          )}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}

export function FollowupList({
  incidents,
}: {
  incidents: FollowupIncident[];
}) {
  if (incidents.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
        Không có sự cố nào đang cần theo dõi.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {incidents.map((i) => (
        <FollowupCard key={i.id} incident={i} />
      ))}
    </div>
  );
}
