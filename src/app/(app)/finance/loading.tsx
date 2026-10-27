export default function FinanceLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-9 w-64 rounded-lg bg-muted" />
      <div className="flex gap-3">
        <div className="h-10 w-56 rounded-lg bg-muted" />
        <div className="h-10 w-40 rounded-lg bg-muted" />
      </div>
      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]">
        <div className="border-b border-border p-4"><div className="h-4 w-full max-w-sm rounded bg-muted" /></div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4 border-b border-border/50 p-4 last:border-0">
            <div className="h-4 flex-1 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
