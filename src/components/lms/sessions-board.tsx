"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { assignSession, closeSession } from "@/app/(app)/lms/actions";
import { fmtDateTimeVN } from "@/lib/utils";

export type ExamOpt = { id: string; title: string; subject_code: string | null; grade: number | null };
export type ClassOpt = { id: string; name: string; grade: number | null };
export type LmsSession = {
  id: string;
  title: string;
  status: string;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  class_name?: string;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Đang mở",
  closed: "Đã đóng",
};

const inputCls =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring";

export function SessionsBoard({
  sessions,
  exams,
  classes,
  canWrite,
}: {
  sessions: LmsSession[];
  exams: ExamOpt[];
  classes: ClassOpt[];
  canWrite: boolean;
}) {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const [duration, setDuration] = useState("45");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function assign(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await assignSession({
        exam_id: examId,
        class_id: classId,
        opens_at: opens,
        closes_at: closes,
        duration_minutes: Number(duration) || 45,
      });
      if (res?.error) return setErr(res.error);
      setMsg(`Đã giao bài (${res.questionCount} câu) cho lớp.`);
      setExamId("");
      setClassId("");
      setOpens("");
      setCloses("");
    });
  }

  function close(id: string) {
    if (!confirm("Đóng bài này? Học sinh sẽ không làm tiếp được nữa.")) return;
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await closeSession(id);
      if (res?.error) return setErr(res.error);
      setMsg("Đã đóng bài.");
    });
  }

  const valid = examId && classId && opens && closes;

  return (
    <div className="space-y-4">
      {canWrite && (
        <form onSubmit={assign} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)] flex flex-wrap items-end gap-3">
          <label className="text-sm min-w-64">
            <span className="mb-1 block text-muted-foreground">Đề thi *</span>
            <select required value={examId} onChange={(e) => setExamId(e.target.value)} className={inputCls + " w-full"}>
              <option value="">- Chọn đề -</option>
              {exams.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Lớp *</span>
            <select required value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}>
              <option value="">- Chọn lớp -</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Mở từ *</span>
            <input required type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} className={inputCls} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Đến *</span>
            <input required type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} className={inputCls} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Thời lượng (phút)</span>
            <input type="number" min={5} max={180} value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls + " w-24"} />
          </label>
          <button type="submit" disabled={busy || !valid}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy ? "..." : "Giao bài"}
          </button>
          {exams.length === 0 && (
            <p className="w-full text-xs text-muted-foreground">
              Bạn chưa có đề nào - tạo đề ở Công cụ soạn học liệu trước.
            </p>
          )}
        </form>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}

      <div className="overflow-x-auto relative rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Bài</th>
              <th className="px-4 py-3 font-medium">Lớp</th>
              <th className="px-4 py-3 font-medium">Mở</th>
              <th className="px-4 py-3 font-medium">Đóng</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{s.title}</td>
                <td className="px-4 py-3">{s.class_name}</td>
                <td className="px-4 py-3">{fmtDateTimeVN(s.opens_at)}</td>
                <td className="px-4 py-3">{fmtDateTimeVN(s.closes_at)}</td>
                <td className="px-4 py-3">{STATUS_LABEL[s.status] ?? s.status}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <Link href={`/lms/sessions/${s.id}`} className="text-primary hover:underline">
                    Kết quả
                  </Link>
                  {canWrite && s.status === "open" && (
                    <button onClick={() => close(s.id)} className="text-destructive hover:underline">
                      Đóng
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Chưa có bài nào được giao.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
