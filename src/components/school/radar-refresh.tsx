"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshRadarWarnings } from "@/app/(app)/school/radar/actions";

export function RadarRefreshButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await refreshRadarWarnings();
            setMsg(
              r.error
                ? `Lỗi: ${r.error}`
                : r.inserted
                  ? `Đã tạo ${r.inserted} cảnh báo mới.`
                  : "Không có cảnh báo mới.",
            );
          })
        }
      >
        <RefreshCw className={pending ? "animate-spin" : ""} />
        {pending ? "Đang đồng bộ..." : "Làm mới cảnh báo"}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </span>
  );
}
