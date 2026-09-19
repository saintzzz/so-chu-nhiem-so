"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type PlanStatus =
  | "draft"
  | "pending"
  | "approved"
  | "in_progress"
  | "done"
  | "cancelled";

const NEXT: Record<string, { label: string; to: PlanStatus }> = {
  draft: { label: "Gửi duyệt", to: "pending" },
  pending: { label: "Duyệt", to: "approved" },
  approved: { label: "Triển khai", to: "in_progress" },
  in_progress: { label: "Hoàn thành", to: "done" },
};

/** Approve / advance / cancel a support plan. */
export function PlanActions({
  planId,
  status,
  meId,
}: {
  planId: string;
  status: PlanStatus;
  meId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(to: PlanStatus) {
    startTransition(async () => {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("support_plans")
        .update({
          status: to,
          ...(to === "approved" ? { approved_by: meId } : {}),
        })
        .eq("id", planId);
      if (err) {
        setError(err.message);
        return;
      }
      router.refresh();
    });
  }

  const next = NEXT[status];
  const cancellable = !["done", "cancelled"].includes(status);

  if (!next && !cancellable) return null;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex gap-1">
        {next && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => update(next.to)}
            disabled={pending}
          >
            {next.label}
          </Button>
        )}
        {cancellable && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => update("cancelled")}
            disabled={pending}
          >
            Hủy
          </Button>
        )}
      </span>
      {error && <span className="text-xs text-error">{error}</span>}
    </span>
  );
}
