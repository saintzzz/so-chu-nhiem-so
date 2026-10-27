"use client";

import { useState, useTransition } from "react";
import { startAttempt, submitAttempt } from "@/app/portal/student/actions";
import { MathText } from "@/components/tvc/math-text";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { fmtDateTimeVN } from "@/lib/utils";

type Question = {
  id: string;
  stem: string;
  context: string | null;
  qtype: string;
  points: number | null;
  media: unknown;
};

type Started = {
  submission_id: string;
  duration_minutes: number;
  deadline: string;
  questions: Question[];
};

const TF4_KEYS = ["a", "b", "c", "d"];

export function TakeExam({ sessionId, title }: { sessionId: string; title: string }) {
  const [attempt, setAttempt] = useState<Started | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<{ auto_score: number; max_score: number; essay_pending: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function begin() {
    setErr(null);
    start(async () => {
      const res = await startAttempt(sessionId);
      if (res?.error) return setErr(res.error);
      setAttempt(res.data as Started);
    });
  }

  function submit() {
    if (!confirm("Nộp bài? Bạn sẽ không sửa được sau khi nộp.")) return;
    setErr(null);
    start(async () => {
      const res = await submitAttempt(sessionId, answers);
      if (res?.error) return setErr(res.error);
      setResult(res.data as { auto_score: number; max_score: number; essay_pending: boolean });
    });
  }

  if (result) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-sm-token)]">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-4 text-3xl font-bold text-primary">
          {result.auto_score}/{result.max_score}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Điểm phần tự động
          {result.essay_pending ? " - phần tự luận chờ giáo viên chấm." : "."}
        </p>
        <a href="/portal/student" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Về trang chủ
        </a>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-[var(--shadow-sm-token)]">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Khi bắt đầu, thời gian làm bài sẽ được tính. Bạn chỉ được nộp một lần.
        </p>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        <button
          onClick={begin}
          disabled={busy}
          className="mt-4 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Đang tải đề..." : "Bắt đầu làm bài"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {attempt.questions.length} câu · Thời lượng {attempt.duration_minutes} phút · Hạn nộp{" "}
          {fmtDateTimeVN(attempt.deadline)}
        </p>
      </div>

      {attempt.questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
          <p className="text-sm font-medium">
            Câu {i + 1} <span className="text-muted-foreground">({q.points ?? 0}đ)</span>
          </p>
          {q.context && (
            <div className="mt-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <MathText text={q.context} />
            </div>
          )}
          <div className="mt-2 text-sm">
            <MathText text={q.stem} />
          </div>

          {q.qtype === "multiple_choice" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {["A", "B", "C", "D"].map((opt) => (
                <label
                  key={opt}
                  className={`cursor-pointer rounded-lg border px-4 py-2 text-sm ${
                    answers[q.id] === opt
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    className="sr-only"
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {q.qtype === "true_false_4" && (
            <div className="mt-3 space-y-2">
              {TF4_KEYS.map((k) => {
                const cur = (answers[q.id] as Record<string, string> | undefined)?.[k];
                return (
                  <div key={k} className="flex items-center gap-3 text-sm">
                    <span className="w-5 font-medium">{k})</span>
                    {["Đúng", "Sai"].map((opt) => (
                      <label
                        key={opt}
                        className={`cursor-pointer rounded-lg border px-3 py-1 ${
                          cur === opt ? "border-primary bg-primary/10 font-medium" : "border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${q.id}-${k}`}
                          className="sr-only"
                          checked={cur === opt}
                          onChange={() =>
                            setAnswers((a) => ({
                              ...a,
                              [q.id]: { ...(a[q.id] as Record<string, string> | undefined), [k]: opt },
                            }))
                          }
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {q.qtype === "short_answer" && (
            <input
              className="mt-3 w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              placeholder="Nhập đáp án"
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            />
          )}

          {q.qtype === "essay" && (
            <AutoGrowTextarea
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              rows={4}
              placeholder="Viết bài làm của em..."
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            />
          )}
        </div>
      ))}

      {err && <p className="text-sm text-destructive">{err}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Đang nộp..." : "Nộp bài"}
      </button>
    </div>
  );
}
