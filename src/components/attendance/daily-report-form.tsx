"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, Send, Save } from "lucide-react";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { StatusBadge } from "@/components/status-badge";
import { useAiJob } from "@/hooks/use-ai-job";
import { saveDailyReport } from "@/app/(app)/attendance/daily-report/actions";

interface Counts {
  total: number;
  absent: number;
  late: number;
  violations: number;
  commendations: number;
}

export function DailyReportForm({
  classId,
  className,
  date,
  counts,
  report,
}: {
  classId: string;
  className: string;
  date: string;
  counts: Counts;
  report: {
    content: string;
    status: "draft" | "submitted";
    submitted_at: string | null;
  } | null;
}) {
  const [content, setContent] = useState(report?.content ?? "");
  const [status, setStatus] = useState(report?.status ?? "draft");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [aiLoading, setAiLoading] = useState(false);
  const aiJob = useAiJob();

  // Kết quả Devin fallback về sau qua ai_jobs -> tự điền vào nội dung
  useEffect(() => {
    if (!aiJob.done || !aiJob.result) return;
    const obj = aiJob.result as { draft?: string };
    if (obj.draft?.trim()) {
      setContent(obj.draft.trim());
      setMsg("AI dự phòng đã soạn xong nháp.");
    }
    aiJob.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiJob.done, aiJob.result]);

  const chips: { label: string; value: number }[] = [
    { label: "Sĩ số", value: counts.total },
    { label: "Vắng", value: counts.absent },
    { label: "Đi muộn", value: counts.late },
    { label: "Vi phạm", value: counts.violations },
    { label: "Khen thưởng", value: counts.commendations },
  ];

  async function aiDraft() {
    setAiLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/ai/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, date }),
      });
      const json = (await res.json()) as {
        draft?: string;
        pending?: boolean;
        jobId?: string;
        devinUrl?: string;
        error?: string;
      };
      if (json.draft) setContent(json.draft);
      else if (json.pending && json.jobId && json.devinUrl) {
        aiJob.start(json.jobId, json.devinUrl);
        setMsg("AI chính đang bận - hệ thống dự phòng đang soạn, sẽ tự điền khi xong.");
      } else setErr(json.error ?? "AI chưa tạo được nháp. Thử lại sau.");
    } catch {
      setErr("Không kết nối được AI. Thử lại sau.");
    } finally {
      setAiLoading(false);
    }
  }

  function save(submit: boolean) {
    start(async () => {
      setErr(null);
      setMsg(null);
      const r = await saveDailyReport({
        classId,
        date,
        content,
        absentCount: counts.absent,
        lateCount: counts.late,
        violationCount: counts.violations,
        commendationCount: counts.commendations,
        submit,
      });
      if (r.error) setErr(r.error);
      else {
        setMsg(submit ? "Đã gửi báo cáo cho Ban Giám Hiệu." : "Đã lưu nháp.");
        if (submit) setStatus("submitted");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <span
            key={c.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm"
          >
            <span className="text-muted-foreground">{c.label}</span>
            <span className="font-semibold">{c.value}</span>
          </span>
        ))}
        <StatusBadge
          label={status === "submitted" ? "Đã gửi BGH" : "Nháp"}
          tone={status === "submitted" ? "success" : "muted"}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium">Nội dung báo cáo</label>
          <button
            type="button"
            onClick={aiDraft}
            disabled={aiLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary-bg disabled:opacity-50"
          >
            <Sparkles className="size-3.5" />
            {aiLoading ? "AI đang soạn..." : "AI soạn nháp"}
          </button>
        </div>
        <AutoGrowTextarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Tình hình lớp hôm nay, việc cần BGH biết hoặc hỗ trợ..."
          rows={5}
        />
      </div>

      {err && (
        <p className="rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-lg border border-success/30 bg-success-bg px-3 py-2 text-sm text-success">
          {msg}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={pending || status === "submitted"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Save className="size-4" /> Lưu nháp
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={pending || !content.trim() || status === "submitted"}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
        >
          <Send className="size-4" />
          {status === "submitted" ? "Đã gửi" : "Gửi Ban Giám Hiệu"}
        </button>
      </div>
      {status === "submitted" && (
        <p className="text-xs text-muted-foreground">
          Báo cáo lớp {className} đã gửi. Liên hệ BGH nếu cần chỉnh sửa.
        </p>
      )}
    </div>
  );
}
