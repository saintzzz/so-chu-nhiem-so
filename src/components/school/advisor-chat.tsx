"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { useAiJob } from "@/hooks/use-ai-job";

interface Msg {
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
}

const SUGGESTIONS = [
  "Hôm nay có bao nhiêu lớp chưa nộp báo cáo?",
  "Trường đang có sự cố nào chưa xử lý?",
  "Có bao nhiêu mục đang chờ tôi phê duyệt?",
  "Tỉ lệ chuyên cần hôm nay thế nào?",
];

export function AdvisorChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const aiJob = useAiJob();
  const pendingRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Devin fallback: điền câu trả lời vào message đang pending
  useEffect(() => {
    if (!aiJob.done || !aiJob.result) return;
    const obj = aiJob.result as { answer?: string };
    const idx = pendingRef.current;
    if (obj.answer?.trim() && idx !== null) {
      setMessages((m) =>
        m.map((x, i) =>
          i === idx ? { role: "assistant", text: obj.answer!.trim() } : x,
        ),
      );
    }
    pendingRef.current = null;
    aiJob.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiJob.done, aiJob.result]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || loading) return;
    setInput("");
    setLoading(true);
    const userIdx = messages.length;
    setMessages((m) => [
      ...m,
      { role: "user", text: question },
      { role: "assistant", text: "Đang phân tích số liệu...", pending: true },
    ]);
    try {
      const res = await fetch("/api/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = (await res.json()) as {
        answer?: string;
        pending?: boolean;
        jobId?: string;
        devinUrl?: string;
        error?: string;
      };
      if (json.answer) {
        setMessages((m) =>
          m.map((x, i) =>
            i === userIdx + 1 ? { role: "assistant", text: json.answer! } : x,
          ),
        );
      } else if (json.pending && json.jobId && json.devinUrl) {
        aiJob.start(json.jobId, json.devinUrl);
        pendingRef.current = userIdx + 1;
        setMessages((m) =>
          m.map((x, i) =>
            i === userIdx + 1
              ? {
                  role: "assistant",
                  text: "Đang xử lý, câu trả lời sẽ hiện khi hoàn thành...",
                  pending: true,
                }
              : x,
          ),
        );
      } else {
        setMessages((m) =>
          m.map((x, i) =>
            i === userIdx + 1
              ? { role: "assistant", text: json.error ?? "AI chưa trả lời được." }
              : x,
          ),
        );
      }
    } catch {
      setMessages((m) =>
        m.map((x, i) =>
          i === userIdx + 1
            ? { role: "assistant", text: "Không kết nối được AI." }
            : x,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 min-h-64 space-y-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <Sparkles className="mx-auto mb-2 size-8 text-primary" />
            <p className="text-sm text-muted-foreground">
              Hỏi tôi về tình hình trường - số liệu lấy trực tiếp từ hệ thống.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-end gap-2">
        <AutoGrowTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          placeholder="Hỏi về tình hình trường..."
          rows={1}
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => ask(input)}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-primary p-2.5 text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}
