"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SEVERITIES = [
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
  { value: "critical", label: "Nghiêm trọng" },
];

const STATUSES = [
  { value: "new", label: "Mới" },
  { value: "assessing", label: "Đang đánh giá" },
  { value: "counseling", label: "Đang tư vấn" },
  { value: "referred", label: "Đã chuyển tuyến" },
  { value: "resolved", label: "Đã xử lý" },
];

const selectCls =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring";

/** Inline severity + status editors for a counseling_cases row. */
export function CaseControls({
  caseId,
  severity,
  status,
}: {
  caseId: string;
  severity: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(patch: { severity?: string; status?: string }) {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("counseling_cases")
        .update(patch)
        .eq("id", caseId);
      if (err) {
        setError(err.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select
        value={severity}
        onChange={(e) => update({ severity: e.target.value })}
        disabled={pending}
        className={selectCls}
        aria-label="Mức độ"
      >
        {SEVERITIES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => update({ status: e.target.value })}
        disabled={pending}
        className={selectCls}
        aria-label="Trạng thái"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {saved && <span className="text-xs text-success">Đã lưu</span>}
      {error && <span className="text-xs text-error">{error}</span>}
    </span>
  );
}
