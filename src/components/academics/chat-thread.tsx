"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";

export interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  student_id: string | null;
  content: string;
  read_at: string | null;
  created_at: string;
}

/** Generic two-person message thread (GVCN ↔ GVBM / PH / HS). */
export function ChatThread({
  meId,
  peerId,
  peerName,
  studentId,
  messages,
}: {
  meId: string;
  peerId: string;
  peerName: string;
  studentId?: string | null;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function send() {
    const text = content.trim();
    if (!text) return;
    startTransition(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.from("messages").insert({
        sender_id: meId,
        recipient_id: peerId,
        student_id: studentId ?? null,
        content: text,
      });
      if (err) {
        setError(err.message);
        return;
      }
      await supabase.from("notifications").insert({
        profile_id: peerId,
        type: "message",
        title: "Tin nhắn mới",
        body: text.slice(0, 120),
        link: window.location.pathname,
      });
      setContent("");
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium">Trao đổi với {peerName}</p>
      </div>
      <div className="flex max-h-[28rem] min-h-40 flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Chưa có tin nhắn nào. Hãy bắt đầu cuộc trao đổi.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div
              key={m.id}
              className={cn(
                "max-w-[75%] rounded-xl px-3 py-2 text-sm",
                mine
                  ? "self-end bg-primary text-primary-foreground"
                  : "self-start bg-muted text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              <p
                className={cn(
                  "mt-1 text-[10px]",
                  mine ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                {formatDateTime(m.created_at)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex items-end gap-2 border-t border-border p-3">
        <AutoGrowTextarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nhập nội dung trao đổi…"
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <Button onClick={send} disabled={pending || !content.trim()}>
          {pending ? "Đang gửi…" : "Gửi"}
        </Button>
      </div>
      {error && <p className="px-3 pb-3 text-xs text-error">{error}</p>}
    </div>
  );
}
