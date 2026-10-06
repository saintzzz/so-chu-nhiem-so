"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AiJobState {
  jobId: string;
  sessionUrl: string;
}

interface AiJobHandlers {
  onDone?: (result: unknown) => void;
  onFail?: () => void;
}

/**
 * Poll ai_jobs (fallback engine khi LLM provider hết quota) - module studio.
 * start(jobId, sessionUrl, handlers) sau khi API trả về {pending:true};
 * onDone(result) chạy khi engine POST kết quả về /api/ai/devin-callback.
 *
 * CR-033: exponential backoff 2s -> 4s -> 6s ... cap 20s thay vi poll
 * co dinh 3s - giam tai PostgREST khi nhieu GV cho job cung luc.
 */
export function useTvcAiJob() {
  const [job, setJob] = useState<AiJobState | null>(null);
  const handlers = useRef<AiJobHandlers>({});

  function start(jobId: string, sessionUrl: string, h: AiJobHandlers = {}) {
    handlers.current = h;
    setJob({ jobId, sessionUrl });
  }

  function reset() {
    setJob(null);
    handlers.current = {};
  }

  useEffect(() => {
    if (!job) return;
    const supabase = createClient();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = 2000;
    const MAX_DELAY = 20000;

    const finish = (fn: () => void) => {
      if (stopped) return;
      stopped = true;
      if (timer) clearTimeout(timer);
      setJob(null);
      fn();
    };

    const poll = async () => {
      const { data } = await supabase
        .from("ai_jobs")
        .select("status,result")
        .eq("id", job.jobId)
        .single();
      if (!data || stopped) return;
      if (data.status === "done") {
        finish(() => handlers.current.onDone?.(data.result ?? null));
        return;
      }
      if (data.status === "failed") {
        finish(() => handlers.current.onFail?.());
        return;
      }
      delay = Math.min(delay + 2000, MAX_DELAY);
      if (!stopped) timer = setTimeout(poll, delay);
    };
    timer = setTimeout(poll, delay);

    const cap = setTimeout(() => {
      stopped = true;
      if (timer) clearTimeout(timer);
    }, 15 * 60 * 1000);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      clearTimeout(cap);
    };
  }, [job]);

  return { job, start, reset };
}
