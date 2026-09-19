"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ATT_STATUS } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/types";

export interface RosterRow {
  studentId: string;
  code: string;
  fullName: string;
  status: AttendanceStatus;
}

const STATUSES: AttendanceStatus[] = [
  "present",
  "excused",
  "unexcused",
  "late",
];

const CHIP_TONE: Record<AttendanceStatus, string> = {
  present: "bg-success-bg text-success border-success/40",
  excused: "bg-warning-bg text-warning border-warning/40",
  unexcused: "bg-error-bg text-error border-error/40",
  late: "bg-warning-bg text-warning border-warning/40",
};

export function DailyRoster({
  date,
  rows,
}: {
  date: string;
  rows: RosterRow[];
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    () => Object.fromEntries(rows.map((r) => [r.studentId, r.status])),
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [dirty, setDirty] = useState(false);

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = {
      present: 0,
      excused: 0,
      unexcused: 0,
      late: 0,
    };
    for (const r of rows) c[statuses[r.studentId] ?? "present"] += 1;
    return c;
  }, [rows, statuses]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStatuses((s) => ({ ...s, [studentId]: status }));
    setDirty(true);
    setFeedback(null);
  }

  async function confirm() {
    setSaving(true);
    setFeedback(null);
    const supabase = createClient();
    const payload = rows.map((r) => ({
      student_id: r.studentId,
      date,
      status: statuses[r.studentId] ?? "present",
      source: "manual",
    }));
    let { error } = await supabase
      .from("attendance_records")
      .upsert(payload, { onConflict: "student_id,date" });
    if (error) {
      // Fallback khi bảng chưa có unique constraint (student_id,date)
      const ids = rows.map((r) => r.studentId);
      await supabase
        .from("attendance_records")
        .delete()
        .eq("date", date)
        .in("student_id", ids);
      const retry = await supabase.from("attendance_records").insert(payload);
      error = retry.error;
    }
    setSaving(false);
    if (error) {
      setFeedback({ ok: false, text: `Lưu thất bại: ${error.message}` });
      return;
    }
    setDirty(false);
    setFeedback({
      ok: true,
      text: `Đã xác nhận chuyên cần ngày ${new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN")} cho ${rows.length} học sinh.`,
    });
    router.refresh();
  }

  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Summary counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Sĩ số", value: rows.length, cls: "text-foreground" },
          {
            label: "Vắng",
            value: counts.excused + counts.unexcused,
            cls: "text-error",
          },
          { label: "Nghỉ có phép", value: counts.excused, cls: "text-warning" },
          {
            label: "Nghỉ không phép",
            value: counts.unexcused,
            cls: "text-error",
          },
          { label: "Đi muộn", value: counts.late, cls: "text-warning" },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-sm-token)]"
          >
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={cn("mt-0.5 text-xl font-semibold", c.cls)}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full min-w-max text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["#", "Mã HS", "Họ tên", "Trạng thái"].map((c) => (
                <th
                  key={c}
                  className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr]:border-b [&_tr]:border-border [&_tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-2">
            {rows.map((r, i) => {
              const current = statuses[r.studentId] ?? "present";
              return (
                <tr key={r.studentId}>
                  <td className="text-muted-foreground">{i + 1}</td>
                  <td className="font-mono text-xs">{r.code}</td>
                  <td className="font-medium">{r.fullName}</td>
                  <td>
                    <div
                      className="flex flex-wrap gap-1.5"
                      role="radiogroup"
                      aria-label={`Trạng thái của ${r.fullName}`}
                    >
                      {STATUSES.map((st) => (
                        <label
                          key={st}
                          className={cn(
                            "cursor-pointer rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted",
                            current === st && CHIP_TONE[st],
                          )}
                        >
                          <input
                            type="radio"
                            name={`att-${r.studentId}`}
                            value={st}
                            checked={current === st}
                            onChange={() => setStatus(r.studentId, st)}
                            className="sr-only"
                          />
                          {ATT_STATUS[st].label}
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  Chưa có học sinh nào trong lớp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={confirm}
          disabled={saving || rows.length === 0}
          size="lg"
        >
          {saving ? "Đang lưu..." : "Xác nhận chuyên cần hôm nay"}
        </Button>
        {dirty && (
          <span className="text-sm text-warning">Có thay đổi chưa lưu</span>
        )}
        {feedback && (
          <span
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              feedback.ok
                ? "bg-success-bg text-success"
                : "bg-error-bg text-error",
            )}
          >
            {feedback.text}
          </span>
        )}
      </div>

      <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
        Chuyên cần ngày {dateLabel} được tự động gộp từ Sổ đầu bài: khi GVBM ghi
        nhận học sinh vắng trong tiết học, hệ thống đề xuất trạng thái tương ứng
        tại đây để GVCN rà soát và xác nhận.
      </p>
    </div>
  );
}
