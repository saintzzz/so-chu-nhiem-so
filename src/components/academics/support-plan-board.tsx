"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge, FLOW_STATUS } from "@/components/status-badge";
import {
  createSupportPlans,
  type SupportPlanPair,
} from "@/app/(app)/academics/support/actions";
import { PlanActions } from "@/components/academics/plan-actions";

type PlanStatus =
  | "draft"
  | "pending"
  | "approved"
  | "in_progress"
  | "done"
  | "cancelled";
const PLAN_STATUSES = new Set<string>([
  "draft",
  "pending",
  "approved",
  "in_progress",
  "done",
  "cancelled",
]);

export interface WeakPair {
  studentId: string;
  subjectId: string;
  studentName: string;
  studentCode: string;
  subjectName: string;
  avg: number;
  planId: string | null;
  planStatus: keyof typeof FLOW_STATUS | null;
}

/** Multi-select table for weak student+subject pairs with bulk plan creation. */
export function SupportPlanBoard({
  rows,
  meId,
}: {
  rows: WeakPair[];
  meId: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectable = useMemo(
    () => rows.filter((r) => r.planStatus === null),
    [rows],
  );
  const allChecked =
    selectable.length > 0 &&
    selectable.every((r) => selected.has(`${r.studentId}:${r.subjectId}`));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      allChecked
        ? new Set()
        : new Set(selectable.map((r) => `${r.studentId}:${r.subjectId}`)),
    );
  }

  function submit(pairs: SupportPlanPair[]) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await createSupportPlans(pairs);
      if (res.error) {
        setError(res.error);
        return;
      }
      setMessage(`Đã tạo ${res.created} kế hoạch hỗ trợ.`);
      setSelected(new Set());
    });
  }

  const selectedPairs: SupportPlanPair[] = rows
    .filter((r) => selected.has(`${r.studentId}:${r.subjectId}`))
    .map((r) => ({ studentId: r.studentId, subjectId: r.subjectId, avg: r.avg }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          onClick={() => submit(selectedPairs)}
          disabled={pending || selectedPairs.length === 0}
        >
          {pending
            ? "Đang tạo…"
            : `Tạo kế hoạch cho ${selectedPairs.length} mục đã chọn`}
        </Button>
        <span className="text-sm text-muted-foreground">
          Đã chọn {selectedPairs.length}/{selectable.length} mục chưa có kế hoạch
        </span>
        {message && <span className="text-sm text-success">{message}</span>}
        {error && <span className="text-sm text-error">{error}</span>}
      </div>

      <div className="relative overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  aria-label="Chọn tất cả học sinh chưa có kế hoạch"
                  disabled={selectable.length === 0}
                />
              </th>
              <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Học sinh
              </th>
              <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Môn yếu
              </th>
              <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Điểm TB
              </th>
              <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Trạng thái kế hoạch
              </th>
              <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const key = `${r.studentId}:${r.subjectId}`;
              const st = r.planStatus ? FLOW_STATUS[r.planStatus] : null;
              return (
                <tr key={key} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">
                    {r.planStatus === null && (
                      <input
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={() => toggle(key)}
                        aria-label={`Chọn ${r.studentName} - ${r.subjectName}`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{r.studentName}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {r.studentCode}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{r.subjectName}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-error">
                      {r.avg.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {st ? (
                      <StatusBadge label={st.label} tone={st.tone} />
                    ) : (
                      <StatusBadge label="Chưa có" tone="muted" />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.planStatus === null ? (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          submit([
                            {
                              studentId: r.studentId,
                              subjectId: r.subjectId,
                              avg: r.avg,
                            },
                          ])
                        }
                      >
                        Tạo kế hoạch
                      </Button>
                    ) : (
                      r.planId &&
                      r.planStatus &&
                      PLAN_STATUSES.has(r.planStatus) && (
                        <PlanActions
                          planId={r.planId}
                          status={r.planStatus as PlanStatus}
                          meId={meId}
                        />
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Không có học sinh nào dưới 5.0.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
