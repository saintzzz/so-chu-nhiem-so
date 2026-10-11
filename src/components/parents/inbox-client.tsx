"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn, fmtDateTimeVN } from "@/lib/utils";
import { olderMessagesPredicate } from "@/lib/chat";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRowsIn } from "@/lib/supabase/fetch-all";
import {
  markMessageRead,
  replyMessage,
} from "@/app/(app)/parents/actions";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

export interface InboxMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  studentId: string | null;
  studentName: string | null;
  content: string;
  /** ISO timestamp - render qua fmtDateTimeVN, dung lam cursor load-more. */
  createdAt: string;
  read: boolean;
}

const PAGE_SIZE = 50;

interface RawMessageRow {
  id: string;
  sender_id: string;
  student_id: string | null;
  content: string;
  read_at: string | null;
  created_at: string;
}

export function InboxClient({
  messages,
  meId,
  initialHasMore = false,
}: {
  messages: InboxMessageItem[];
  meId: string;
  initialHasMore?: boolean;
}) {
  const [items, setItems] = useState<InboxMessageItem[]>(messages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    messages[0]?.id ?? null,
  );
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(messages.filter((m) => m.read).map((m) => m.id)),
  );
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selected = items.find((m) => m.id === selectedId) ?? null;

  async function openMessage(m: InboxMessageItem) {
    setSelectedId(m.id);
    setReply("");
    setFeedback(null);
    if (!readIds.has(m.id)) {
      // r22 L: chi danh dau da doc khi action thanh cong - rollback trang
      // thai optimistic va bao loi de cham chua doc khong bien mat gia.
      // r26 L: action cung co the REJECT (getProfile throw, mat ket noi) -
      // catch de rollback nhu nhanh {error}.
      setReadIds((prev) => new Set(prev).add(m.id));
      let failed = false;
      try {
        const res = await markMessageRead(m.id);
        failed = Boolean(res?.error);
      } catch {
        failed = true;
      }
      if (failed) {
        setReadIds((prev) => {
          const next = new Set(prev);
          next.delete(m.id);
          return next;
        });
        setFeedback("Không đánh dấu được đã đọc - vui lòng thử lại.");
      }
    }
  }

  // R10-02: tin cu hon trang dau van phai xem duoc - cursor (created_at, id).
  async function loadMore() {
    const oldest = items[items.length - 1];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("messages")
      .select("id,sender_id,recipient_id,student_id,content,read_at,created_at")
      .eq("recipient_id", meId)
      .or(olderMessagesPredicate(oldest.createdAt, oldest.id))
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    if (err) {
      console.error("[inbox-client] load more messages:", err.message);
      setLoadError("Không tải được tin nhắn cũ - vui lòng thử lại.");
      setLoadingMore(false);
      return;
    }
    const rows = (data ?? []) as RawMessageRow[];
    // Resolve ten nguoi gui / hoc sinh cho trang moi (khong co san map).
    const senderIds = [...new Set(rows.map((r) => r.sender_id))];
    const studentIds = [
      ...new Set(
        rows.map((r) => r.student_id).filter((x): x is string => !!x),
      ),
    ];
    const [
      { rows: senders, error: sendersErr, truncated: sendersTrunc },
      { rows: students, error: studentsErr, truncated: studentsTrunc },
    ] = await Promise.all([
      senderIds.length
        ? // r26: .in chunk + phan trang - hop thu dai co the >1000 sender.
          fetchAllRowsIn<{ id: string; full_name: string }>(
            (chunk, f, t) =>
              supabase
                .from("profiles")
                .select("id,full_name")
                .in("id", chunk)
                .order("id")
                .range(f, t),
            senderIds,
          )
        : Promise.resolve({ rows: [], error: null, truncated: false }),
      studentIds.length
        ? fetchAllRowsIn<{ id: string; full_name: string }>(
            (chunk, f, t) =>
              supabase
                .from("students")
                .select("id,full_name")
                .in("id", chunk)
                .order("id")
                .range(f, t),
            studentIds,
          )
        : Promise.resolve({ rows: [], error: null, truncated: false }),
    ]);
    // r24: loi resolve ten -> hien loi thay vi render tin nhan voi ten
    // fallback "Phu huynh" sai nguoi gui.
    if (sendersErr || studentsErr || sendersTrunc || studentsTrunc) {
      console.error(
        "[inbox-client] name lookup:",
        sendersErr ?? studentsErr ?? "truncated",
      );
      setLoadError("Không tải được tin nhắn cũ - vui lòng thử lại.");
      setLoadingMore(false);
      return;
    }
    const senderName = new Map(
      ((senders ?? []) as { id: string; full_name: string }[]).map((s) => [
        s.id,
        s.full_name,
      ]),
    );
    const studentName = new Map(
      ((students ?? []) as { id: string; full_name: string }[]).map((s) => [
        s.id,
        s.full_name,
      ]),
    );
    const more: InboxMessageItem[] = rows.map((r) => ({
      id: r.id,
      senderId: r.sender_id,
      senderName: senderName.get(r.sender_id) ?? "Phụ huynh",
      studentId: r.student_id,
      studentName: r.student_id
        ? (studentName.get(r.student_id) ?? null)
        : null,
      content: r.content,
      createdAt: r.created_at,
      read: !!r.read_at,
    }));
    setItems((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...prev, ...more.filter((m) => !seen.has(m.id))];
    });
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const m of more) if (m.read) next.add(m.id);
      return next;
    });
    if (rows.length < PAGE_SIZE) setHasMore(false);
    setLoadingMore(false);
  }

  async function handleReply() {
    if (!selected) return;
    setPending(true);
    setFeedback(null);
    // r27 M: chot draft tai luc bam gui - response ve cham chi duoc xoa
    // draft neu nguoi dung chua go them / chua chuyen tin khac (draft da
    // thay so voi ban da gui thi giu nguyen).
    const sentDraft = reply;
    const res = await replyMessage({
      recipientId: selected.senderId,
      studentId: selected.studentId,
      content: sentDraft,
    });
    setPending(false);
    // r26 M: tin nhan da commit (committed=true) -> xoa draft ngay, ke ca
    // khi kem loi notification - neu giu draft thi retry tao tin trung.
    if (res.committed) {
      setReply((prev) => (prev === sentDraft ? "" : prev));
      setFeedback(res.error ?? "Đã gửi phản hồi.");
    } else {
      setFeedback(res.error ?? "Không gửi được phản hồi.");
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
        Chưa có tin nhắn phản hồi nào từ phụ huynh.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Hộp thư ({items.length})
        </div>
        <ul className="max-h-[480px] divide-y divide-border overflow-y-auto">
          {items.map((m) => {
            const unread = !readIds.has(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => openMessage(m)}
                  className={cn(
                    "block w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
                    selectedId === m.id && "bg-primary-bg",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        unread ? "font-semibold" : "font-medium",
                      )}
                    >
                      {m.senderName}
                    </span>
                    {unread && (
                      <span className="size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {m.studentName ? `HS: ${m.studentName} · ` : ""}
                    {m.content}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {fmtDateTimeVN(m.createdAt)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
        {hasMore && (
          <div className="border-t border-border p-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "Đang tải…" : "Xem thêm"}
            </Button>
            {loadError && (
              <p className="mt-1 text-xs text-error">{loadError}</p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        {selected ? (
          <div className="space-y-4">
            <div className="border-b border-border pb-3">
              <p className="text-base font-semibold">{selected.senderName}</p>
              <p className="text-xs text-muted-foreground">
                {fmtDateTimeVN(selected.createdAt)}
                {selected.studentName
                  ? ` · Liên quan đến HS: ${selected.studentName}`
                  : ""}
              </p>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {selected.content}
            </p>
            <div className="border-t border-border pt-3">
              <label className="mb-1.5 block text-sm font-medium">
                Trả lời phụ huynh
              </label>
              <AutoGrowTextarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Nhập nội dung trả lời..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {feedback && (
                <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {feedback}
                </p>
              )}
              <div className="mt-2">
                <Button
                  onClick={handleReply}
                  disabled={pending || !reply.trim()}
                >
                  {pending ? "Đang gửi..." : "Gửi trả lời"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chọn một tin nhắn để xem nội dung.
          </p>
        )}
      </div>
    </div>
  );
}
