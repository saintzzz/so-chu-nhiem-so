"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { announceActivity } from "@/app/(app)/activities/actions";

export interface ApprovedActivity {
  id: string;
  title: string;
  className: string;
  activityDate: string;
  description: string | null;
  registered: number;
  studentCount: number;
}

export function AnnounceList({
  activities,
}: {
  activities: ApprovedActivity[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  async function handleAnnounce(id: string) {
    setPendingId(id);
    const res = await announceActivity(id);
    setPendingId(null);
    setMessages((prev) => ({
      ...prev,
      [id]: res.error
        ? `Lỗi: ${res.error}`
        : `Đã gửi thông báo và đăng ký ${res.registered ?? 0} học sinh.`,
    }));
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
        Chưa có hoạt động nào được phê duyệt. Vui lòng tạo và gửi duyệt kế hoạch
        ở mục &quot;Lập kế hoạch &amp; phê duyệt&quot;.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {activities.map((a) => (
        <div
          key={a.id}
          className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">{a.title}</h3>
              <p className="text-xs text-muted-foreground">
                Lớp {a.className} · {a.activityDate}
              </p>
            </div>
            <StatusBadge
              label={`${a.registered}/${a.studentCount} đã đăng ký`}
              tone={a.registered > 0 ? "primary" : "muted"}
            />
          </div>
          {a.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {a.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleAnnounce(a.id)}
              disabled={pendingId === a.id}
            >
              {pendingId === a.id
                ? "Đang gửi..."
                : "Gửi thông báo & đăng ký"}
            </Button>
          </div>
          {messages[a.id] && (
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {messages[a.id]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
