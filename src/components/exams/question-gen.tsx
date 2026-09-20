"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AiProgress } from "@/components/ai/ai-progress";
import { useAiJob } from "@/hooks/use-ai-job";
import { Button } from "@/components/ui/button";

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

interface GenQuestion {
  question: string;
  options?: string[];
  answer: string;
}

/** Panel sinh câu hỏi bằng AI theo môn + chủ đề - kết quả để GV tham khảo/copy. */
export function QuestionGen({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const job = useAiJob();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(subjects[0]?.name ?? "");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [level, setLevel] = useState("trung bình");
  const [kind, setKind] = useState<"trac_nghiem" | "tu_luan">("trac_nghiem");
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<GenQuestion[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (job.done && job.result !== null) {
      const r = job.result as { questions?: GenQuestion[] };
      job.reset();
      setQuestions(r.questions ?? null);
      if (!r.questions?.length) setErr("Chưa tạo được câu hỏi. Thử lại.");
    } else if (job.failed) {
      job.reset();
      setErr("Không nhận được kết quả. Vui lòng thử lại.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.done, job.failed, job.result]);

  async function run() {
    setBusy(true);
    setErr(null);
    setQuestions(null);
    try {
      const res = await fetch("/api/ai/gen-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, topic, count, level, kind }),
      });
      const json = (await res.json()) as {
        result?: { questions?: GenQuestion[] } | null;
        pending?: boolean;
        jobId?: string;
        devinUrl?: string;
        error?: string;
      };
      if (json.pending && json.jobId && json.devinUrl) {
        job.start(json.jobId, json.devinUrl);
        return;
      }
      if (json.result?.questions?.length) setQuestions(json.result.questions);
      else setErr(json.error ?? "Chưa tạo được câu hỏi. Thử lại.");
    } catch {
      setErr("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = busy || Boolean(job.job);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">AI sinh câu hỏi theo chủ đề</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Thu gọn" : "Mở"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-muted-foreground">
              Môn
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={`mt-1 ${INPUT_CLS}`}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Dạng câu hỏi
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as "trac_nghiem" | "tu_luan")
                }
                className={`mt-1 ${INPUT_CLS}`}
              >
                <option value="trac_nghiem">Trắc nghiệm</option>
                <option value="tu_luan">Tự luận</option>
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Mức độ
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className={`mt-1 ${INPUT_CLS}`}
              >
                <option value="nhận biết">Nhận biết</option>
                <option value="trung bình">Thông hiểu</option>
                <option value="vận dụng">Vận dụng</option>
                <option value="vận dụng cao">Vận dụng cao</option>
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Số câu
              <input
                type="number"
                min={1}
                max={15}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 5)}
                className={`mt-1 ${INPUT_CLS}`}
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">
            Chủ đề / nội dung
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="VD: Phương trình bậc nhất một ẩn, tuần 5"
              className={`mt-1 ${INPUT_CLS}`}
            />
          </label>
          <Button
            size="sm"
            onClick={run}
            disabled={waiting || !subject || !topic.trim()}
          >
            {waiting ? "Đang sinh..." : "Sinh câu hỏi"}
          </Button>
          {waiting && <AiProgress label="Đang sinh câu hỏi..." />}
          {err && <p className="text-sm text-error">{err}</p>}
          {questions && (
            <ol className="space-y-3 border-t border-border pt-3">
              {questions.map((q, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium">
                    {i + 1}. {q.question}
                  </p>
                  {q.options && (
                    <ul className="mt-1 space-y-0.5 pl-5 text-muted-foreground">
                      {q.options.map((o, j) => (
                        <li key={j}>{o}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-success">
                    Đáp án: {q.answer}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {questions && (
            <p className="text-xs text-muted-foreground">
              Câu hỏi do AI tạo - GV rà soát trước khi đưa vào đề.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
