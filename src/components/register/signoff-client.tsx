"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import type { Signoff } from "./types";

const STATUS_META: Record<string, { label: string; tone: "warning" | "success" | "muted" | "error" }> = {
  pending: { label: "Chờ ký", tone: "warning" },
  signed: { label: "Đã ký", tone: "success" },
  locked: { label: "Đã khóa", tone: "muted" },
  rejected: { label: "Từ chối", tone: "error" },
};

export function SignoffClient({
  signoffs: initialSignoffs,
  classNames,
  signerNames,
  profileId,
}: {
  signoffs: Signoff[];
  classNames: Record<string, string>;
  signerNames: Record<string, string>;
  profileId: string;
}) {
  const supabase = createClient();
  const [signoffs, setSignoffs] = useState<Signoff[]>(initialSignoffs);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sign(row: Signoff) {
    setBusy(true);
    setMessage(null);
    const signedAt = new Date().toISOString();
    const { error } = await supabase
      .from("register_signoffs")
      .update({ status: "signed", signed_at: signedAt, signed_by: profileId })
      .eq("id", row.id);
    if (error) {
      setMessage("Không thể ký duyệt.");
    } else {
      setSignoffs((ss) =>
        ss.map((s) =>
          s.id === row.id
            ? { ...s, status: "signed", signed_at: signedAt, signed_by: profileId }
            : s,
        ),
      );
      setMessage(
        `Đã ký duyệt sổ chủ nhiệm lớp ${classNames[row.class_id] ?? ""} kỳ ${row.period}.`,
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
        columns={["Lớp", "Kỳ", "Trạng thái", "Người ký", "Thời điểm", "Hành động"]}
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
                {s.signed_by ? (signerNames[s.signed_by] ?? "—") : "—"}
              </td>
              <td className="text-muted-foreground">
                {s.signed_at
                  ? new Date(s.signed_at).toLocaleString("vi-VN")
                  : "—"}
              </td>
              <td>
                {s.status === "pending" && (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => sign(s)}
                  >
                    <PenLine /> Ký duyệt
                  </Button>
                )}
              </td>
            </tr>
          );
        })}
        {signoffs.length === 0 && (
          <tr>
            <td colSpan={6} className="text-center text-muted-foreground">
              Chưa có đợt ký duyệt nào.
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
