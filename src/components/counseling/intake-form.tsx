"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { sortByVietnameseName } from "@/lib/utils";
import { AiDraftButton } from "@/components/ai/ai-draft-button";

export interface IntakeStudent {
  id: string;
  code: string;
  full_name: string;
  class_name: string;
}

const SEVERITIES = [
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
  { value: "critical", label: "Nghiêm trọng" },
];

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-ring";

/** Tiếp nhận ca tư vấn mới → insert counseling_cases (status = new). */
export function CounselingIntakeForm({
  students: rawStudents,
  meId,
}: {
  students: IntakeStudent[];
  meId: string;
}) {
  const students = sortByVietnameseName(rawStudents, (s) => s.full_name);
  const router = useRouter();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [issue, setIssue] = useState("");
  const [severity, setSeverity] = useState("low");
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit() {
    setSaved(false);
    setError(null);
    if (!studentId) {
      setError("Vui lòng chọn học sinh.");
      return;
    }
    if (!issue.trim()) {
      setError("Vui lòng mô tả vấn đề.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.from("counseling_cases").insert({
        student_id: studentId,
        issue: issue.trim(),
        severity,
        status: "new",
        detected_by: meId,
      });
      if (err) {
        setError(err.message);
        return;
      }
      setIssue("");
      setSeverity("low");
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <h3 className="mb-3 text-base font-semibold">Tiếp nhận ca mới</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Học sinh
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className={inputCls}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} - {s.class_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Mức độ
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className={inputCls}
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2 lg:col-span-4">
          Vấn đề phát hiện
          <input
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="VD: Dấu hiệu chán học, xung đột với bạn bè…"
            className={inputCls}
          />
        </label>
      </div>
      <AiDraftButton<{
        summary: string;
        suggestedSeverity: string;
        suggestion: string;
      }>
        className="mt-3"
        endpoint="/api/ai/counseling-summary"
        payload={() => ({ issue })}
        onApply={(r) => {
          setIssue(r.summary);
          setSeverity(r.suggestedSeverity);
          setAiAdvice(r.suggestion || null);
        }}
        label="AI phân tích & gợi ý mức độ"
        progressLabel="Đang phân tích ca..."
        disabled={!issue.trim()}
      />
      {aiAdvice && (
        <p className="mt-2 rounded-lg bg-primary-bg px-3 py-2 text-xs text-primary">
          <span className="font-medium">Hướng xử lý gợi ý:</span> {aiAdvice}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? "Đang lưu…" : "Tiếp nhận"}
        </Button>
        {saved && <span className="text-sm text-success">Đã tiếp nhận ca.</span>}
        {error && <span className="text-sm text-error">{error}</span>}
      </div>
    </div>
  );
}
