"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Minus, Plus, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge, ATT_STATUS } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { cn, sortByVietnameseName } from "@/lib/utils";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

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
  lesson_title: string | null;
  lesson_content: string | null;
  teacher_comment: string | null;
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

const MARK_TONE: Record<Mark, string> = {
  "": "border-success/50 bg-success-bg text-success",
  excused: "border-warning/50 bg-warning-bg text-warning",
  unexcused: "border-error/50 bg-error-bg text-error",
  late: "border-warning/50 bg-warning-bg text-warning",
};

interface DraftState {
  present: string;
  title: string;
  content: string;
  comment: string;
  marks: Record<string, Mark>;
  /** Điểm rèn luyện cộng/trừ tích lũy trong phiên (đã ghi conduct_records) */
  points: Record<string, number>;
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
    title: log?.lesson_title ?? "",
    content: log?.lesson_content ?? "",
    comment: log?.teacher_comment ?? log?.note ?? "",
    marks,
    points: {},
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
      const title = draft.title.trim() === "" ? null : draft.title.trim();
      const content =
        draft.content.trim() === "" ? null : draft.content.trim();
      const comment =
        draft.comment.trim() === "" ? null : draft.comment.trim();
      const logFields = {
        present_count: presentCount,
        lesson_title: title,
        lesson_content: content,
        teacher_comment: comment,
        // giữ đồng bộ cột note cũ cho các surface chưa migrate
        note: comment,
      };
      let logId = logs[entryId]?.id ?? null;

      if (logId) {
        const { error: e } = await supabase
          .from("period_logs")
          .update(logFields)
          .eq("id", logId);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase
          .from("period_logs")
          .insert({
            timetable_entry_id: entryId,
            date,
            logged_by: profileId,
            ...logFields,
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

      // Đồng bộ sổ đầu bài -> điểm danh ngày: HS vắng bất kỳ tiết nào phải
      // phản ánh vào attendance_records (source=period_log). Không ghi đè
      // record "manual" - xác nhận của GVCN luôn giữ nguyên.
      const affectedIds = [
        ...new Set([
          ...rows.map((r) => r.student_id),
          ...(logs[entryId]?.absences ?? []).map((a) => a.student_id),
        ]),
      ];
      if (affectedIds.length > 0) {
        // Mọi tiết cùng lớp trong ngày -> log ids -> absences
        const classId = entries.find((e) => e.id === entryId)?.class_id;
        const entryIds = entries
          .filter((e) => e.class_id === classId)
          .map((e) => e.id);
        const { data: dayLogs } = await supabase
          .from("period_logs")
          .select("id")
          .eq("date", date)
          .in("timetable_entry_id", entryIds);
        const logIds = ((dayLogs ?? []) as { id: string }[]).map((l) => l.id);
        const { data: dayAbs } = logIds.length
          ? await supabase
              .from("period_absences")
              .select("student_id,status")
              .in("period_log_id", logIds)
              .in("student_id", affectedIds)
          : { data: [] };

        const SEVERITY_ORDER: Record<string, number> = {
          unexcused: 3,
          excused: 2,
          late: 1,
        };
        const worst = new Map<string, string>();
        for (const a of (dayAbs ?? []) as {
          student_id: string;
          status: string;
        }[]) {
          const cur = worst.get(a.student_id);
          if (!cur || SEVERITY_ORDER[a.status] > SEVERITY_ORDER[cur])
            worst.set(a.student_id, a.status);
        }

        // Xóa record do sổ đầu bài tạo trước đó rồi tính lại từ đầu.
        await supabase
          .from("attendance_records")
          .delete()
          .in("student_id", affectedIds)
          .eq("date", date)
          .eq("source", "period_log");
        // Record hiện có (manual/parent): vắng theo tiết là bằng chứng thực tế
        // -> nâng status nếu period log nghiêm trọng hơn; không hạ severity.
        const { data: existing } = await supabase
          .from("attendance_records")
          .select("student_id,status")
          .in("student_id", affectedIds)
          .eq("date", date);
        const existingStatus = new Map(
          ((existing ?? []) as { student_id: string; status: string }[]).map(
            (r) => [r.student_id, r.status],
          ),
        );
        const inserts: {
          student_id: string;
          date: string;
          status: string;
          source: string;
        }[] = [];
        const updates: { student_id: string; status: string }[] = [];
        for (const [sid, st] of worst) {
          const cur = existingStatus.get(sid);
          if (!cur) {
            inserts.push({ student_id: sid, date, status: st, source: "period_log" });
          } else if (SEVERITY_ORDER[st] > (SEVERITY_ORDER[cur] ?? 0)) {
            updates.push({ student_id: sid, status: st });
          }
        }
        if (inserts.length > 0) {
          const { error: syncErr } = await supabase
            .from("attendance_records")
            .insert(inserts);
          if (syncErr) throw syncErr;
        }
        for (const u of updates) {
          const { error: upErr } = await supabase
            .from("attendance_records")
            .update({ status: u.status })
            .eq("student_id", u.student_id)
            .eq("date", date);
          if (upErr) throw upErr;
        }
      }

      setOpenId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu sổ đầu bài");
    } finally {
      setSavingId(null);
    }
  }

  /** Cộng/trừ điểm rèn luyện nhanh ngay trong sổ đầu bài -> conduct_records */
  async function awardPoints(
    entry: PeriodEntry,
    studentId: string,
    delta: number,
  ) {
    const supabase = createClient();
    const { error: e } = await supabase.from("conduct_records").insert({
      student_id: studentId,
      type: delta > 0 ? "khen_thuong" : "vi_pham",
      points: delta,
      date,
      content:
        delta > 0
          ? `Cộng điểm rèn luyện trong tiết ${entry.subject}`
          : `Trừ điểm rèn luyện trong tiết ${entry.subject}`,
      recorded_by: profileId,
    });
    if (e) {
      setError(e.message);
      return;
    }
    setError(null);
    setDrafts((d) => {
      const draft = d[entry.id];
      if (!draft) return d;
      return {
        ...d,
        [entry.id]: {
          ...draft,
          points: {
            ...draft.points,
            [studentId]: (draft.points[studentId] ?? 0) + delta,
          },
        },
      };
    });
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
                        {` · Sĩ số ${roster.size}`}
                      </span>
                      {log && log.absences.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {sortByVietnameseName(
                            log.absences
                              .map((a) => ({
                                ...a,
                                name:
                                  roster.students.find(
                                    (st) => st.id === a.student_id,
                                  )?.full_name ?? "?",
                              })),
                            (a) => a.name,
                          ).map((a) => (
                            <span
                              key={a.student_id}
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[11px]",
                                a.status === "unexcused"
                                  ? "border-error/40 bg-error-bg text-error"
                                  : "border-warning/40 bg-warning-bg text-warning",
                              )}
                            >
                              {a.name} · {ATT_STATUS[a.status].label}
                            </span>
                          ))}
                        </span>
                      )}
                      {(log?.lesson_title || log?.lesson_content) && (
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {log.lesson_title && (
                            <span className="font-medium text-foreground">
                              {log.lesson_title}
                            </span>
                          )}
                          {log.lesson_content &&
                            `${log.lesson_title ? " - " : ""}${log.lesson_content}`}
                        </span>
                      )}
                      {(log?.teacher_comment ?? log?.note) && (
                        <span className="mt-0.5 block truncate text-xs italic text-muted-foreground">
                          “{log.teacher_comment ?? log.note}”
                        </span>
                      )}
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
                          <span className="flex items-center gap-1.5">
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
                            <span className="text-xs text-muted-foreground">
                              / {roster.size} học sinh
                            </span>
                          </span>
                        </label>
                        <div className="grid flex-1 gap-3 sm:grid-cols-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-muted-foreground">
                              Tên bài học
                            </span>
                            <input
                              type="text"
                              value={draft.title}
                              onChange={(e) =>
                                setDrafts((d) => ({
                                  ...d,
                                  [entry.id]: {
                                    ...draft,
                                    title: e.target.value,
                                  },
                                }))
                              }
                              placeholder="VD: Bài 5 - Phép cộng phân số"
                              className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-ring"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-muted-foreground">
                              Nội dung bài học
                            </span>
                            <AutoGrowTextarea
                              value={draft.content}
                              onChange={(e) =>
                                setDrafts((d) => ({
                                  ...d,
                                  [entry.id]: {
                                    ...draft,
                                    content: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Nội dung chính đã dạy..."
                              className="w-full"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-muted-foreground">
                              Nhận xét của giáo viên
                            </span>
                            <AutoGrowTextarea
                              value={draft.comment}
                              onChange={(e) =>
                                setDrafts((d) => ({
                                  ...d,
                                  [entry.id]: {
                                    ...draft,
                                    comment: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Tình hình lớp, ý thức học tập..."
                              className="w-full"
                            />
                          </label>
                        </div>
                      </div>

                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Đánh dấu học sinh vắng / đi muộn
                      </p>
                      <div className="mb-4 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {sortByVietnameseName(roster.students, (s) => s.full_name).map((s) => {
                          const mark = draft.marks[s.id] ?? "";
                          const pts = draft.points[s.id] ?? 0;
                          return (
                            <div
                              key={s.id}
                              className={cn(
                                "flex flex-col gap-1.5 rounded-lg border px-2.5 py-1.5",
                                mark === ""
                                  ? "border-border bg-card"
                                  : mark === "late"
                                    ? "border-warning/40 bg-warning-bg"
                                    : "border-error/40 bg-error-bg",
                              )}
                            >
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="min-w-0 flex-1 truncate text-sm"
                                  title={s.full_name}
                                >
                                  {s.full_name}
                                </span>
                                <span
                                  className="flex shrink-0 items-center gap-0.5"
                                  title="Điểm rèn luyện"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void awardPoints(entry, s.id, -1)
                                    }
                                    aria-label={`Trừ điểm rèn luyện ${s.full_name}`}
                                    className="flex size-6 items-center justify-center rounded-md border border-border text-error hover:bg-error-bg"
                                  >
                                    <Minus className="size-3.5" />
                                  </button>
                                  {pts !== 0 && (
                                    <span
                                      className={cn(
                                        "w-7 text-center text-xs font-semibold",
                                        pts > 0
                                          ? "text-success"
                                          : "text-error",
                                      )}
                                    >
                                      {pts > 0 ? `+${pts}` : pts}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void awardPoints(entry, s.id, 1)
                                    }
                                    aria-label={`Cộng điểm rèn luyện ${s.full_name}`}
                                    className="flex size-6 items-center justify-center rounded-md border border-border text-success hover:bg-success-bg"
                                  >
                                    <Plus className="size-3.5" />
                                  </button>
                                </span>
                              </span>
                              <span
                                role="radiogroup"
                                aria-label={`Trạng thái của ${s.full_name}`}
                                className="flex flex-wrap gap-1"
                              >
                                {(
                                  [
                                    "",
                                    "excused",
                                    "unexcused",
                                    "late",
                                  ] as const
                                ).map((m) => (
                                  <label
                                    key={m || "present"}
                                    className={cn(
                                      "cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                      mark === m
                                        ? MARK_TONE[m]
                                        : "border-border text-muted-foreground hover:bg-muted",
                                    )}
                                  >
                                    <input
                                      type="radio"
                                      name={`pl-${entry.id}-${s.id}`}
                                      value={m}
                                      checked={mark === m}
                                      onChange={() => setMark(entry, s.id, m)}
                                      className="sr-only"
                                    />
                                    {m === "" ? "Có mặt" : ATT_STATUS[m].label}
                                  </label>
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
