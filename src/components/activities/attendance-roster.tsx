"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { cn } from "@/lib/utils";
import { saveActivityAttendance } from "@/app/(app)/activities/actions";

type RowStatus = "registered" | "present" | "absent" | "excused";

const STATUS_OPTIONS: { value: RowStatus; label: string }[] = [
  { value: "registered", label: "Đã đăng ký" },
  { value: "present", label: "Có mặt" },
  { value: "absent", label: "Vắng" },
  { value: "excused", label: "Vắng có phép" },
];

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export interface RosterRow {
  studentId: string;
  studentName: string;
  code: string;
  status: RowStatus;
  evaluation: string;
}

export function AttendanceRoster({
  activities,
  selectedId,
  rows,
}: {
  activities: { id: string; label: string }[];
  selectedId: string | null;
  rows: RosterRow[];
}) {
  const router = useRouter();
  const [state, setState] = useState<
    Record<string, { status: RowStatus; evaluation: string }>
  >(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.studentId,
        { status: r.status, evaluation: r.evaluation },
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    setFeedback(null);
    const res = await saveActivityAttendance(
      selectedId,
      rows.map((r) => ({
        studentId: r.studentId,
        status: state[r.studentId]?.status ?? r.status,
        evaluation: state[r.studentId]?.evaluation ?? r.evaluation,
      })),
    );
    setSaving(false);
    setFeedback(
      res.error
        ? { kind: "error", text: res.error }
        : { kind: "success", text: "Đã lưu điểm danh & đánh giá." },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Chọn hoạt động:</label>
        <select
          value={selectedId ?? ""}
          onChange={(e) =>
            router.push(`/activities/attendance?activity=${e.target.value}`)
          }
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      {!selectedId ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Chưa có hoạt động nào được duyệt để điểm danh.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          Chưa có học sinh đăng ký. Vui lòng gửi thông báo &amp; đăng ký trước ở
          mục &quot;Thông báo &amp; đăng ký&quot;.
        </div>
      ) : (
        <>
          <DataTable
            columns={["Học sinh", "Mã HS", "Trạng thái", "Đánh giá / nhận xét"]}
          >
            {rows.map((r) => {
              const cur = state[r.studentId] ?? {
                status: r.status,
                evaluation: r.evaluation,
              };
              return (
                <tr key={r.studentId}>
                  <td className="font-medium">{r.studentName}</td>
                  <td className="text-muted-foreground">{r.code}</td>
                  <td>
                    <div
                      role="radiogroup"
                      aria-label={`Trạng thái của ${r.studentName}`}
                      className="flex flex-wrap gap-1"
                    >
                      {STATUS_OPTIONS.map((o) => {
                        const active = cur.status === o.value;
                        return (
                          <label
                            key={o.value}
                            className={cn(
                              "cursor-pointer rounded-full border px-2 py-1 text-xs transition-colors",
                              active
                                ? o.value === "present"
                                  ? "border-success/50 bg-success-bg text-success"
                                  : o.value === "absent"
                                    ? "border-error/50 bg-error-bg text-error"
                                    : o.value === "excused"
                                      ? "border-warning/50 bg-warning-bg text-warning"
                                      : "border-primary/50 bg-primary-bg text-primary"
                                : "border-border text-muted-foreground hover:border-muted-foreground/50",
                            )}
                          >
                            <input
                              type="radio"
                              name={`att-${r.studentId}`}
                              value={o.value}
                              checked={active}
                              onChange={() =>
                                setState((prev) => ({
                                  ...prev,
                                  [r.studentId]: { ...cur, status: o.value },
                                }))
                              }
                              className="sr-only"
                            />
                            {o.label}
                          </label>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <input
                      value={cur.evaluation}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          [r.studentId]: {
                            ...cur,
                            evaluation: e.target.value,
                          },
                        }))
                      }
                      placeholder="Nhận xét ý thức tham gia..."
                      className={cn(INPUT_CLS, "min-w-56")}
                    />
                  </td>
                </tr>
              );
            })}
          </DataTable>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu điểm danh & đánh giá"}
            </Button>
            {feedback && (
              <p
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  feedback.kind === "success"
                    ? "bg-success-bg text-success"
                    : "bg-error-bg text-error",
                )}
              >
                {feedback.text}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
