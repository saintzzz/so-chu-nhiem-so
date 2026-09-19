"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge, FLOW_STATUS } from "@/components/status-badge";
import { updateAppointmentStatus } from "@/app/(app)/parents/actions";

export interface AppointmentRow {
  id: string;
  parentName: string;
  studentName: string | null;
  scheduledAt: string;
  purpose: string | null;
  status: "proposed" | "confirmed" | "done" | "cancelled";
}

export function AppointmentsClient({ rows }: { rows: AppointmentRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function act(id: string, status: "confirmed" | "done" | "cancelled") {
    setPendingId(id);
    await updateAppointmentStatus(id, status);
    setPendingId(null);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
        Chưa có lịch hẹn trao đổi nào với phụ huynh.
      </div>
    );
  }

  return (
    <DataTable
      columns={[
        "Phụ huynh",
        "Học sinh",
        "Thời gian",
        "Mục đích",
        "Trạng thái",
        "Thao tác",
      ]}
    >
      {rows.map((r) => {
        const st = FLOW_STATUS[r.status];
        const busy = pendingId === r.id;
        return (
          <tr key={r.id}>
            <td className="font-medium">{r.parentName}</td>
            <td>{r.studentName ?? "-"}</td>
            <td>{r.scheduledAt}</td>
            <td className="max-w-64 truncate">{r.purpose ?? "-"}</td>
            <td>
              <StatusBadge label={st.label} tone={st.tone} />
            </td>
            <td>
              <div className="flex gap-1.5">
                {r.status === "proposed" && (
                  <Button
                    size="xs"
                    onClick={() => act(r.id, "confirmed")}
                    disabled={busy}
                  >
                    Xác nhận
                  </Button>
                )}
                {r.status === "confirmed" && (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => act(r.id, "done")}
                    disabled={busy}
                  >
                    Hoàn thành
                  </Button>
                )}
                {(r.status === "proposed" || r.status === "confirmed") && (
                  <Button
                    size="xs"
                    variant="destructive"
                    onClick={() => act(r.id, "cancelled")}
                    disabled={busy}
                  >
                    Hủy
                  </Button>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
