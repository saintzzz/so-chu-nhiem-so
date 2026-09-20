"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { AiProgress } from "@/components/ai/ai-progress";
import { useAiJob } from "@/hooks/use-ai-job";
import { cn } from "@/lib/utils";

interface Props<T> {
  endpoint: string;
  /** Payload gửi lên route - phải serializable */
  payload: () => Record<string, unknown>;
  /** Nhận kết quả (đã parse) để điền vào form */
  onApply: (result: T) => void;
  label?: string;
  progressLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Nút "AI soạn nháp" dùng chung: gọi endpoint, nếu route trả pending
 * (fallback bất đồng bộ) thì poll ai_jobs và tự điền khi xong.
 * Người dùng chỉ thấy thanh tiến trình - không thấy chi tiết provider.
 */
export function AiDraftButton<T = unknown>({
  endpoint,
  payload,
  onApply,
  label = "AI soạn nháp",
  progressLabel = "Đang xử lý...",
  disabled,
  className,
}: Props<T>) {
  const job = useAiJob();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  // Kết quả fallback về sau -> tự điền
  useEffect(() => {
    if (job.done && job.result !== null) {
      const r = job.result as T;
      job.reset();
      onApplyRef.current(r);
    } else if (job.failed) {
      job.reset();
      setErr("Không nhận được kết quả. Vui lòng thử lại.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.done, job.failed, job.result]);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const json = (await res.json()) as {
        result?: T | null;
        pending?: boolean;
        jobId?: string;
        devinUrl?: string;
        error?: string;
      };
      if (json.pending && json.jobId && json.devinUrl) {
        job.start(json.jobId, json.devinUrl);
        return;
      }
      if (json.result != null) {
        onApply(json.result);
      } else {
        setErr(json.error ?? "Chưa tạo được nội dung. Vui lòng thử lại.");
      }
    } catch {
      setErr("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = busy || Boolean(job.job);

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={run}
        disabled={disabled || waiting}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary-bg px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
      >
        <Sparkles className="size-3.5" />
        {label}
      </button>
      {waiting && <AiProgress label={progressLabel} />}
      {err && <p className="text-sm text-error">{err}</p>}
    </div>
  );
}
