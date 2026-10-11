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
  disabled,
}: {
  planId: string;
  status: PlanStatus;
  meId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(to: PlanStatus) {
    if (disabled) return;
    startTransition(async () => {
      const supabase = createClient();
      // r24: CAS theo status hien thi - tab cu tren ke hoach da chuyen
      // trang thai khong duoc ghi de (chi 0 rows -> bao tai lai).
      const { data: updated, error: err } = await supabase
        .from("support_plans")
        .update({
          status: to,
          ...(to === "approved" ? { approved_by: meId } : {}),
        })
        .eq("id", planId)
        .eq("status", status)
        .select("id");
      if (err) {
        console.error("[plan-actions] update support_plans:", err.message);
        setError("Không cập nhật được kế hoạch - vui lòng thử lại.");
        return;
      }
      if (!updated?.length) {
        setError("Kế hoạch đã được xử lý ở phiên khác - vui lòng tải lại trang.");
        router.refresh();
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
            disabled={pending || disabled}
          >
            {next.label}
          </Button>
        )}
        {cancellable && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => update("cancelled")}
            disabled={pending || disabled}
          >
            Hủy
          </Button>
        )}
      </span>
      {error && <span className="text-xs text-error">{error}</span>}
    </span>
  );
}
