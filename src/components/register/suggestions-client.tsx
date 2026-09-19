"use client";

import { useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
    const today = new Date().toISOString().slice(0, 10);
    const { data: eventsData } = await supabase
      .from("school_year_events")
      .select("*")
      .gte("event_date", today)
      .order("event_date");
    const events = (eventsData ?? []) as SchoolYearEvent[];
    const existing = new Set(tasks.map((t) => t.title));
    const rows = events
      .map((e) => ({
        class_id: classId,
        title: `Chuẩn bị: ${e.title}`,
        due_date: e.event_date,
        month: e.month ?? e.event_date.slice(0, 7),
        source: "suggested" as const,
        status: "pending" as const,
      }))
      .filter((r) => !existing.has(r.title));
    if (rows.length === 0) {
      setMessage("Không có sự kiện mới nào để tạo gợi ý.");
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.from("tasks").insert(rows).select();
    if (!error && data) {
      const inserted = data as TaskRow[];
      setTasks((ts) => [...ts, ...inserted]);
      setMessage(`Đã tạo ${inserted.length} gợi ý từ lịch năm học.`);
    } else {
      setMessage("Không thể tạo gợi ý.");
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
                  ? new Date(t.due_date).toLocaleDateString("vi-VN")
                  : "—"}
              </td>
              <td className="text-muted-foreground">{t.month ?? "—"}</td>
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
