"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sendAnnouncement } from "@/app/(app)/parents/actions";

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function ComposeForm({
  classes,
  students,
}: {
  classes: { id: string; name: string }[];
  students: { id: string; full_name: string; class_id: string; code: string }[];
}) {
  const [scope, setScope] = useState<"class" | "student">("class");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const classStudents = students.filter((s) => s.class_id === classId);

  async function handleSubmit() {
    setPending(true);
    setFeedback(null);
    const res = await sendAnnouncement({
      classId,
      studentId: scope === "student" && studentId ? studentId : null,
      title,
      content,
    });
    setPending(false);
    if (res.error) {
      setFeedback({ kind: "error", text: res.error });
    } else {
      setFeedback({ kind: "success", text: "Đã gửi thông báo thành công." });
      setTitle("");
      setContent("");
      setStudentId("");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <h2 className="mb-4 text-base font-semibold">Soạn thông báo mới</h2>
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Phạm vi gửi</p>
          <div className="flex gap-2">
            {(
              [
                { value: "class", label: "Cả lớp" },
                { value: "student", label: "Cá nhân học sinh" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setScope(opt.value)}
                className={cn(
                  "rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors",
                  scope === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Lớp</label>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setStudentId("");
            }}
            className={INPUT_CLS}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {scope === "student" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">Học sinh</label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">— Chọn học sinh —</option>
              {classStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium">Tiêu đề</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Thông báo họp phụ huynh đầu năm"
            className={INPUT_CLS}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Nội dung</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder="Nhập nội dung thông báo gửi phụ huynh..."
            className={INPUT_CLS}
          />
        </div>

        {feedback && (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              feedback.kind === "success"
                ? "bg-success-bg text-success"
                : "bg-error-bg text-error",
            )}
          >
            {feedback.text}
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={
            pending ||
            !classId ||
            !title.trim() ||
            !content.trim() ||
            (scope === "student" && !studentId)
          }
        >
          {pending ? "Đang gửi..." : "Gửi thông báo"}
        </Button>
      </div>
    </div>
  );
}
