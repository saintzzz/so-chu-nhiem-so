"use client";

import { useState } from "react";
import { collectPayment } from "@/app/(app)/finance/actions";
import { sortByVietnameseName } from "@/lib/utils";
import { fmtMoney } from "./items-board";

export type Invoice = {
  id: string;
  student_id: string;
  amount: number;
  exemption_amount: number;
  paid_amount: number;
  status: "unpaid" | "partial" | "paid" | "exempt";
  receipt_no: string | null;
  student_name: string;
  class_name: string;
};

const STATUS_LABEL: Record<string, string> = {
  unpaid: "Chưa thu",
  partial: "Thu một phần",
  paid: "Đã thu đủ",
  exempt: "Miễn",
};

const STATUS_CLS: Record<string, string> = {
  unpaid: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  exempt: "bg-muted text-muted-foreground",
};

export function InvoicesBoard({ invoices, canWrite }: { invoices: Invoice[]; canWrite: boolean }) {
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const sorted = sortByVietnameseName(invoices, (i) => i.student_name);
  const rows = sorted.filter(
    (i) =>
      (filter === "all" || i.status === filter) &&
      (!q || i.student_name.toLowerCase().includes(q.toLowerCase()) || i.class_name.toLowerCase().includes(q.toLowerCase()))
  );

  const totals = {
    due: invoices.reduce((s, i) => s + (i.amount - i.exemption_amount), 0),
    paid: invoices.reduce((s, i) => s + i.paid_amount, 0),
  };

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(amount);
    setBusy(true);
    setErr(null);
    const res = await collectPayment(paying!.id, v, method, note || undefined);
    setBusy(false);
    if (res?.error) return setErr(res.error);
    setPaying(null);
    setAmount("");
    setNote("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm học sinh / lớp"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-56" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <option value="all">Tất cả ({invoices.length})</option>
          <option value="unpaid">Chưa thu</option>
          <option value="partial">Thu một phần</option>
          <option value="paid">Đã thu đủ</option>
          <option value="exempt">Miễn</option>
        </select>
        <p className="ml-auto text-sm text-muted-foreground">
          Phải thu <b className="tabular-nums">{fmtMoney(totals.due)}</b> · Đã thu <b className="tabular-nums">{fmtMoney(totals.paid)}</b> · Còn lại <b className="tabular-nums">{fmtMoney(totals.due - totals.paid)}</b>
        </p>
      </div>

      {paying && (
        <form onSubmit={pay} className="rounded-xl border border-primary/30 bg-card p-4 shadow-[var(--shadow-sm-token)] space-y-3">
          <p className="text-sm font-medium">
            Thu tiền: {paying.student_name} ({paying.class_name}) - còn nợ{" "}
            <b className="tabular-nums">{fmtMoney(paying.amount - paying.exemption_amount - paying.paid_amount)}</b>
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Số tiền (đ) *</span>
              <input required inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Hình thức</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="cash">Tiền mặt</option>
                <option value="transfer">Chuyển khoản</option>
              </select>
            </label>
            <label className="text-sm flex-1 min-w-40">
              <span className="mb-1 block text-muted-foreground">Ghi chú</span>
              <input value={note} onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !amount} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy ? "..." : "Xác nhận thu"}
            </button>
            <button type="button" onClick={() => { setPaying(null); setErr(null); }} className="rounded-lg border border-border px-4 py-2 text-sm">Hủy</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto relative rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Học sinh</th>
              <th className="px-4 py-3 font-medium">Lớp</th>
              <th className="px-4 py-3 font-medium">Phải thu</th>
              <th className="px-4 py-3 font-medium">Miễn giảm</th>
              <th className="px-4 py-3 font-medium">Đã thu</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Biên lai</th>
              {canWrite && <th className="px-4 py-3 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                {invoices.length === 0 ? "Chưa có hóa đơn - phát hành từ trang Đợt thu." : "Không có kết quả phù hợp bộ lọc."}
              </td></tr>
            )}
            {rows.map((i) => (
              <tr key={i.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 font-medium">{i.student_name}</td>
                <td className="px-4 py-3">{i.class_name}</td>
                <td className="px-4 py-3 tabular-nums">{fmtMoney(i.amount)}</td>
                <td className="px-4 py-3 tabular-nums">{i.exemption_amount ? fmtMoney(i.exemption_amount) : "-"}</td>
                <td className="px-4 py-3 tabular-nums">{fmtMoney(i.paid_amount)}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLS[i.status]}`}>{STATUS_LABEL[i.status]}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{i.receipt_no ?? "-"}</td>
                {canWrite && (
                  <td className="px-4 py-3 text-right">
                    {(i.status === "unpaid" || i.status === "partial") && (
                      <button onClick={() => { setPaying(i); setAmount(String(i.amount - i.exemption_amount - i.paid_amount)); setErr(null); }}
                        disabled={busy} className="text-sm text-primary hover:underline">Thu tiền</button>
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
