"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { postSchoolAnnouncement } from "@/app/(app)/school/actions";

export function AnnounceForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      setErr(null);
      setMsg(null);
      const r = await postSchoolAnnouncement({ title, content });
      if (r.error) setErr(r.error);
      else {
        setMsg("Đã gửi thông báo toàn trường.");
        setTitle("");
        setContent("");
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề thông báo"
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring"
        />
        <AutoGrowTextarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="Nội dung gửi toàn trường..."
        />
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={submit}
            disabled={pending || !title.trim() || !content.trim()}
          >
            Gửi toàn trường
          </Button>
          {err && <p className="text-sm text-error">{err}</p>}
          {msg && <p className="text-sm text-success">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
