"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { sortByVietnameseName } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export function NotifyForm({
  classId,
  className,
  senderId,
  students: rawStudents,
}: {
  classId: string;
  className: string;
  senderId: string;
  students: { id: string; fullName: string; code: string }[];
}) {
  const students = sortByVietnameseName(rawStudents, (s) => s.fullName);
  const router = useRouter();
  const [target, setTarget] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!title.trim() || !content.trim()) {
      setFeedback({ ok: false, text: "Vui lòng nhập tiêu đề và nội dung." });
      return;
    }
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.from("announcements").insert({
      sender_id: senderId,
      class_id: classId,
      student_id: target === "all" ? null : target,
      title: title.trim(),
      content: content.trim(),
    });
    setSending(false);
    if (error) {
      setFeedback({ ok: false, text: `Gửi thất bại: ${error.message}` });
      return;
    }
    setTitle("");
    setContent("");
    setTarget("all");
    setFeedback({ ok: true, text: "Đã gửi thông báo đến phụ huynh." });
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]"
    >
      <div>
        <label htmlFor="nf-target" className="mb-1.5 block text-sm font-medium">
          Gửi đến
        </label>
        <select
          id="nf-target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={inputCls}
        >
          <option value="all">Toàn bộ phụ huynh lớp {className}</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              PH em {s.fullName} ({s.code})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="nf-title" className="mb-1.5 block text-sm font-medium">
          Tiêu đề
        </label>
        <input
          id="nf-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: Thông báo em vắng học không phép"
          className={inputCls}
          required
        />
      </div>
      <div>
        <label htmlFor="nf-content" className="mb-1.5 block text-sm font-medium">
          Nội dung
        </label>
        <textarea
          id="nf-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="Kính gửi quý phụ huynh..."
          className={inputCls}
          required
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={sending}>
          {sending ? "Đang gửi..." : "Gửi thông báo"}
        </Button>
        {feedback && (
          <span
            className={
              feedback.ok
                ? "rounded-lg bg-success-bg px-3 py-2 text-sm text-success"
                : "rounded-lg bg-error-bg px-3 py-2 text-sm text-error"
            }
          >
            {feedback.text}
          </span>
        )}
      </div>
    </form>
  );
}
