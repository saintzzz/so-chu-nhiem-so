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
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

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
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const isBgh = role === "bgh";

  /** Thông báo cho toàn bộ BGH trong trường (khi GVCN nộp sổ). */
  async function notifyBgh(title: string, body: string) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "bgh");
    const rows = ((data ?? []) as { id: string }[]).filter(
      (p) => p.id !== profileId,
    );
    if (rows.length === 0) return;
    await supabase.from("notifications").insert(
      rows.map((p) => ({
        profile_id: p.id,
        type: "signoff",
        title,
        body,
        link: "/register/signoff",
      })),
    );
  }

  /** Thông báo cho GVCN đã nộp sổ (khi BGH ký / từ chối). */
  async function notifySubmitter(row: Signoff, title: string, body: string) {
    if (!row.submitted_by || row.submitted_by === profileId) return;
    await supabase.from("notifications").insert({
      profile_id: row.submitted_by,
      type: "signoff",
      title,
      body,
      link: "/register/signoff",
    });
  }

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
      await notifyBgh(
        `Sổ chủ nhiệm lớp ${classNames[row.class_id] ?? ""} đã được nộp`,
        `${profileName} đã nộp sổ chủ nhiệm kỳ ${row.period} - chờ BGH ký duyệt.`,
      );
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
      await notifySubmitter(
        row,
        `Sổ chủ nhiệm lớp ${classNames[row.class_id] ?? ""} đã được ký duyệt`,
        `Ban Giám Hiệu đã ký duyệt sổ chủ nhiệm kỳ ${row.period}.`,
      );
    }
    setBusy(false);
  }

  /** BGH từ chối - trả sổ về cho GVCN (submitted -> rejected) kèm lý do. */
  async function confirmReject(row: Signoff) {
    const reason = rejectReason.trim();
    if (!reason) {
      setMessage("Vui lòng nhập lý do từ chối để GVCN biết cần sửa gì.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("register_signoffs")
      .update({ status: "rejected", reject_reason: reason })
      .eq("id", row.id);
    if (error) {
      setMessage("Không thể từ chối.");
    } else {
      setSignoffs((ss) =>
        ss.map((s) =>
          s.id === row.id
            ? { ...s, status: "rejected", reject_reason: reason }
            : s,
        ),
      );
      setMessage(
        `Đã từ chối sổ chủ nhiệm lớp ${classNames[row.class_id] ?? ""} kỳ ${row.period} - GVCN cần chỉnh sửa và nộp lại.`,
      );
      logAudit(supabase, {
        action: "Từ chối sổ chủ nhiệm",
        entity: "register_signoffs",
        entityId: row.id,
        payload: {
          class_id: row.class_id,
          period: row.period,
          reason,
        },
      });
      await notifySubmitter(
        row,
        `Sổ chủ nhiệm lớp ${classNames[row.class_id] ?? ""} bị từ chối`,
        `Kỳ ${row.period}: ${reason}`,
      );
    }
    setRejectingId(null);
    setRejectReason("");
    setBusy(false);
  }

  /** GVCN nộp tất cả sổ pending/rejected cùng lúc. */
  async function submitAll() {
    const targets = signoffs.filter(
      (s) => s.status === "pending" || s.status === "rejected",
    );
    if (targets.length === 0) return;
    setBusy(true);
    setMessage(null);
    const at = new Date().toISOString();
    const ids = targets.map((s) => s.id);
    const { error } = await supabase
      .from("register_signoffs")
      .update({ status: "submitted", submitted_at: at, submitted_by: profileId })
      .in("id", ids);
    if (error) {
      setMessage("Không thể nộp sổ hàng loạt.");
    } else {
      setSignoffs((ss) =>
        ss.map((s) =>
          ids.includes(s.id)
            ? {
                ...s,
                status: "submitted",
                submitted_at: at,
                submitted_by: profileId,
              }
            : s,
        ),
      );
      setMessage(`Đã nộp ${targets.length} sổ chủ nhiệm lên Ban Giám Hiệu.`);
      logAudit(supabase, {
        action: "Nộp sổ chủ nhiệm hàng loạt",
        entity: "register_signoffs",
        payload: { count: targets.length },
      });
      await notifyBgh(
        `${targets.length} sổ chủ nhiệm vừa được nộp`,
        `${profileName} đã nộp ${targets.length} sổ chủ nhiệm - chờ BGH ký duyệt.`,
      );
    }
    setBusy(false);
  }

  /** BGH ký duyệt tất cả sổ đang chờ (submitted -> signed). */
  async function signAll() {
    const targets = signoffs.filter((s) => s.status === "submitted");
    if (targets.length === 0) return;
    setBusy(true);
    setMessage(null);
    const signedAt = new Date().toISOString();
    const ids = targets.map((s) => s.id);
    const { error } = await supabase
      .from("register_signoffs")
      .update({ status: "signed", signed_at: signedAt, signed_by: profileId })
      .in("id", ids);
    if (error) {
      setMessage("Không thể ký duyệt hàng loạt.");
    } else {
      setSignoffs((ss) =>
        ss.map((s) =>
          ids.includes(s.id)
            ? { ...s, status: "signed", signed_at: signedAt, signed_by: profileId }
            : s,
        ),
      );
      setMessage(`Đã ký duyệt ${targets.length} sổ chủ nhiệm.`);
      logAudit(supabase, {
        action: "Ký duyệt sổ chủ nhiệm hàng loạt",
        entity: "register_signoffs",
        payload: { count: targets.length },
      });
      for (const row of targets) {
        await notifySubmitter(
          row,
          `Sổ chủ nhiệm lớp ${classNames[row.class_id] ?? ""} đã được ký duyệt`,
          `Ban Giám Hiệu đã ký duyệt sổ chủ nhiệm kỳ ${row.period}.`,
        );
      }
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
        <span className="inline-flex gap-2">
          {!isBgh && awaiting >= 2 && (
            <Button variant="outline" onClick={submitAll} disabled={busy}>
              <Send /> Nộp tất cả ({awaiting})
            </Button>
          )}
          {isBgh && awaitingBgh >= 2 && (
            <Button variant="outline" onClick={signAll} disabled={busy}>
              <PenLine /> Ký duyệt tất cả ({awaitingBgh})
            </Button>
          )}
          {isBgh && (
            <Button
              variant="outline"
              onClick={createBatch}
              disabled={busy || classes.length === 0}
            >
              <PlusCircle /> Tạo đợt ký
            </Button>
          )}
        </span>
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
                  <div>
                    {s.status === "rejected" && s.reject_reason && (
                      <p className="mb-1 max-w-xs text-xs text-error">
                        Lý do: {s.reject_reason}
                      </p>
                    )}
                    <Button size="sm" disabled={busy} onClick={() => submit(s)}>
                      <Send /> {s.status === "rejected" ? "Nộp lại" : "Nộp sổ"}
                    </Button>
                  </div>
                )}
                {isBgh && s.status === "submitted" && (
                  <div>
                    <span className="inline-flex gap-1">
                      <Button size="sm" disabled={busy} onClick={() => sign(s)}>
                        <PenLine /> Ký duyệt
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          setRejectingId(s.id);
                          setRejectReason(s.reject_reason ?? "");
                        }}
                      >
                        <Undo2 /> Từ chối
                      </Button>
                    </span>
                    {rejectingId === s.id && (
                      <div className="mt-2 flex items-start gap-2">
                        <AutoGrowTextarea
                          bare
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Lý do từ chối (bắt buộc)..."
                          className="w-64"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => confirmReject(s)}
                        >
                          Xác nhận
                        </Button>
                      </div>
                    )}
                  </div>
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
