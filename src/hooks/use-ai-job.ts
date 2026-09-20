"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AiJobState {
  jobId: string;
  devinUrl: string;
}

/**
 * Poll ai_jobs (fallback Devin khi LLM provider hết quota).
 * start(jobId, devinUrl) sau khi API trả về {pending:true};
 * result chứa JSON khi Devin POST kết quả về callback.
 */
export function useAiJob() {
  const [job, setJob] = useState<AiJobState | null>(null);
  const [result, setResult] = useState<unknown | null>(null);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  function start(jobId: string, devinUrl: string) {
    setJob({ jobId, devinUrl });
    setResult(null);
    setDone(false);
    setFailed(false);
  }

  function reset() {
    setJob(null);
    setResult(null);
    setDone(false);
    setFailed(false);
  }

  useEffect(() => {
    if (!job) return;
    const supabase = createClient();
    let stopped = false;

    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("ai_jobs")
        .select("status,result")
        .eq("id", job.jobId)
        .single();
      const row = data as { status?: string; result?: unknown } | null;
      if (!row || stopped) return;
      if (row.status === "done") {
        setResult(row.result ?? null);
        setDone(true);
        stopped = true;
        clearInterval(timer);
      } else if (row.status === "failed") {
        setFailed(true);
        stopped = true;
        clearInterval(timer);
      }
    }, 3000);

    // Devin session có thể chạy lâu - dừng poll sau 15 phút (link vẫn mở được)
    const cap = setTimeout(() => {
      stopped = true;
      clearInterval(timer);
    }, 15 * 60 * 1000);

    return () => {
      stopped = true;
      clearInterval(timer);
      clearTimeout(cap);
    };
  }, [job]);

  return { job, result, done, failed, start, reset };
}
