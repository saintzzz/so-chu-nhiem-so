"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { cn, formatDate } from "@/lib/utils";
import type { TaskRow } from "./types";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm";

function weekRange() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

export function PlansClient({
  classId,
  tasks: initialTasks,
}: {
  classId: string;
  tasks: TaskRow[];
}) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const byMonth = useMemo(() => {
    const m = new Map<number, TaskRow[]>();
    tasks.forEach((t) => {
      const key = t.month ?? (t.due_date ? parseInt(t.due_date.slice(5, 7), 10) : null) ?? 0;
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    });
    return [...m.entries()].sort(([a], [b]) => a - b);
  }, [tasks]);

  const week = useMemo(() => weekRange(), []);
  const weekTasks = tasks.filter(
    (t) => t.due_date && t.due_date >= week.start && t.due_date <= week.end,
  );
  const weekDone = weekTasks.filter((t) => t.status === "done").length;

  async function addTask() {
    if (!title.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        class_id: classId,
        title: title.trim(),
        due_date: dueDate || null,
        month: dueDate ? parseInt(dueDate.slice(5, 7), 10) : null,
        source: "manual",
        status: "approved",
      })
      .select()
      .single();
    if (!error && data) {
      setTasks((ts) => [...ts, data as TaskRow]);
      setTitle("");
      setDueDate("");
      setMessage("Đã thêm công việc vào kế hoạch.");
    } else {
      setMessage("Không thể thêm công việc.");
    }
    setBusy(false);
  }

  async function markDone(t: TaskRow) {
    setBusy(true);
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done" })
      .eq("id", t.id);
    if (!error) {
      setTasks((ts) =>
        ts.map((x) => (x.id === t.id ? { ...x, status: "done" } : x)),
      );
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {byMonth.map(([month, items]) => (
          <div
            key={month}
            className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]"
          >
            <h3 className="mb-3 font-semibold">
              {month === 0 ? "Chưa xếp tháng" : `Kế hoạch tháng ${month}`}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {items.filter((i) => i.status === "done").length}/{items.length}{" "}
                hoàn thành
              </span>
            </h3>
            <ul className="space-y-2">
              {items.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <div>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        t.status === "done" &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {t.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.due_date
                        ? `Hạn: ${formatDate(t.due_date)}`
                        : "Không hạn"}
                      {t.source === "suggested" && " · Gợi ý AI"}
                    </p>
                  </div>
                  {t.status === "done" ? (
                    <StatusBadge label="Hoàn thành" tone="success" />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => markDone(t)}
                    >
                      <CheckCircle2 /> Xong
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {byMonth.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Chưa có công việc nào trong kế hoạch.
          </div>
        )}
      </div>

      <div className="space-y-4">
        <StatCard
          label="Sơ kết tuần này"
          value={`${weekDone}/${weekTasks.length} việc xong`}
          tone={weekTasks.length > 0 && weekDone === weekTasks.length ? "success" : "primary"}
        />
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <h3 className="mb-3 font-semibold">Thêm công việc</h3>
          <div className="space-y-2">
            <input
              className={inputCls}
              placeholder="Tên công việc"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className={inputCls}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <Button onClick={addTask} disabled={busy || !title.trim()}>
              <Plus /> Thêm vào kế hoạch
            </Button>
          </div>
        </div>
        {message && (
          <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
