"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { Lock, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { CURRENT_PERIOD, type Signoff } from "./types";
import { logAudit } from "@/lib/audit";

const STATUS_META: Record<string, { label: string; tone: "warning" | "success" | "muted" | "error" }> = {
  pending: { label: "Chờ duyệt", tone: "warning" },
  signed: { label: "Đã ký", tone: "success" },
  locked: { label: "Đã khóa", tone: "muted" },
  rejected: { label: "Từ chối", tone: "error" },
};

export function LockRecordsClient({
  signoffs: initialSignoffs,
  classes,
  classNames,
  profileId,
}: {
  signoffs: Signoff[];
  classes: { id: string; name: string }[];
  classNames: Record<string, string>;
  profileId: string;
}) {
  const supabase = createClient();
  const [signoffs, setSignoffs] = useState<Signoff[]>(initialSignoffs);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function lock(row: Signoff) {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("register_signoffs")
      .update({
        status: "locked",
        signed_at: new Date().toISOString(),
        signed_by: profileId,
      })
      .eq("id", row.id);
    if (error) {
      setMessage("Không thể khóa sổ học bạ.");
    } else {
      setSignoffs((ss) =>
        ss.map((s) =>
          s.id === row.id
            ? { ...s, status: "locked", signed_by: profileId, signed_at: new Date().toISOString() }
            : s,
        ),
      );
      setMessage(
        `Đã duyệt & khóa sổ học bạ lớp ${classNames[row.class_id] ?? ""} kỳ ${row.period}.`,
      );
      logAudit(supabase, {
        action: "Khóa sổ học bạ",
        entity: "register_signoffs",
        entityId: row.id,
        payload: { class_id: row.class_id, period: row.period },
      });
    }
    setBusy(false);
  }

  async function createBatch() {
    setBusy(true);
    setMessage(null);
    const existing = new Set(signoffs.map((s) => `${s.class_id}|${s.period}`));
    const rows = classes
      .map((c) => ({
        class_id: c.id,
        period: CURRENT_PERIOD,
        type: "so_hoc_ba" as const,
        status: "pending" as const,
      }))
      .filter((r) => !existing.has(`${r.class_id}|${r.period}`));
    if (rows.length === 0) {
      setMessage(`Đợt duyệt kỳ "${CURRENT_PERIOD}" đã tồn tại cho tất cả lớp.`);
      setBusy(false);
      return;
    }
    const { data, error } = await supabase
      .from("register_signoffs")
      .insert(rows)
      .select();
    if (!error && data) {
      setSignoffs((ss) => [...ss, ...(data as Signoff[])]);
      setMessage(`Đã tạo đợt duyệt "${CURRENT_PERIOD}" cho ${rows.length} lớp.`);
      logAudit(supabase, {
        action: "Tạo đợt duyệt sổ học bạ",
        entity: "register_signoffs",
        payload: { period: CURRENT_PERIOD, classes: rows.length },
      });
    } else {
      setMessage("Không thể tạo đợt duyệt.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {signoffs.filter((s) => s.status === "pending").length} đợt chờ duyệt
        </p>
        <Button variant="outline" onClick={createBatch} disabled={busy || classes.length === 0}>
          <PlusCircle /> Tạo đợt duyệt
        </Button>
      </div>

      {message && (
        <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
          {message}
        </p>
      )}

      <DataTable
        columns={["Lớp", "Kỳ", "Trạng thái", "Thời điểm khóa", "Hành động"]}
      >
        {signoffs.map((s) => {
          const meta = STATUS_META[s.status] ?? STATUS_META.pending;
          return (
            <tr key={s.id}>
              <td className="font-medium">
                {classNames[s.class_id] ?? s.class_id}
              </td>
              <td>{s.period}</td>
              <td>
                <StatusBadge label={meta.label} tone={meta.tone} />
              </td>
              <td className="text-muted-foreground">
                {s.signed_at
                  ? formatDateTime(s.signed_at)
                  : "-"}
              </td>
              <td>
                {s.status !== "locked" && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => lock(s)}
                  >
                    <Lock /> Duyệt & khóa
                  </Button>
                )}
              </td>
            </tr>
          );
        })}
        {signoffs.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center text-muted-foreground">
              Chưa có đợt duyệt nào - nhấn &quot;Tạo đợt duyệt&quot; để bắt đầu.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
