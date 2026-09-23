"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AiProgress } from "@/components/ai/ai-progress";
import { useAiJob } from "@/hooks/use-ai-job";

interface Props {
  endpoint: string;
  /** Payload gửi lên route - phải serializable (plain object, vì có thể
   *  được truyền từ Server Component) */
  payload: Record<string, unknown>;
  title: string;
  buttonLabel?: string;
  progressLabel?: string;
  disclaimer?: string;
}

interface InsightResult {
  lines?: string[];
  text?: string;
}

/**
 * Card "Phân tích AI" dùng chung cho các màn hình chỉ-đọc:
 * bấm nút -> progress -> hiện danh sách nhận xét/gợi ý.
 */
export function AiInsightCard({
  endpoint,
  payload,
  title,
  buttonLabel = "Phân tích AI",
  progressLabel = "Đang phân tích dữ liệu...",
  disclaimer = "Nội dung do AI tạo từ số liệu thật - chỉ mang tính tham khảo.",
}: Props) {
  const job = useAiJob();
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (job.done && job.result !== null) {
      const r = job.result as InsightResult;
      job.reset();
      applyResult(r);
    } else if (job.failed) {
      job.reset();
      setErr("Không nhận được kết quả. Vui lòng thử lại.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.done, job.failed, job.result]);

  function stripMd(l: string) {
    return l
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/^[\s\-*•#>\d.)\]]+/, "")
      .trim();
  }

  function applyResult(r: InsightResult) {
    const ls =
      r.lines?.map(stripMd).filter(Boolean) ??
      (r.text
        ? r.text
            .split(/\n+/)
            .map(stripMd)
            .filter(Boolean)
        : null);
    setLines(ls && ls.length ? ls : null);
    if (!ls?.length) setErr("Chưa tạo được phân tích. Vui lòng thử lại.");
  }

  async function run() {
    setBusy(true);
    setErr(null);
    setLines(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        result?: InsightResult | null;
        pending?: boolean;
        jobId?: string;
        devinUrl?: string;
        error?: string;
      };
      if (json.pending && json.jobId && json.devinUrl) {
        job.start(json.jobId, json.devinUrl);
        return;
      }
      if (json.result) applyResult(json.result);
      else setErr(json.error ?? "Chưa tạo được phân tích. Vui lòng thử lại.");
    } catch {
      setErr("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = busy || Boolean(job.job);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary-bg p-4 shadow-[var(--shadow-sm-token)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-primary">{title}</h2>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={waiting}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {buttonLabel}
        </button>
      </div>
      {waiting && <AiProgress label={progressLabel} />}
      {lines && (
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      {err && <p className="text-sm text-error">{err}</p>}
      {!waiting && !lines && !err && (
        <p className="text-sm text-muted-foreground">
          Bấm nút để AI phân tích dữ liệu hiện có trên màn hình này.
        </p>
      )}
      {lines && (
        <p className="mt-3 text-xs text-muted-foreground">{disclaimer}</p>
      )}
    </div>
  );
}
