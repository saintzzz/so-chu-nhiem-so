"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { PenLine, PlusCircle, Send, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { CURRENT_MONTH, type Signoff } from "./types";
import { logAudit } from "@/lib/audit";

const STATUS_META: Record<
  string,
  { label: string; tone: "warning" | "success" | "muted" | "error" | "primary" }
> = {
  pending: { label: "Chờ GVCN nộp", tone: "warning" },
  submitted: { label: "Chờ BGH duyệt", tone: "primary" },
  signed: { label: "Đã ký", tone: "success" },
  locked: { label: "Đã khóa", tone: "muted" },
  rejected: { label: "Bị từ chối", tone: "error" },
};

export function SignoffClient({
  signoffs: initialSignoffs,
  classes,
  classNames,
  signerNames,
  profileId,
  profileName,
  role,
}: {
  signoffs: Signoff[];
  classes: { id: string; name: string }[];
  classNames: Record<string, string>;
  /** Tên cho cả người nộp lẫn người ký (submitted_by + signed_by). */
  signerNames: Record<string, string>;
  profileId: string;
  profileName: string;
  role: "gvcn" | "bgh";
}) {
  const supabase = createClient();
  const [signoffs, setSignoffs] = useState<Signoff[]>(initialSignoffs);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isBgh = role === "bgh";

  /** BGH mở đợt ký duyệt cho các lớp trong kỳ hiện tại. */
  async function createBatch() {
    setBusy(true);
    setMessage(null);
    const existing = new Set(signoffs.map((s) => `${s.class_id}|${s.period}`));
    const rows = classes
      .map((c) => ({
        class_id: c.id,
        period: CURRENT_MONTH,
        type: "so_chu_nhiem" as const,
        status: "pending" as const,
      }))
      .filter((r) => !existing.has(`${r.class_id}|${r.period}`));
    if (rows.length === 0) {
      setMessage(`Đợt ký duyệt kỳ "${CURRENT_MONTH}" đã tồn tại cho tất cả lớp.`);
      setBusy(false);
      return;
    }
    const { data, error } = await supabase
      .from("register_signoffs")
      .insert(rows)
      .select();
    if (!error && data) {
      setSignoffs((ss) => [...ss, ...(data as Signoff[])]);
      setMessage(`Đã tạo đợt ký duyệt "${CURRENT_MONTH}" cho ${rows.length} lớp.`);
      logAudit(supabase, {
        action: "Tạo đợt ký duyệt sổ chủ nhiệm",
        entity: "register_signoffs",
        payload: { period: CURRENT_MONTH, classes: rows.length },
      });
    } else {
      setMessage("Không thể tạo đợt ký duyệt.");
    }
    setBusy(false);
  }

  /** GVCN nộp sổ lên BGH (pending/rejected -> submitted). */
  async function submit(row: Signoff) {
    setBusy(true);
    setMessage(null);
    const at = new Date().toISOString();
    const { error } = await supabase
      .from("register_signoffs")
      .update({ status: "submitted", submitted_at: at, submitted_by: profileId })
      .eq("id", row.id);
    if (error) {
      setMessage("Không thể nộp sổ.");
    } else {
      setSignoffs((ss) =>
        ss.map((s) =>
          s.id === row.id
            ? {
                ...s,
                status: "submitted",
                submitted_at: at,
                submitted_by: profileId,
              }
            : s,
        ),
      );
      setMessage(
        `Đã nộp sổ chủ nhiệm lớp ${classNames[row.class_id] ?? ""} kỳ ${row.period} lên Ban Giám Hiệu.`,
      );
      logAudit(supabase, {
        action: "Nộp sổ chủ nhiệm",
        entity: "register_signoffs",
        entityId: row.id,
        payload: { class_id: row.class_id, period: row.period },
      });
    }
    setBusy(false);
  }

  /** BGH ký duyệt (submitted -> signed). */
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
      logAudit(supabase, {
        action: "Ký duyệt sổ chủ nhiệm",
        entity: "register_signoffs",
        entityId: row.id,
        payload: { class_id: row.class_id, period: row.period },
      });
    }
    setBusy(false);
  }

  /** BGH từ chối - trả sổ về cho GVCN (submitted -> rejected). */
  async function reject(row: Signoff) {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("register_signoffs")
      .update({ status: "rejected" })
      .eq("id", row.id);
    if (error) {
      setMessage("Không thể từ chối.");
    } else {
      setSignoffs((ss) =>
        ss.map((s) => (s.id === row.id ? { ...s, status: "rejected" } : s)),
      );
      setMessage(
        `Đã từ chối sổ chủ nhiệm lớp ${classNames[row.class_id] ?? ""} kỳ ${row.period} - GVCN cần chỉnh sửa và nộp lại.`,
      );
      logAudit(supabase, {
        action: "Từ chối sổ chủ nhiệm",
        entity: "register_signoffs",
        entityId: row.id,
        payload: { class_id: row.class_id, period: row.period },
      });
    }
    setBusy(false);
  }

  const awaiting = signoffs.filter(
    (s) => s.status === "pending" || s.status === "rejected",
  ).length;
  const awaitingBgh = signoffs.filter((s) => s.status === "submitted").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {isBgh
            ? `${awaitingBgh} đợt chờ BGH ký duyệt · ${awaiting} lớp chưa nộp`
            : `${awaiting} kỳ cần nộp · ${awaitingBgh} kỳ đang chờ BGH duyệt`}
        </p>
        {isBgh && (
          <Button
            variant="outline"
            onClick={createBatch}
            disabled={busy || classes.length === 0}
          >
            <PlusCircle /> Tạo đợt ký
          </Button>
        )}
      </div>

      {message && (
        <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
          {message}
        </p>
      )}
      <DataTable
        columns={[
          "Lớp",
          "Kỳ",
          "Trạng thái",
          "Người nộp / ký",
          "Thời điểm",
          "Hành động",
        ]}
      >
        {signoffs.map((s) => {
          const meta = STATUS_META[s.status] ?? STATUS_META.pending;
          const actorId = s.signed_by ?? s.submitted_by;
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
                {actorId
                  ? (signerNames[actorId] ??
                    (actorId === profileId ? profileName : "-"))
                  : "-"}
              </td>
              <td className="text-muted-foreground">
                {s.signed_at
                  ? formatDateTime(s.signed_at)
                  : s.submitted_at
                    ? formatDateTime(s.submitted_at)
                    : "-"}
              </td>
              <td>
                {!isBgh && (s.status === "pending" || s.status === "rejected") && (
                  <Button size="sm" disabled={busy} onClick={() => submit(s)}>
                    <Send /> {s.status === "rejected" ? "Nộp lại" : "Nộp sổ"}
                  </Button>
                )}
                {isBgh && s.status === "submitted" && (
                  <span className="inline-flex gap-1">
                    <Button size="sm" disabled={busy} onClick={() => sign(s)}>
                      <PenLine /> Ký duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => reject(s)}
                    >
                      <Undo2 /> Từ chối
                    </Button>
                  </span>
                )}
              </td>
            </tr>
          );
        })}
        {signoffs.length === 0 && (
          <tr>
            <td colSpan={6} className="text-center text-muted-foreground">
              {isBgh
                ? "Chưa có đợt ký duyệt nào - nhấn \"Tạo đợt ký\" để bắt đầu."
                : "Chưa có đợt ký duyệt nào - chờ Ban Giám Hiệu mở đợt ký."}
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
