"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Đã nộp - chờ nhà trường xét", cls: "text-brand" },
  approved: { label: "Đã duyệt hồ sơ", cls: "text-success" },
  rejected: { label: "Không đạt yêu cầu", cls: "text-error" },
  exam_registered: { label: "Đã đăng ký dự thi", cls: "text-brand" },
  passed: { label: "Trúng tuyển", cls: "text-success" },
  failed: { label: "Chưa trúng tuyển", cls: "text-muted-foreground" },
  enrolled: { label: "Đã nhập học", cls: "text-success" },
};

const LEVEL: Record<string, string> = {
  khoi_6: "Vào lớp 6",
  khoi_10: "Vào lớp 10",
};

export function TrackForm() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    campaign_name: string;
    level: string;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admission_track", {
      p_code: code.trim(),
    });
    setBusy(false);
    if (error || !data) {
      setErr("Không tìm thấy hồ sơ với mã này. Kiểm tra lại mã tra cứu.");
      return;
    }
    setResult(data as typeof result);
  }

  const s = result ? STATUS[result.status] : null;

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="TSXXXXXXXXXX"
          maxLength={14}
          className="h-11 flex-1 rounded-lg border border-input bg-background px-3 font-mono text-sm uppercase tracking-widest outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-brand-foreground disabled:opacity-50"
        >
          {busy ? "..." : "Tra cứu"}
        </button>
      </form>
      {err && (
        <p className="rounded-lg bg-error-bg px-3 py-2 text-sm text-error">
          {err}
        </p>
      )}
      {result && s && (
        <div className="rounded-xl border border-border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">
            {result.campaign_name} · {LEVEL[result.level] ?? result.level}
          </p>
          <p className={`mt-2 text-lg font-bold ${s.cls}`}>{s.label}</p>
        </div>
      )}
    </div>
  );
}
