"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge, ATT_STATUS } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { cn, sortByVietnameseName } from "@/lib/utils";

export interface PeriodEntry {
  id: string;
  class_id: string;
  className?: string;
  period: number;
  subject: string;
  teacher: string | null;
  room: string | null;
}

export interface PeriodAbsenceState {
  student_id: string;
  status: "excused" | "unexcused" | "late";
}

export interface PeriodLogState {
  id: string;
  present_count: number | null;
  note: string | null;
  absences: PeriodAbsenceState[];
}

interface StudentOption {
  id: string;
  full_name: string;
  code: string;
}

export interface ClassRoster {
  students: StudentOption[];
  size: number;
}

type Mark = "" | "excused" | "unexcused" | "late";

interface DraftState {
  present: string;
  note: string;
  marks: Record<string, Mark>;
}

function initDraft(
  log: PeriodLogState | undefined,
  rosterSize: number,
): DraftState {
  const marks: Record<string, Mark> = {};
  for (const a of log?.absences ?? []) marks[a.student_id] = a.status;
  return {
    present:
      log?.present_count !== null && log?.present_count !== undefined
        ? String(log.present_count)
        : String(
            rosterSize -
              (log?.absences ?? []).filter((a) => a.status !== "late").length,
          ),
    note: log?.note ?? "",
    marks,
  };
}

export function PeriodLogBoard({
  date,
  profileId,
  entries,
  rosters,
  logs,
}: {
  date: string;
  profileId: string;
  entries: PeriodEntry[];
  rosters: Record<string, ClassRoster>;
  logs: Record<string, PeriodLogState>;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function rosterOf(entry: PeriodEntry): ClassRoster {
    return rosters[entry.class_id] ?? { students: [], size: 0 };
  }

  function toggle(entry: PeriodEntry) {
    setOpenId((cur) => (cur === entry.id ? null : entry.id));
    setDrafts((d) =>
      d[entry.id]
        ? d
        : { ...d, [entry.id]: initDraft(logs[entry.id], rosterOf(entry).size) },
    );
  }

  function setMark(entry: PeriodEntry, studentId: string, mark: Mark) {
    setDrafts((d) => {
      const draft = d[entry.id];
      if (!draft) return d;
      const marks = { ...draft.marks, [studentId]: mark };
      const absent = Object.values(marks).filter(
        (m) => m === "excused" || m === "unexcused",
      ).length;
      return {
        ...d,
        [entry.id]: {
          ...draft,
          marks,
          present: String(rosterOf(entry).size - absent),
        },
      };
    });
  }

  async function save(entryId: string) {
    const draft = drafts[entryId];
    if (!draft) return;
    setSavingId(entryId);
    setError(null);
    const supabase = createClient();
    try {
      const presentCount = draft.present === "" ? null : Number(draft.present);
      const note = draft.note.trim() === "" ? null : draft.note.trim();
      let logId = logs[entryId]?.id ?? null;

      if (logId) {
        const { error: e } = await supabase
          .from("period_logs")
          .update({ present_count: presentCount, note })
          .eq("id", logId);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase
          .from("period_logs")
          .insert({
            timetable_entry_id: entryId,
            date,
            present_count: presentCount,
            note,
            logged_by: profileId,
          })
          .select("id")
          .single();
        if (e) throw e;
        logId = (data as { id: string }).id;
      }

      const { error: delErr } = await supabase
        .from("period_absences")
        .delete()
        .eq("period_log_id", logId);
      if (delErr) throw delErr;

      const rows = Object.entries(draft.marks)
        .filter(([, m]) => m !== "")
        .map(([student_id, status]) => ({
          period_log_id: logId,
          student_id,
          status,
        }));
      if (rows.length > 0) {
        const { error: insErr } = await supabase
          .from("period_absences")
          .insert(rows);
        if (insErr) throw insErr;
      }

      setOpenId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu sổ đầu bài");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      {/* Date picker */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="log-date" className="text-sm text-muted-foreground">
          Ngày:
        </label>
        <input
          id="log-date"
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value)
              router.push(`/schedule/period-log?date=${e.target.value}`);
          }}
          className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm"
        />
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Không có tiết học nào trong ngày này.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
          <ul className="divide-y divide-border">
            {entries.map((entry) => {
              const log = logs[entry.id];
              const open = openId === entry.id;
              const draft = drafts[entry.id];
              const roster = rosterOf(entry);
              return (
                <li key={entry.id}>
                  <button
                    onClick={() => toggle(entry)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                    aria-expanded={open}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-bg text-sm font-semibold text-primary">
                      {entry.period}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        Tiết {entry.period} - {entry.subject}
                        {entry.className ? ` · ${entry.className}` : ""}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {entry.teacher ?? "Chưa phân công GV"}
                        {entry.room ? ` · Phòng ${entry.room}` : ""}
                      </span>
                    </span>
                    {log ? (
                      <StatusBadge
                        label={`Đã ghi · Có mặt ${log.present_count ?? "-"}/${roster.size}`}
                        tone="success"
                      />
                    ) : (
                      <StatusBadge label="Chưa ghi" tone="muted" />
                    )}
                    {open ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </button>

                  {open && draft && (
                    <div className="border-t border-border bg-muted/30 px-4 py-4">
                      <div className="mb-4 flex flex-wrap items-end gap-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-muted-foreground">
                            Sĩ số có mặt
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={roster.size}
                            value={draft.present}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [entry.id]: {
                                  ...draft,
                                  present: e.target.value,
                                },
                              }))
                            }
                            className="h-8 w-24 rounded-lg border border-border bg-background px-2.5 text-sm"
                          />
                        </label>
                        <label className="block min-w-48 flex-1">
                          <span className="mb-1 block text-xs font-medium text-muted-foreground">
                            Ghi chú tiết học
                          </span>
                          <input
                            type="text"
                            value={draft.note}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [entry.id]: { ...draft, note: e.target.value },
                              }))
                            }
                            placeholder="Nội dung bài dạy, tình hình lớp..."
                            className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm"
                          />
                        </label>
                        <span className="text-xs text-muted-foreground">
                          / {roster.size} học sinh
                        </span>
                      </div>

                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Đánh dấu học sinh vắng / đi muộn
                      </p>
                      <div className="mb-4 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {sortByVietnameseName(roster.students, (s) => s.full_name).map((s) => {
                          const mark = draft.marks[s.id] ?? "";
                          return (
                            <div
                              key={s.id}
                              className={cn(
                                "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5",
                                mark === ""
                                  ? "border-border bg-card"
                                  : mark === "late"
                                    ? "border-warning/40 bg-warning-bg"
                                    : "border-error/40 bg-error-bg",
                              )}
                            >
                              <span className="min-w-0 truncate text-sm">
                                {s.full_name}
                              </span>
                              <span
                                role="group"
                                aria-label={`Trạng thái của ${s.full_name}`}
                                className="flex shrink-0 gap-0.5"
                              >
                                {(
                                  ["excused", "unexcused", "late"] as const
                                ).map((m) => (
                                  <button
                                    key={m}
                                    type="button"
                                    title={
                                      mark === m
                                        ? `${ATT_STATUS[m].label} - bấm để bỏ`
                                        : ATT_STATUS[m].label
                                    }
                                    aria-pressed={mark === m}
                                    onClick={() =>
                                      setMark(entry, s.id, mark === m ? "" : m)
                                    }
                                    className={cn(
                                      "rounded-md border px-1.5 py-0.5 text-[11px] leading-tight transition-colors",
                                      mark === m
                                        ? m === "late"
                                          ? "border-warning bg-warning-bg text-warning"
                                          : "border-error bg-error-bg text-error"
                                        : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50",
                                    )}
                                  >
                                    {m === "excused"
                                      ? "CP"
                                      : m === "unexcused"
                                        ? "KP"
                                        : "Muộn"}
                                  </button>
                                ))}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => void save(entry.id)}
                          disabled={savingId === entry.id}
                        >
                          <Save />
                          {savingId === entry.id
                            ? "Đang lưu..."
                            : "Lưu sổ đầu bài"}
                        </Button>
                        <Button variant="ghost" onClick={() => setOpenId(null)}>
                          Đóng
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
