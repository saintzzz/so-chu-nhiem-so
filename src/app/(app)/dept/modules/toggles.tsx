"use client";

import { useState, useTransition } from "react";
import { setSchoolModule, setSuiteModules } from "../actions";
import { cn } from "@/lib/utils";

export type Suite = {
  key: string;
  label: string;
  modules: readonly string[];
};

/** CR-073: ban goi theo phan he - bat/tat nhanh ca nhom module cho 1 truong. */
export function SuitePanel({
  schools,
  suites,
  matrix,
}: {
  schools: { id: string; name: string; code: string }[];
  suites: readonly Suite[];
  matrix: Record<string, Record<string, boolean>>;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const school = schools.find((s) => s.id === schoolId) ?? schools[0];
  if (!school) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Chưa có trường nào.
      </p>
    );
  }

  function apply(suite: string, enabled: boolean) {
    setErr(null);
    start(async () => {
      const r = await setSuiteModules(school.id, suite, enabled);
      if (r?.error) setErr(r.error);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold">Gói bán theo phân hệ</h2>
        <select
          value={school.id}
          onChange={(e) => setSchoolId(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
          aria-label="Chọn trường"
        >
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
      </div>
      {err && (
        <p className="mb-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {suites.map((s) => {
          const on = s.modules.filter(
            (m) => matrix[school.id]?.[m] !== false,
          ).length;
          return (
            <div
              key={s.key}
              className="rounded-lg border border-border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {on}/{s.modules.length} module đang bật
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={pending || on === s.modules.length}
                    onClick={() => apply(s.key, true)}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-40"
                  >
                    Bật cả nhóm
                  </button>
                  <button
                    type="button"
                    disabled={pending || on === 0}
                    onClick={() => apply(s.key, false)}
                    className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-accent disabled:opacity-40"
                  >
                    Tắt cả nhóm
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
