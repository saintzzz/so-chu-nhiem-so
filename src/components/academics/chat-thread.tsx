"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import { mergeChatMessages, olderMessagesPredicate } from "@/lib/chat";
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

// Trang lich su tai them moi lan bam "Tải tin nhắn cũ hơn".
const PAGE_SIZE = 100;

/** Generic two-person message thread (GVCN ↔ GVBM / PH / HS). */
export function ChatThread({
  meId,
  peerId,
  peerName,
  studentId,
  messages,
  initialHasOlder = false,
  notifyLink,
}: {
  meId: string;
  peerId: string;
  peerName: string;
  studentId?: string | null;
  /** Trang tin nhắn MỚI NHẤT, đã sắp xếp tăng dần theo thời gian. */
  messages: ChatMessage[];
  /** Server nap trang moi nhat co gioi han - true neu con lich su cu hon. */
  initialHasOlder?: boolean;
  /** Route nguoi NHAN mo khi bam thong bao - theo role cua peer. */
  notifyLink: string;
}) {
  const [items, setItems] = useState<ChatMessage[]>(messages);
  const [hasOlder, setHasOlder] = useState(initialHasOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Hai nhom OR duoc PostgREST AND voi nhau: (cap me/peer) AND (cursor).
  const peerFilter =
    `and(sender_id.eq.${meId},recipient_id.eq.${peerId}),` +
    `and(sender_id.eq.${peerId},recipient_id.eq.${meId})`;

  async function loadOlder() {
    const oldest = items[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("messages")
      .select("id,sender_id,recipient_id,student_id,content,read_at,created_at")
      .or(peerFilter)
      .or(olderMessagesPredicate(oldest.created_at, oldest.id))
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE);
    setLoadingOlder(false);
    if (err) {
      console.error("[chat-thread] load older messages:", err.message);
      setError("Không tải được tin nhắn cũ - vui lòng thử lại.");
      return;
    }
    const older = (data ?? []) as ChatMessage[];
    setItems((prev) => mergeChatMessages(prev, older));
    if (older.length < PAGE_SIZE) setHasOlder(false);
    setError(null);
  }

  function send() {
    const text = content.trim();
    if (!text) return;
    startTransition(async () => {
      const supabase = createClient();
      // Append local thay vi refresh lai server props - refresh se nap trang
      // moi nhat va lam mat lich su cu vua tai bang "Tải tin nhắn cũ hơn".
      const { data: inserted, error: err } = await supabase
        .from("messages")
        .insert({
          sender_id: meId,
          recipient_id: peerId,
          student_id: studentId ?? null,
          content: text,
        })
        .select("id,sender_id,recipient_id,student_id,content,read_at,created_at")
        .single();
      if (err) {
        console.error("[chat-thread] send message:", err.message);
        setError("Không gửi được tin nhắn - vui lòng thử lại.");
        return;
      }
      await supabase.from("notifications").insert({
        profile_id: peerId,
        type: "message",
        title: "Tin nhắn mới",
        body: text.slice(0, 120),
        link: notifyLink,
      });
      if (inserted) {
        setItems((prev) => mergeChatMessages(prev, [inserted as ChatMessage]));
      }
      setContent("");
      setError(null);
    });
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium">Trao đổi với {peerName}</p>
      </div>
      <div className="flex max-h-[28rem] min-h-40 flex-col gap-2 overflow-y-auto p-4">
        {hasOlder && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
            >
              {loadingOlder ? "Đang tải…" : "Tải tin nhắn cũ hơn"}
            </Button>
          </div>
        )}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Chưa có tin nhắn nào. Hãy bắt đầu cuộc trao đổi.
          </p>
        )}
        {items.map((m) => {
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
