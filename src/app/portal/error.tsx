"use client";

import { useEffect } from "react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <h1 className="text-lg font-semibold">Đã có lỗi xảy ra</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Không tải được dữ liệu. Vui lòng thử lại.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
      >
        Thử lại
      </button>
    </div>
  );
}
