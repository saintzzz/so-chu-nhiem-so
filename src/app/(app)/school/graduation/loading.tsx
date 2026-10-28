export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-6 p-6">
      <div className="h-8 w-56 rounded-lg bg-muted" />
      <div className="h-4 w-96 rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}
