"use client";

import { useState } from "react";
import { savePeriod, issuePeriod } from "@/app/(app)/finance/actions";
import { formatDateOnly } from "@/lib/utils";

export type FeePeriod = {
  id: string;
  name: string;
  due_date: string | null;
  status: "draft" | "issued" | "closed";
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  issued: "Đã phát hành",
  closed: "Đã đóng",
};

export function PeriodsBoard({ periods, canWrite }: { periods: FeePeriod[]; canWrite: boolean }) {
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await savePeriod({ name, due_date: due || undefined });
    setBusy(false);
    if (res?.error) return setErr(res.error);
    setName("");
    setDue("");
  }

  async function issue(id: string) {
    if (!confirm("Phát hành hóa đơn cho toàn bộ học sinh trong đợt thu này?")) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await issuePeriod(id);
    setBusy(false);
    if (res?.error) return setErr(res.error);
    setMsg(`Đã phát hành ${res.issued} hóa đơn, gửi ${res.notified ?? 0} thông báo cho phụ huynh.`);
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <form onSubmit={create} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)] flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Tên đợt thu *</span>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Thu tháng 9/2026" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Hạn nộp</span>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <button type="submit" disabled={busy || !name.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy ? "..." : "Tạo đợt thu"}
          </button>
        </form>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}

      <div className="overflow-x-auto relative rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Đợt thu</th>
              <th className="px-4 py-3 font-medium">Hạn nộp</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              {canWrite && <th className="px-4 py-3 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Chưa có đợt thu nào.</td></tr>
            )}
            {periods.map((p) => (
              <tr key={p.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">{p.due_date ? formatDateOnly(p.due_date) : "-"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "issued" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : p.status === "closed" ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                {canWrite && (
                  <td className="px-4 py-3 text-right">
                    {p.status === "draft" && (
                      <button onClick={() => issue(p.id)} disabled={busy} className="text-sm text-primary hover:underline">
                        Phát hành hóa đơn
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
