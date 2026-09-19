export function PageHeader({
  section,
  title,
  description,
  actions,
}: {
  section?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        {section && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {section}
          </p>
        )}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
