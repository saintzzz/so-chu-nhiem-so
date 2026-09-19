"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  createdAt: string;
  read: boolean;
}

export function InboxClient({ messages }: { messages: InboxMessageItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    messages[0]?.id ?? null,
  );
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(messages.filter((m) => m.read).map((m) => m.id)),
  );
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selected = messages.find((m) => m.id === selectedId) ?? null;

  async function openMessage(m: InboxMessageItem) {
    setSelectedId(m.id);
    setReply("");
    setFeedback(null);
    if (!readIds.has(m.id)) {
      setReadIds((prev) => new Set(prev).add(m.id));
      await markMessageRead(m.id);
    }
  }

  async function handleReply() {
    if (!selected) return;
    setPending(true);
    setFeedback(null);
    const res = await replyMessage({
      recipientId: selected.senderId,
      studentId: selected.studentId,
      content: reply,
    });
    setPending(false);
    if (res.error) {
      setFeedback(res.error);
    } else {
      setReply("");
      setFeedback("Đã gửi phản hồi.");
    }
  }

  if (messages.length === 0) {
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
          Hộp thư ({messages.length})
        </div>
        <ul className="max-h-[480px] divide-y divide-border overflow-y-auto">
          {messages.map((m) => {
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
                    {m.createdAt}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        {selected ? (
          <div className="space-y-4">
            <div className="border-b border-border pb-3">
              <p className="text-base font-semibold">{selected.senderName}</p>
              <p className="text-xs text-muted-foreground">
                {selected.createdAt}
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
