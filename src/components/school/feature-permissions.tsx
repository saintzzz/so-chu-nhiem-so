"use client";

import { useState, useTransition } from "react";
import { FEATURES } from "@/lib/feature-keys";
import { setFeatureGrant } from "@/app/(app)/school/actions";
import { ROLE_LABELS } from "@/lib/nav";
import type { Role } from "@/types";

const CONFIG_ROLES: Role[] = ["gvcn", "gvbm", "to_truong", "pht", "ke_toan", "bgh"];

type Grant = {
  id: string;
  feature: string;
  role: string | null;
  user_id: string | null;
  effect: "allow" | "deny";
};

const btn =
  "rounded-md border px-2 py-0.5 text-xs disabled:opacity-40 hover:bg-muted";

/** Ma tran quyen theo role: moi o 3 trang thai Mac dinh / Cho phep / Cam. */
export function FeatureMatrix({ grants }: { grants: Grant[] }) {
  const [pending, start] = useTransition();
  const [, setErr] = useState("");
  const get = (feature: string, role: string) =>
    grants.find((g) => g.feature === feature && g.role === role)?.effect;
  const set = (feature: string, role: string, effect: "allow" | "deny" | null) =>
    start(async () => {
      const r = await setFeatureGrant({ feature, role, effect });
      if (r.error) setErr(r.error);
    });

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Chức năng</th>
            {CONFIG_ROLES.map((r) => (
              <th key={r} className="px-3 py-2.5 font-medium">{ROLE_LABELS[r]}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {FEATURES.map((f) => (
            <tr key={f.key}>
              <td className="px-4 py-2.5">{f.label}</td>
              {CONFIG_ROLES.map((role) => {
                const cur = get(f.key, role);
                return (
                  <td key={role} className="px-3 py-2.5">
                    <div className="flex gap-1">
                      {(["deny", null, "allow"] as const).map((e) => (
                        <button
                          key={String(e)}
                          disabled={pending}
                          onClick={() => set(f.key, role, e)}
                          title={
                            e === "deny" ? "Cấm" : e === "allow" ? "Cho phép" : "Mặc định"
                          }
                          className={`${btn} ${
                            cur === e || (e === null && !cur)
                              ? e === "deny"
                                ? "border-destructive bg-destructive/15 text-destructive"
                                : e === "allow"
                                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-600"
                                  : "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {e === "deny" ? "Cấm" : e === "allow" ? "Cho" : "Mặc định"}
                        </button>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Override theo tung user: chon nhanh Cho phep/Cam/Mo khoa theo chuc nang. */
export function UserGrantRow({
  userId,
  userName,
  grants,
}: {
  userId: string;
  userName: string;
  grants: Grant[];
}) {
  const [pending, start] = useTransition();
  const mine = grants.filter((g) => g.user_id === userId);
  const set = (feature: string, effect: "allow" | "deny" | null) =>
    start(async () => {
      await setFeatureGrant({ feature, userId, effect });
    });
  return (
    <details className="rounded-lg border bg-muted/30 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium">
        Quyền riêng của {userName}
        {mine.length > 0 && (
          <span className="ml-2 text-muted-foreground">
            ({mine.length} tùy chỉnh)
          </span>
        )}
      </summary>
      <div className="mt-2 space-y-1">
        {FEATURES.map((f) => {
          const cur = mine.find((g) => g.feature === f.key)?.effect;
          return (
            <div key={f.key} className="flex items-center justify-between gap-2 text-xs">
              <span>{f.label}</span>
              <span className="flex gap-1">
                {(["deny", null, "allow"] as const).map((e) => (
                  <button
                    key={String(e)}
                    disabled={pending}
                    onClick={() => set(f.key, e)}
                    className={`${btn} ${
                      cur === e || (e === null && !cur)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {e === "deny" ? "Cấm" : e === "allow" ? "Cho" : "Theo vai trò"}
                  </button>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </details>
  );
}
