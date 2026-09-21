"use client";

import { useState } from "react";
import { CalendarClock, MessageSquare, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { fmtDateVN } from "@/lib/utils";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import {
  bookAppointment,
  replyToTeacher,
  registerActivity,
  reportActivityAbsence,
} from "@/app/portal/parent/actions";

export type PortalMessage = {
  id: string;
  sender_id: string;
  senderName: string;
  content: string;
  created_at: string;
};

export type PortalActivity = {
  id: string;
  title: string;
  activity_date: string;
  status: string | null;
};

export function ParentActions({
  studentId,
  teacherId,
  teacherName,
  messages,
  activities,
}: {
  studentId: string;
  teacherId: string | null;
  teacherName: string;
  messages: PortalMessage[];
  activities: PortalActivity[];
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [apptAt, setApptAt] = useState("");
  const [apptPurpose, setApptPurpose] = useState("");
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  async function submitAppointment() {
    if (!teacherId || !apptAt || !apptPurpose.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await bookAppointment({
      teacherId,
      studentId,
      scheduledAt: new Date(apptAt).toISOString(),
      purpose: apptPurpose,
    });
    setMessage(res.error ?? "Đã gửi yêu cầu lịch hẹn. Giáo viên sẽ xác nhận.");
    if (!res.error) {
      setApptAt("");
      setApptPurpose("");
    }
    setBusy(false);
  }

  async function submitReply(recipientId: string) {
    if (!reply.trim()) return;
    setBusy(true);
    const res = await replyToTeacher({
      recipientId,
      studentId,
      content: reply,
    });
    setMessage(res.error ?? "Đã gửi tin nhắn cho giáo viên.");
    if (!res.error) {
      setReply("");
      setReplyTo(null);
    }
    setBusy(false);
  }

  async function toggleActivity(a: PortalActivity) {
    setBusy(true);
    setMessage(null);
    const res =
      a.status === "registered"
        ? await reportActivityAbsence({ activityId: a.id, studentId })
        : await registerActivity({ activityId: a.id, studentId });
    setMessage(
      res.error ??
        (a.status === "registered"
          ? "Đã báo con vắng hoạt động."
          : "Đã đăng ký tham gia hoạt động."),
    );
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
          {message}
        </p>
      )}

      {teacherId && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <CalendarClock className="size-4 text-muted-foreground" />
            Đặt lịch hẹn với GVCN ({teacherName})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="datetime-local"
              value={apptAt}
              onChange={(e) => setApptAt(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              aria-label="Thời điểm hẹn"
            />
            <input
              value={apptPurpose}
              onChange={(e) => setApptPurpose(e.target.value)}
              placeholder="Mục đích (ví dụ: Trao đổi kết quả học tập)"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              onClick={submitAppointment}
              disabled={busy || !apptAt || !apptPurpose.trim()}
            >
              Gửi yêu cầu
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="size-4 text-muted-foreground" />
          Tin nhắn từ giáo viên
        </h2>
        {messages.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Chưa có tin nhắn nào.
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{m.senderName}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtDateVN(m.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{m.content}</p>
                <div className="mt-2">
                  {replyTo === m.id ? (
                    <div className="space-y-2">
                      <AutoGrowTextarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Nhập nội dung trả lời..."
                        aria-label="Nội dung trả lời"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => submitReply(m.sender_id)}
                          disabled={busy || !reply.trim()}
                        >
                          Gửi
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReplyTo(null)}
                        >
                          Hủy
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReplyTo(m.id)}
                    >
                      Trả lời
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {activities.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <ClipboardList className="size-4 text-muted-foreground" />
            Hoạt động giáo dục
          </h2>
          <ul className="space-y-2">
            {activities.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDateVN(a.activity_date)}
                  </p>
                </div>
                {a.status === "registered" ? (
                  <div className="flex items-center gap-2">
                    <StatusBadge label="Đã đăng ký" tone="success" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActivity(a)}
                      disabled={busy}
                    >
                      Báo vắng
                    </Button>
                  </div>
                ) : a.status === "excused" ? (
                  <div className="flex items-center gap-2">
                    <StatusBadge label="Đã báo vắng" tone="warning" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActivity(a)}
                      disabled={busy}
                    >
                      Đăng ký lại
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => toggleActivity(a)}
                    disabled={busy}
                  >
                    Đăng ký
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
