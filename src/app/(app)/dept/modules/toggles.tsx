"use client";

import { useState, useTransition } from "react";
import { setSchoolModule } from "../actions";
import { cn } from "@/lib/utils";

export function ModuleMatrix({
  schools,
  modules,
  matrix,
}: {
  schools: { id: string; name: string; code: string }[];
  modules: readonly { key: string; label: string }[];
  matrix: Record<string, Record<string, boolean>>;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle(schoolId: string, module: string, enabled: boolean) {
    setErr(null);
    start(async () => {
      const r = await setSchoolModule(schoolId, module, enabled);
      if (r?.error) setErr(r.error);
    });
  }

  return (
    <div className="space-y-3">
      {err && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      )}
      <div className="overflow-x-auto relative rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">Trường</th>
              {modules.map((m) => (
                <th key={m.key} className="px-3 py-3 text-center font-medium text-muted-foreground">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.code}</div>
                </td>
                {modules.map((m) => {
                  const on = matrix[s.id]?.[m.key] !== false;
                  return (
                    <td key={m.key} className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => toggle(s.id, m.key, !on)}
                        className={cn(
                          "inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          on ? "bg-primary" : "bg-muted",
                          pending && "opacity-50",
                        )}
                        aria-label={`${on ? "Tắt" : "Bật"} ${m.label} - ${s.name}`}
                        aria-pressed={on}
                      >
                        <span
                          className={cn(
                            "size-5 rounded-full bg-white shadow transition-transform",
                            on ? "translate-x-5" : "translate-x-0.5",
                          )}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Module tắt sẽ ẩn khỏi menu và chặn route tương ứng với mọi tài khoản của trường.
      </p>
    </div>
  );
}
