export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-6 p-6">
      <div className="h-8 w-64 rounded-lg bg-muted" />
      <div className="h-4 w-96 rounded bg-muted" />
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}
