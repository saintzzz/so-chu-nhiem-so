"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";

interface Notif {
  id: string;
  type: string | null;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  signoff: "Sổ chủ nhiệm",
  appointment: "Lịch hẹn",
  message: "Tin nhắn",
  incident: "Sự cố",
  announcement: "Thông báo",
};

export function NotificationsClient({
  notifications: initial,
}: {
  notifications: Notif[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const unread = items.filter((n) => !n.read_at).length;

  async function markAllRead() {
    setBusy(true);
    const supabase = createClient();
    const at = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ read_at: at })
      .is("read_at", null);
    setItems((ns) => ns.map((n) => ({ ...n, read_at: n.read_at ?? at })));
    setBusy(false);
  }

  async function open(n: Notif) {
    if (!n.read_at) {
      const supabase = createClient();
      const at = new Date().toISOString();
      await supabase
        .from("notifications")
        .update({ read_at: at })
        .eq("id", n.id);
      setItems((ns) =>
        ns.map((x) => (x.id === n.id ? { ...x, read_at: at } : x)),
      );
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unread > 0 ? `${unread} thông báo chưa đọc` : "Đã đọc hết"}
        </p>
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={markAllRead}
          >
            <CheckCheck /> Đánh dấu đã đọc tất cả
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
          <Bell className="mx-auto mb-2 size-6 text-muted-foreground/50" />
          Chưa có thông báo nào.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
          {items.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => void open(n)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  !n.read_at && "bg-primary-bg/40",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    n.read_at ? "bg-border" : "bg-primary",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        !n.read_at && "font-semibold",
                      )}
                    >
                      {n.title}
                    </span>
                    {n.type && (
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {TYPE_LABELS[n.type] ?? n.type}
                      </span>
                    )}
                  </span>
                  {n.body && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {n.body}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(n.created_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
