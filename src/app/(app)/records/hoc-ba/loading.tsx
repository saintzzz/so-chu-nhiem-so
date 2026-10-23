export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="flex gap-2">
        <div className="h-9 w-20 rounded-full bg-muted" />
        <div className="h-9 w-20 rounded-full bg-muted" />
        <div className="h-9 w-20 rounded-full bg-muted" />
      </div>
      <div className="h-64 rounded-xl border border-border bg-card" />
    </div>
  );
}
