"use client";

import { useState, useTransition } from "react";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/ui/auto-grow-textarea";
import { addSchoolKpi, updateSchoolKpi } from "@/app/(app)/school/actions";

interface Kpi {
  id: string;
  period: string;
  title: string;
  target: string | null;
  actual: string | null;
  unit: string | null;
  status: string;
  note: string | null;
}

const STATUS: Record<string, { label: string; tone: "primary" | "success" | "warning" | "muted" }> = {
  quy_hoach: { label: "Quy hoạch", tone: "muted" },
  dang_thuc_hien: { label: "Đang thực hiện", tone: "primary" },
  dat: { label: "Đạt", tone: "success" },
  chua_dat: { label: "Chưa đạt", tone: "warning" },
};

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring";

export function StrategyBoard({ kpis }: { kpis: Kpi[] }) {
  const [period, setPeriod] = useState("2026-2027");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [note, setNote] = useState("");
  const [actual, setActual] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    start(async () => {
      setErr(null);
      setMsg(null);
      const r = await addSchoolKpi({ period, title, target, unit, note });
      if (r.error) setErr(r.error);
      else {
        setMsg("Đã thêm chỉ tiêu.");
        setTitle("");
        setTarget("");
        setUnit("");
        setNote("");
      }
    });
  }

  function saveActual(id: string) {
    start(async () => {
      setErr(null);
      const r = await updateSchoolKpi(id, { actual: actual[id] ?? "" });
      if (r.error) setErr(r.error);
    });
  }

  function setStatus(id: string, status: string) {
    start(async () => {
      const r = await updateSchoolKpi(id, { status });
      if (r.error) setErr(r.error);
    });
  }

  return (
    <>
      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]">
        <h2 className="mb-3 text-sm font-semibold">Thêm chỉ tiêu</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Kỳ / năm học</span>
            <input value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls} placeholder="VD: 2026-2027" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Tên chỉ tiêu</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="VD: Tỷ lệ HS khá giỏi" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Mục tiêu</span>
            <input value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls} placeholder="VD: 75" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Đơn vị</span>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} placeholder="VD: %" />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-muted-foreground">Ghi chú</span>
          <AutoGrowTextarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Cách đo, nguồn dữ liệu..." />
        </label>
        <Button onClick={add} disabled={pending || !title.trim()} size="sm" className="mt-3">
          Thêm chỉ tiêu
        </Button>
        {err && <p className="mt-2 text-sm text-error">{err}</p>}
        {msg && <p className="mt-2 text-sm text-success">{msg}</p>}
      </div>

      <DataTable
        columns={["Kỳ", "Chỉ tiêu", "Mục tiêu", "Thực đạt", "Trạng thái", "Ghi chú"]}
        footer={<span>{kpis.length} chỉ tiêu</span>}
      >
        {kpis.map((k) => (
          <tr key={k.id}>
            <td className="whitespace-nowrap text-muted-foreground">{k.period}</td>
            <td className="font-medium">{k.title}</td>
            <td>
              {k.target ?? "-"} {k.unit ?? ""}
            </td>
            <td>
              <div className="flex items-center gap-1">
                <input
                  defaultValue={k.actual ?? ""}
                  onChange={(e) =>
                    setActual((a) => ({ ...a, [k.id]: e.target.value }))
                  }
                  placeholder="..."
                  className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring"
                />
                <Button size="sm" variant="outline" disabled={pending} onClick={() => saveActual(k.id)}>
                  Lưu
                </Button>
              </div>
            </td>
            <td>
              <select
                value={k.status}
                disabled={pending}
                onChange={(e) => setStatus(k.id, e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none"
              >
                {Object.entries(STATUS).map(([v, s]) => (
                  <option key={v} value={v}>
                    {s.label}
                  </option>
                ))}
              </select>
            </td>
            <td className="max-w-48 text-xs text-muted-foreground">{k.note ?? "-"}</td>
          </tr>
        ))}
        {kpis.length === 0 && (
          <tr>
            <td colSpan={6} className="py-8 text-center text-muted-foreground">
              Chưa có chỉ tiêu nào - thêm chỉ tiêu đầu tiên phía trên.
            </td>
          </tr>
        )}
      </DataTable>
    </>
  );
}
