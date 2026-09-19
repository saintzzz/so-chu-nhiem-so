"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ScoreCell {
  id: string;
  score: number;
}

interface Criterion {
  id: string;
  name: string;
  max_score: number;
  category: string | null;
}

interface ClassInfo {
  id: string;
  name: string;
}

function keyOf(classId: string, criterionId: string) {
  return `${classId}|${criterionId}`;
}

export function ScoringGrid({
  period,
  criteria,
  classes,
  initialScores,
}: {
  period: string;
  criteria: Criterion[];
  classes: ClassInfo[];
  initialScores: Record<string, ScoreCell>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const c of classes) {
      for (const cr of criteria) {
        const cell = initialScores[keyOf(c.id, cr.id)];
        v[keyOf(c.id, cr.id)] = cell ? String(cell.score) : "";
      }
    }
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function totalFor(classId: string) {
    let sum = 0;
    for (const cr of criteria) {
      const raw = values[keyOf(classId, cr.id)];
      const n = raw === "" ? 0 : Number(raw);
      if (!Number.isNaN(n)) sum += n;
    }
    return sum;
  }

  const maxTotal = criteria.reduce((s, c) => s + c.max_score, 0);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const supabase = createClient();
    try {
      const ops: PromiseLike<unknown>[] = [];
      for (const c of classes) {
        for (const cr of criteria) {
          const key = keyOf(c.id, cr.id);
          const existing = initialScores[key];
          const raw = (values[key] ?? "").trim();
          if (raw === "") {
            if (existing) {
              ops.push(
                supabase.from("emulation_scores").delete().eq("id", existing.id),
              );
            }
            continue;
          }
          const score = Number(raw);
          if (Number.isNaN(score)) continue;
          if (existing) {
            if (existing.score !== score) {
              ops.push(
                supabase
                  .from("emulation_scores")
                  .update({ score })
                  .eq("id", existing.id),
              );
            }
          } else {
            ops.push(
              supabase.from("emulation_scores").insert({
                class_id: c.id,
                criterion_id: cr.id,
                period,
                score,
              }),
            );
          }
        }
      }
      const results = await Promise.all(ops);
      const failed = results.find(
        (r) =>
          typeof r === "object" &&
          r !== null &&
          "error" in r &&
          (r as { error: unknown }).error !== null,
      );
      if (failed) {
        throw new Error(
          String((failed as { error: { message?: string } }).error?.message ?? "Lỗi lưu điểm"),
        );
      }
      setMessage("Đã lưu điểm thi đua.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu điểm");
    } finally {
      setSaving(false);
    }
  }

  if (criteria.length === 0 || classes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-sm-token)]">
        Chưa có tiêu chí thi đua hoặc lớp học nào.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={saving}>
          <Save />
          {saving ? "Đang lưu..." : "Lưu điểm thi đua"}
        </Button>
        {message && (
          <span className="rounded-lg bg-success-bg px-3 py-1.5 text-sm text-success">
            {message}
          </span>
        )}
        {error && (
          <span className="rounded-lg bg-error-bg px-3 py-1.5 text-sm text-error">
            {error}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tiêu chí
              </th>
              {classes.map((c) => (
                <th
                  key={c.id}
                  className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((cr) => (
              <tr key={cr.id} className="border-b border-border">
                <td className="px-4 py-2.5">
                  <span className="block font-medium">{cr.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Tối đa {cr.max_score} điểm
                  </span>
                </td>
                {classes.map((c) => {
                  const key = keyOf(c.id, cr.id);
                  return (
                    <td key={c.id} className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={cr.max_score}
                        value={values[key] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [key]: e.target.value }))
                        }
                        className="h-8 w-16 rounded-lg border border-border bg-background px-2 text-center text-sm"
                        aria-label={`Điểm ${cr.name} lớp ${c.name}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-muted/40 font-semibold">
              <td className="px-4 py-3">
                Tổng điểm{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (/{maxTotal})
                </span>
              </td>
              {classes.map((c) => {
                const total = totalFor(c.id);
                const best = Math.max(...classes.map((x) => totalFor(x.id)));
                return (
                  <td
                    key={c.id}
                    className={cn(
                      "px-3 py-3 text-center",
                      total === best && total > 0 && "text-success",
                    )}
                  >
                    {total}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
