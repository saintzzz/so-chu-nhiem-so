"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createIncident } from "@/app/(app)/safety/actions";

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const INCIDENT_TYPES = [
  "Sức khỏe / tai nạn",
  "Kỷ luật / vi phạm",
  "Xung đột / bạo lực học đường",
  "An toàn giao thông",
  "An toàn ngoài nhà trường",
  "Khác",
];

const SEVERITIES: { value: "low" | "medium" | "high" | "critical"; label: string }[] = [
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
  { value: "critical", label: "Nghiêm trọng" },
];

export function IncidentForm({
  classes,
  students,
}: {
  classes: { id: string; name: string }[];
  students: { id: string; full_name: string; class_id: string; code: string }[];
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState(INCIDENT_TYPES[0]);
  const [severity, setSeverity] = useState<
    "low" | "medium" | "high" | "critical"
  >("medium");
  const [occurredAt, setOccurredAt] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const classStudents = students.filter((s) => s.class_id === classId);
  const student = classStudents.find((s) => s.id === studentId) ?? null;

  async function handleSubmit() {
    setPending(true);
    setFeedback(null);
    const res = await createIncident({
      studentId: studentId || null,
      classId: student ? student.class_id : classId || null,
      type,
      severity,
      description,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : "",
    });
    setPending(false);
    if (res.error) {
      setFeedback({ kind: "error", text: res.error });
    } else {
      setFeedback({ kind: "success", text: "Đã ghi nhận sự cố." });
      setStudentId("");
      setDescription("");
      setOccurredAt("");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <h2 className="mb-4 text-base font-semibold">Ghi nhận sự cố mới</h2>
      <div className="space-y-4">
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

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Học sinh liên quan
          </label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">- Sự cố chung của lớp -</option>
            {classStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Loại sự cố
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={INPUT_CLS}
            >
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Mức độ</label>
            <select
              value={severity}
              onChange={(e) =>
                setSeverity(
                  e.target.value as "low" | "medium" | "high" | "critical",
                )
              }
              className={INPUT_CLS}
            >
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Thời điểm xảy ra
          </label>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className={INPUT_CLS}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Mô tả sự cố
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Mô tả chi tiết diễn biến, người liên quan, xử lý ban đầu..."
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
          disabled={pending || !classId || !description.trim()}
        >
          {pending ? "Đang lưu..." : "Ghi nhận sự cố"}
        </Button>
      </div>
    </div>
  );
}
