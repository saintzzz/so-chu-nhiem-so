"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { useAiJob } from "@/hooks/use-ai-job";
import { updateWarningStatus } from "@/app/(app)/school/radar/actions";
import { useEffect } from "react";

export interface WarningRow {
  id: string;
  className: string;
  studentName: string | null;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string | null;
  suggestion: string | null;
  status: "open" | "acknowledged" | "resolved";
}

const CATEGORY_LABEL: Record<string, string> = {
  chuyen_can: "Chuyên cần",
  hoc_tap: "Học tập",
  an_toan: "An toàn",
  bo_hoc: "Bỏ học",
  tam_ly: "Tâm lý",
};

const SEV = {
  low: { label: "Thấp", tone: "muted" as const },
  medium: { label: "Trung bình", tone: "warning" as const },
  high: { label: "Cao", tone: "error" as const },
  critical: { label: "Nghiêm trọng", tone: "error" as const },
};

const FILTERS = [
  { key: "all", label: "Tất cả" },
  { key: "chuyen_can", label: "Chuyên cần" },
  { key: "hoc_tap", label: "Học tập" },
  { key: "an_toan", label: "An toàn" },
  { key: "tam_ly", label: "Tâm lý" },
] as const;

export function WarningList({ rows }: { rows: WarningRow[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [aiFor, setAiFor] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const aiJob = useAiJob();
  const [jobFor, setJobFor] = useState<string | null>(null);

  // Devin fallback: kết quả về sau -> điền vào suggestion của cảnh báo tương ứng
  useEffect(() => {
    if (!aiJob.done || !aiJob.result || !jobFor) return;
    const obj = aiJob.result as { suggestion?: string };
    if (obj.suggestion?.trim()) {
      setSuggestions((s) => ({ ...s, [jobFor]: obj.suggestion!.trim() }));
    }
    setJobFor(null);
    aiJob.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiJob.done, aiJob.result]);

  const filtered =
    filter === "all" ? rows : rows.filter((r) => r.category === filter);

  async function aiAdvice(id: string) {
    setAiFor(id);
    setErr(null);
    try {
      const res = await fetch("/api/ai/warning-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warningId: id }),
      });
      const json = (await res.json()) as {
        suggestion?: string;
        pending?: boolean;
        jobId?: string;
        devinUrl?: string;
        error?: string;
      };
      if (json.suggestion) {
        setSuggestions((s) => ({ ...s, [id]: json.suggestion! }));
      } else if (json.pending && json.jobId && json.devinUrl) {
        aiJob.start(json.jobId, json.devinUrl);
        setJobFor(id);
      } else {
        setErr(json.error ?? "AI chưa đề xuất được.");
      }
    } catch {
      setErr("Không kết nối được AI.");
    } finally {
      setAiFor(null);
    }
  }

  function act(id: string, status: "acknowledged" | "resolved") {
    start(async () => {
      setErr(null);
      const r = await updateWarningStatus(id, status);
      if (r.error) setErr(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              filter === f.key
                ? "border-primary bg-primary-bg text-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {err && (
        <p className="rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error">
          {err}
        </p>
      )}
      <DataTable
        columns={[
          "Nhóm",
          "Lớp",
          "Vấn đề",
          "Mức độ",
          "Đề xuất xử lý",
          "Trạng thái",
          "Thao tác",
        ]}
      >
        {filtered.map((w) => (
          <tr key={w.id}>
            <td>
              <StatusBadge
                label={CATEGORY_LABEL[w.category] ?? w.category}
                tone="primary"
              />
            </td>
            <td className="font-medium">
              {w.className}
              {w.studentName && (
                <span className="block text-xs text-muted-foreground">
                  {w.studentName}
                </span>
              )}
            </td>
            <td className="max-w-56">
              <p className="font-medium">{w.title}</p>
              {w.detail && (
                <p className="text-xs text-muted-foreground">{w.detail}</p>
              )}
            </td>
            <td>
              <StatusBadge
                label={SEV[w.severity].label}
                tone={SEV[w.severity].tone}
              />
            </td>
            <td className="max-w-72">
              <p className="text-sm text-muted-foreground">
                {suggestions[w.id] ?? w.suggestion ?? "-"}
              </p>
            </td>
            <td>
              {w.status === "open" ? (
                <StatusBadge label="Chưa xử lý" tone="warning" />
              ) : w.status === "acknowledged" ? (
                <StatusBadge label="Đã tiếp nhận" tone="primary" />
              ) : (
                <StatusBadge label="Đã đóng" tone="success" />
              )}
            </td>
            <td>
              <span className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => aiAdvice(w.id)}
                  disabled={aiFor === w.id || (jobFor === w.id && !aiJob.done)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-primary hover:bg-primary-bg disabled:opacity-50"
                >
                  <Sparkles className="size-3" />
                  {jobFor === w.id && !aiJob.done
                    ? "AI đang chạy..."
                    : aiFor === w.id
                      ? "Đang hỏi..."
                      : "AI đề xuất"}
                </button>
                {w.status === "open" && (
                  <button
                    type="button"
                    onClick={() => act(w.id, "acknowledged")}
                    disabled={pending}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                  >
                    Tiếp nhận xử lý
                  </button>
                )}
                {w.status === "acknowledged" && (
                  <button
                    type="button"
                    onClick={() => act(w.id, "resolved")}
                    disabled={pending}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                  >
                    Đóng cảnh báo
                  </button>
                )}
              </span>
            </td>
          </tr>
        ))}
        {filtered.length === 0 && (
          <tr>
            <td colSpan={7} className="py-8 text-center text-muted-foreground">
              Không có cảnh báo nào trong nhóm này.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
