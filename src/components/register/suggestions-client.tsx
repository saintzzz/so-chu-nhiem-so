"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";
import { Check, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAiJob } from "@/hooks/use-ai-job";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { SchoolYearEvent, TaskRow } from "./types";

const STATUS_META: Record<string, { label: string; tone: "warning" | "success" | "muted" }> = {
  pending: { label: "Chờ duyệt", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "success" },
  done: { label: "Hoàn thành", tone: "success" },
  dismissed: { label: "Đã bỏ qua", tone: "muted" },
};

export function SuggestionsClient({
  classId,
  tasks: initialTasks,
}: {
  classId: string;
  tasks: TaskRow[];
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const aiJob = useAiJob();

  async function insertSuggestions(
    suggestions: { title: string; due_date: string }[],
    label: string,
  ) {
    const existing = new Set(tasks.map((t) => t.title));
    const rows = suggestions
      .filter((s) => !existing.has(s.title))
      .map((s) => ({
        class_id: classId,
        title: s.title,
        due_date: s.due_date,
        month: parseInt(s.due_date.slice(5, 7), 10),
        source: "suggested" as const,
        status: "pending" as const,
      }));
    if (rows.length === 0) {
      setMessage("Không có gợi ý mới nào để tạo.");
      return;
    }
    const { data, error } = await supabase.from("tasks").insert(rows).select();
    if (!error && data) {
      const inserted = data as TaskRow[];
      setTasks((ts) => [...ts, ...inserted]);
      setMessage(`${label} đã tạo ${inserted.length} gợi ý công việc.`);
    } else {
      setMessage("Không thể tạo gợi ý.");
    }
  }

  // Kết quả Devin (fallback khi LLM hết quota) về sau qua ai_jobs
  useEffect(() => {
    if (!aiJob.done || !aiJob.result) return;
    const arr = aiJob.result as { title?: string; due_date?: string }[];
    if (Array.isArray(arr)) {
      void insertSuggestions(
        arr.filter(
          (s): s is { title: string; due_date: string } =>
            typeof s.title === "string" &&
            typeof s.due_date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(s.due_date),
        ),
        "Devin",
      );
    }
    aiJob.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiJob.done, aiJob.result]);

  async function setStatus(id: string, status: "approved" | "dismissed") {
    setBusy(true);
    const { error } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", id);
    if (!error) {
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    }
    setBusy(false);
  }

  async function generateFromEvents() {
    setBusy(true);
    setMessage(null);
    const existing = new Set(tasks.map((t) => t.title));
    let usedAi = false;

    try {
      const res = await fetch("/api/ai/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      const json = (await res.json()) as {
        suggestions?: { title: string; due_date: string }[] | null;
        pending?: boolean;
        jobId?: string;
        devinUrl?: string;
      };
      if (json.pending && json.jobId && json.devinUrl) {
        aiJob.start(json.jobId, json.devinUrl);
        setBusy(false);
        return;
      }
      if (json.suggestions && json.suggestions.length > 0) {
        usedAi = true;
        await insertSuggestions(json.suggestions, "AI");
        setBusy(false);
        return;
      }
    } catch {
      // AI route lỗi - fallback rule-based bên dưới
    }

    if (!usedAi) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: eventsData } = await supabase
        .from("school_year_events")
        .select("*")
        .gte("event_date", today)
        .order("event_date");
      const events = (eventsData ?? []) as SchoolYearEvent[];
      const rows = events
        .map((e) => ({
          title: `Chuẩn bị: ${e.title}`,
          due_date: e.event_date,
        }))
        .filter((r) => !existing.has(r.title));
      if (rows.length === 0) {
        setMessage("Không có gợi ý mới nào để tạo.");
      } else {
        await insertSuggestions(rows, "Lịch năm học");
      }
    }
    setBusy(false);
  }

  const pendingCount = tasks.filter((t) => t.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {pendingCount} gợi ý đang chờ duyệt
        </p>
        <Button onClick={generateFromEvents} disabled={busy}>
          <Sparkles /> Tạo gợi ý từ lịch năm học
        </Button>
      </div>

      {message && (
        <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
          {message}
        </p>
      )}

      {aiJob.job && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          LLM hết hạn mức - đã giao cho Devin xử lý.{" "}
          <a
            href={aiJob.job.devinUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline"
          >
            Mở session Devin
          </a>{" "}
          - kết quả sẽ tự cập nhật khi hoàn thành.
        </p>
      )}
      {aiJob.failed && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Tác vụ Devin không hoàn thành. Vui lòng thử lại sau.
        </p>
      )}

      <DataTable
        columns={["Công việc", "Hạn", "Tháng", "Trạng thái", "Hành động"]}
      >
        {tasks.map((t) => {
          const meta = STATUS_META[t.status] ?? STATUS_META.pending;
          return (
            <tr key={t.id}>
              <td className="font-medium">{t.title}</td>
              <td>
                {t.due_date
                  ? formatDate(t.due_date)
                  : "-"}
              </td>
              <td className="text-muted-foreground">{t.month ?? "-"}</td>
              <td>
                <StatusBadge label={meta.label} tone={meta.tone} />
              </td>
              <td>
                {t.status === "pending" && (
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => setStatus(t.id, "approved")}
                    >
                      <Check /> Duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setStatus(t.id, "dismissed")}
                    >
                      <X /> Bỏ qua
                    </Button>
                  </span>
                )}
              </td>
            </tr>
          );
        })}
        {tasks.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center text-muted-foreground">
              Chưa có gợi ý nào. Nhấn &quot;Tạo gợi ý từ lịch năm học&quot;.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
