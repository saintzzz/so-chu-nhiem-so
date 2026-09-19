"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { SeatingChart } from "@/types";

export function SeatingHistoryClient({
  classId,
  charts: initialCharts,
}: {
  classId: string;
  charts: SeatingChart[];
}) {
  const supabase = createClient();
  const [charts, setCharts] = useState<SeatingChart[]>(initialCharts);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function restore(chart: SeatingChart) {
    setBusy(true);
    setMessage(null);
    await supabase
      .from("seating_charts")
      .update({ is_current: false })
      .eq("class_id", classId)
      .eq("month", chart.month);
    const { error } = await supabase
      .from("seating_charts")
      .update({ is_current: true })
      .eq("id", chart.id);
    if (error) {
      setMessage("Không thể khôi phục phiên bản này.");
    } else {
      setCharts((cs) =>
        cs.map((c) =>
          c.month === chart.month ? { ...c, is_current: c.id === chart.id } : c,
        ),
      );
      setMessage(
        `Đã khôi phục sơ đồ tháng ${chart.month} về phiên bản v${chart.version}.`,
      );
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
          {message}
        </p>
      )}
      <DataTable
        columns={["Tháng", "Phiên bản", "Ngày tạo", "Trạng thái", "Hành động"]}
      >
        {charts.map((c) => (
          <tr key={c.id}>
            <td className="font-medium">{c.month}</td>
            <td>v{c.version}</td>
            <td className="text-muted-foreground">
              {formatDateTime(c.created_at)}
            </td>
            <td>
              {c.is_current ? (
                <StatusBadge label="Đang dùng" tone="success" />
              ) : (
                <StatusBadge label="Cũ" tone="muted" />
              )}
            </td>
            <td>
              {!c.is_current && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => restore(c)}
                >
                  <History /> Khôi phục
                </Button>
              )}
            </td>
          </tr>
        ))}
        {charts.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center text-muted-foreground">
              Chưa có phiên bản sơ đồ nào.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
