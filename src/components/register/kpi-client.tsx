"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { logAudit } from "@/lib/audit";
import { CURRENT_PERIOD, type Kpi } from "./types";

const KPI_LABELS: Record<string, string> = {
  chuyen_can: "Chuyên cần (%)",
  ty_le_kha: "Tỉ lệ khá giỏi (%)",
  vi_pham: "Số vi phạm tối đa",
};

const STATUS_TONE: Record<Kpi["status"], "primary" | "success" | "error"> = {
  registered: "primary",
  approved: "success",
  rejected: "error",
};
const STATUS_LABEL: Record<Kpi["status"], string> = {
  registered: "Đã đăng ký",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm";

export function KpiClient({
  classId,
  kpis: initialKpis,
}: {
  classId: string;
  kpis: Kpi[];
}) {
  const supabase = createClient();
  const [kpis, setKpis] = useState<Kpi[]>(initialKpis);
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const [chuyenCan, setChuyenCan] = useState("98");
  const [tyLeKha, setTyLeKha] = useState("60");
  const [viPham, setViPham] = useState("0");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function register() {
    if (!period.trim()) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase
      .from("kpis")
      .insert({
        class_id: classId,
        period: period.trim(),
        content: {
          chuyen_can: Number(chuyenCan) || 0,
          ty_le_kha: Number(tyLeKha) || 0,
          vi_pham: Number(viPham) || 0,
        },
        status: "registered",
      })
      .select()
      .single();
    if (!error && data) {
      setKpis((ks) => [...ks, data as Kpi]);
      setMessage(`Đã đăng ký KPI kỳ "${period}".`);
      logAudit(supabase, {
        action: "Đăng ký KPI",
        entity: "kpis",
        entityId: data.id,
        payload: { class_id: classId, period: period.trim() },
      });
    } else {
      setMessage("Không thể đăng ký KPI.");
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {kpis.map((k) => (
        <div
          key={k.id}
          className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm-token)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{k.period}</h3>
            <StatusBadge
              label={STATUS_LABEL[k.status] ?? k.status}
              tone={STATUS_TONE[k.status] ?? "muted"}
            />
          </div>
          <dl className="space-y-1.5 text-sm">
            {Object.entries(k.content).map(([key, val]) => (
              <div key={key} className="flex justify-between">
                <dt className="text-muted-foreground">
                  {KPI_LABELS[key] ?? key}
                </dt>
                <dd className="font-medium">{String(val)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      <div className="rounded-xl border border-dashed border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">Đăng ký KPI mới</h3>
        <div className="space-y-2">
          <input
            className={inputCls}
            placeholder="Kỳ (vd: Tháng 10/2026, HK1)"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          {(
            [
              ["chuyen_can", chuyenCan, setChuyenCan],
              ["ty_le_kha", tyLeKha, setTyLeKha],
              ["vi_pham", viPham, setViPham],
            ] as const
          ).map(([key, val, setter]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                {KPI_LABELS[key]}
              </span>
              <input
                className={inputCls}
                type="number"
                value={val}
                onChange={(e) => setter(e.target.value)}
              />
            </label>
          ))}
          <Button onClick={register} disabled={busy || !period.trim()}>
            <Target /> Đăng ký KPI
          </Button>
          {message && (
            <p className="rounded-lg bg-primary-bg px-3 py-2 text-sm text-primary">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
