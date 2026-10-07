export default function PortalLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải">
      <div className="flex items-center gap-3">
        <div className="size-10 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          <div className="h-3 w-72 max-w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}
