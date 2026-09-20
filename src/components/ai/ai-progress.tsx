"use client";

import { Sparkles } from "lucide-react";

/**
 * Trạng thái chờ xử lý AI - thanh progress indeterminate.
 * Không nhắc đến provider/quota/fallback: người dùng chỉ thấy "đang xử lý".
 */
export function AiProgress({ label = "Đang xử lý..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-primary/20 bg-primary-bg px-3 py-2.5"
    >
      <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="size-3.5 animate-pulse" />
        {label}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
        <div className="h-full w-1/3 animate-[ai-slide_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
    </div>
  );
}
