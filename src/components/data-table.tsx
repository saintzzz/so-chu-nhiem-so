import Link from "next/link";
import { cn } from "@/lib/utils";

export function DataTable({
  columns,
  children,
  footer,
  className,
}: {
  columns: React.ReactNode[];
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-sm-token)]",
        className,
      )}
    >
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {columns.map((c, i) => (
              <th
                key={i}
                className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr]:border-b [&_tr]:border-border [&_tr:last-child]:border-0 [&_td]:px-4 [&_td]:py-2.5">
          {children}
        </tbody>
      </table>
      {footer && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}

export function Pagination({
  total,
  page,
  pageSize,
  href,
  onPage,
}: {
  total: number;
  page: number;
  pageSize: number;
  /** URL builder for server-driven pagination. */
  href?: (page: number) => string;
  /** Callback for client-driven pagination. */
  onPage?: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const btn = "rounded-md border border-border px-2 py-0.5 text-sm transition-colors enabled:hover:bg-muted disabled:opacity-40";
  const nav = (target: number, label: string, enabled: boolean) =>
    onPage ? (
      <button
        type="button"
        className={btn}
        disabled={!enabled}
        onClick={() => onPage(target)}
      >
        {label}
      </button>
    ) : href ? (
      enabled ? (
        <Link prefetch={false} href={href(target)} className={btn}>
          {label}
        </Link>
      ) : (
        <button type="button" className={btn} disabled>
          {label}
        </button>
      )
    ) : (
      <span>{label}</span>
    );
  return (
    <>
      <span>{total} kết quả</span>
      <span className="flex items-center gap-2">
        {nav(page - 1, "Trước", page > 1)}
        <span>
          Trang {page}/{pages}
        </span>
        {nav(page + 1, "Sau", page < pages)}
      </span>
    </>
  );
}
