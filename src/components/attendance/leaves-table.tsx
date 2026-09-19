"use client";

import { useMemo, useState } from "react";
import { ATT_STATUS, StatusBadge } from "@/components/status-badge";
import { cn, formatDateOnly } from "@/lib/utils";
import type { AttendanceStatus } from "@/types";

export interface LeaveRow {
  id: string;
  studentName: string;
  studentCode: string;
  date: string;
  status: Exclude<AttendanceStatus, "present">;
  source: string;
  note: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "GVCN nhập",
  period_log: "Sổ đầu bài",
  parent: "Phụ huynh báo",
};

const FILTERS: { key: "all" | LeaveRow["status"]; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "excused", label: "Vắng có phép" },
  { key: "unexcused", label: "Vắng không phép" },
  { key: "late", label: "Đi muộn" },
];

export function LeavesTable({ rows }: { rows: LeaveRow[] }) {
  const [filter, setFilter] = useState<"all" | LeaveRow["status"]>("all");

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const counts = useMemo(() => {
    const c = { excused: 0, unexcused: 0, late: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const count =
            f.key === "all" ? rows.length : counts[f.key];
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="relative overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full min-w-max text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Ngày", "Mã HS", "Học sinh", "Trạng thái", "Nguồn", "Ghi chú"].map(
                (c) => (
                  <th
                    key={c}
                    className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {c}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="[&_tr]:border-b [&_tr]:border-border [&_tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-2.5">
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">
                  {formatDateOnly(r.date, {
                    weekday: "short",
                    day: "numeric",
                    month: "numeric",
                  })}
                </td>
                <td className="font-mono text-xs">{r.studentCode}</td>
                <td className="font-medium">{r.studentName}</td>
                <td>
                  <StatusBadge
                    label={ATT_STATUS[r.status].label}
                    tone={ATT_STATUS[r.status].tone}
                  />
                </td>
                <td className="text-muted-foreground">
                  {SOURCE_LABEL[r.source] ?? r.source}
                </td>
                <td className="max-w-48 truncate text-muted-foreground">
                  {r.note ?? "-"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  Không có lượt vắng / đi muộn nào phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
