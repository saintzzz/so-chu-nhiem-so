"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";

export interface EvalStudent {
  id: string;
  code: string;
  full_name: string;
}

export interface ExistingEval {
  id: string;
  student_id: string;
  rating: string;
  comment: string | null;
}

export const RATINGS = [
  { value: "tot", label: "Tốt" },
  { value: "kha", label: "Khá" },
  { value: "trung_binh", label: "Trung bình" },
  { value: "yeu", label: "Yếu" },
];

/** Editable hạnh kiểm table — one row per student, upsert on save. */
export function ConductEvaluationEditor({
  students,
  evaluations,
  term,
  meId,
}: {
  students: EvalStudent[];
  evaluations: ExistingEval[];
  term: string;
  meId: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<
    Record<string, { rating: string; comment: string }>
  >(() =>
    Object.fromEntries(
      students.map((s) => {
        const ev = evaluations.find((e) => e.student_id === s.id);
        return [
          s.id,
          { rating: ev?.rating ?? "tot", comment: ev?.comment ?? "" },
        ];
      }),
    ),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function patch(id: string, part: { rating?: string; comment?: string }) {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { rating: "tot", comment: "" }), ...part },
    }));
  }

  function save() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const rows = students.map((s) => {
        const ev = evaluations.find((e) => e.student_id === s.id);
        const d = draft[s.id] ?? { rating: "tot", comment: "" };
        return {
          ...(ev ? { id: ev.id } : {}),
          student_id: s.id,
          term,
          rating: d.rating,
          comment: d.comment.trim() || null,
          evaluated_by: meId,
        };
      });
      const { error: err } = await supabase
        .from("conduct_evaluations")
        .upsert(rows);
      if (err) {
        setError(err.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <DataTable
      columns={["Mã HS", "Họ và tên", "Xếp loại", "Nhận xét"]}
      footer={
        <>
          <span>{students.length} học sinh</span>
          <span className="flex items-center gap-3">
            {saved && <span className="text-success">Đã lưu đánh giá.</span>}
            {error && <span className="text-error">{error}</span>}
            <Button onClick={save} disabled={pending} size="sm">
              {pending ? "Đang lưu…" : "Lưu đánh giá"}
            </Button>
          </span>
        </>
      }
    >
      {students.map((s) => {
        const d = draft[s.id] ?? { rating: "tot", comment: "" };
        return (
          <tr key={s.id}>
            <td className="font-mono text-xs text-muted-foreground">{s.code}</td>
            <td className="font-medium">{s.full_name}</td>
            <td>
              <select
                value={d.rating}
                onChange={(e) => patch(s.id, { rating: e.target.value })}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring"
              >
                {RATINGS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </td>
            <td>
              <input
                value={d.comment}
                onChange={(e) => patch(s.id, { comment: e.target.value })}
                placeholder="Nhận xét…"
                className="h-8 w-full min-w-48 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-ring"
              />
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
