"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge, SEVERITY, FLOW_STATUS } from "@/components/status-badge";
import { toggleReportedToBgh } from "@/app/(app)/safety/actions";

export interface BghIncidentRow {
  id: string;
  occurredAt: string;
  className: string;
  studentName: string;
  type: string;
  severity: keyof typeof SEVERITY;
  status: keyof typeof FLOW_STATUS;
  description: string;
  reported: boolean;
}

export function BghTable({
  rows,
  canToggle = false,
}: {
  rows: BghIncidentRow[];
  canToggle?: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string, reported: boolean) {
    setPendingId(id);
    setError(null);
    const res = await toggleReportedToBgh(id, reported);
    if (res.error) setError(res.error);
    setPendingId(null);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
        Chưa có sự cố nào được ghi nhận trong toàn trường.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}
      <DataTable
        columns={[
          "Thời điểm",
          "Lớp",
          "Học sinh",
          "Loại sự cố",
          "Mức độ",
          "Trạng thái",
          "Báo cáo BGH",
        ]}
      >
        {rows.map((r) => {
          const sev = SEVERITY[r.severity];
          const st = FLOW_STATUS[r.status];
          return (
            <tr key={r.id}>
              <td className="whitespace-nowrap text-muted-foreground">
                {r.occurredAt}
              </td>
              <td className="font-medium">{r.className}</td>
              <td>{r.studentName}</td>
              <td>
                <div className="max-w-56">
                  <p className="truncate">{r.type}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.description}
                  </p>
                </div>
              </td>
              <td>
                <StatusBadge label={sev.label} tone={sev.tone} />
              </td>
              <td>
                <StatusBadge label={st.label} tone={st.tone} />
              </td>
              <td>
                {r.reported ? (
                  <div className="flex items-center gap-2">
                    <StatusBadge label="Đã báo cáo" tone="success" />
                    {canToggle && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => toggle(r.id, false)}
                        disabled={pendingId === r.id}
                      >
                        Bỏ đánh dấu
                      </Button>
                    )}
                  </div>
                ) : canToggle ? (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => toggle(r.id, true)}
                    disabled={pendingId === r.id}
                  >
                    {pendingId === r.id ? "Đang lưu..." : "Báo cáo BGH"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Chưa báo cáo
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
