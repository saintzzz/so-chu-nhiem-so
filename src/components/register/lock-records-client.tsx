"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { Lock, PlusCircle, Send, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { CURRENT_PERIOD, type Signoff } from "./types";
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

export function LockRecordsClient({
  signoffs: initialSignoffs,
  classes,
  classNames,
  profileId,
  role,
}: {
  signoffs: Signoff[];
  classes: { id: string; name: string }[];
  classNames: Record<string, string>;
  profileId: string;
  role: "gvcn" | "bgh";
}) {
  const supabase = createClient();
  const [signoffs, setSignoffs] = useState<Signoff[]>(initialSignoffs);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isBgh = role === "bgh";

  /** GVCN nộp sổ học bạ lên BGH (pending/rejected -> submitted). */
  async function submit(row: Signoff) {
    setBusy(true);
    setMessage(null);
    const at = new Date().toISOString();
    const { error } = await supabase
      .from("register_signoffs")
      .update({ status: "submitted", submitted_at: at, submitted_by: profileId })
      .eq("id", row.id);
    if (error) {
      setMessage("Không thể nộp sổ học bạ.");
    } else {
      setSignoffs((ss) =>
        ss.map((s) =>
          s.id === row.id
            ? { ...s, status: "submitted", submitted_at: at, submitted_by: profileId }
            : s,
        ),
      );
      setMessage(
        `Đã nộp sổ học bạ lớp ${classNames[row.class_id] ?? ""} kỳ ${row.period} lên Ban Giám Hiệu.`,
      );
      logAudit(supabase, {
        action: "Nộp sổ học bạ",
        entity: "register_signoffs",
        entityId: row.id,
        payload: { class_id: row.class_id, period: row.period },
      });
    }
    setBusy(false);
  }

  /** BGH duyệt & khóa (submitted -> locked) - sau khi khóa không chỉnh sửa. */
  async function lock(row: Signoff) {
    setBusy(true);
    setMessage(null);
    const at = new Date().toISOString();
    const { error } = await supabase
      .from("register_signoffs")
      .update({ status: "locked", signed_at: at, signed_by: profileId })
      .eq("id", row.id);
    if (error) {
      setMessage("Không thể khóa sổ học bạ.");
    } else {
      setSignoffs((ss) =>
        ss.map((s) =>
          s.id === row.id
            ? { ...s, status: "locked", signed_by: profileId, signed_at: at }
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

  /** BGH từ chối - trả sổ về GVCN (submitted -> rejected). */
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
        `Đã từ chối sổ học bạ lớp ${classNames[row.class_id] ?? ""} kỳ ${row.period} - GVCN cần nộp lại.`,
      );
      logAudit(supabase, {
        action: "Từ chối sổ học bạ",
        entity: "register_signoffs",
        entityId: row.id,
        payload: { class_id: row.class_id, period: row.period },
      });
    }
    setBusy(false);
  }

  /** BGH mở đợt duyệt cho các lớp trong kỳ. */
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

  const awaiting = signoffs.filter(
    (s) => s.status === "pending" || s.status === "rejected",
  ).length;
  const awaitingBgh = signoffs.filter((s) => s.status === "submitted").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {isBgh
            ? `${awaitingBgh} đợt chờ BGH duyệt · ${awaiting} lớp chưa nộp`
            : `${awaiting} kỳ cần nộp · ${awaitingBgh} kỳ đang chờ BGH duyệt`}
        </p>
        {isBgh && (
          <Button
            variant="outline"
            onClick={createBatch}
            disabled={busy || classes.length === 0}
          >
            <PlusCircle /> Tạo đợt duyệt
          </Button>
        )}
      </div>

      {message && (
        <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
          {message}
        </p>
      )}

      <DataTable
        columns={["Lớp", "Kỳ", "Trạng thái", "Thời điểm", "Hành động"]}
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
                  : s.submitted_at
                    ? formatDateTime(s.submitted_at)
                    : "-"}
              </td>
              <td>
                {!isBgh &&
                  (s.status === "pending" || s.status === "rejected") && (
                    <Button size="sm" disabled={busy} onClick={() => submit(s)}>
                      <Send /> {s.status === "rejected" ? "Nộp lại" : "Nộp sổ"}
                    </Button>
                  )}
                {isBgh && s.status === "submitted" && (
                  <span className="inline-flex gap-1">
                    <Button size="sm" disabled={busy} onClick={() => lock(s)}>
                      <Lock /> Duyệt & khóa
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
            <td colSpan={5} className="text-center text-muted-foreground">
              {isBgh
                ? "Chưa có đợt duyệt nào - nhấn \"Tạo đợt duyệt\" để bắt đầu."
                : "Chưa có đợt duyệt nào - chờ Ban Giám Hiệu mở đợt."}
            </td>
          </tr>
        )}
      </DataTable>
    </div>
  );
}
