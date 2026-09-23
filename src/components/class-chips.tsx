import Link from "next/link";
import { cn } from "@/lib/utils";
import { ClassChipLabel } from "@/components/class-chip-label";

export interface ClassChipItem {
  id: string;
  name: string;
}

/** Class switcher chips - renders only when the teacher owns more than one class. */
export function ClassChips({
  classes,
  selectedId,
  href,
  params,
}: {
  classes: ClassChipItem[];
  selectedId: string;
  href: string;
  /** Query params cần giữ lại khi đổi lớp (vd: date, from, to). */
  params?: Record<string, string>;
}) {
  if (classes.length <= 1) return null;
  const extra = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== ""),
  ).toString();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Lớp:</span>
      {classes.map((c) => (
        <Link
          prefetch={false}
          key={c.id}
          href={`${href}?class=${c.id}${extra ? `&${extra}` : ""}`}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            c.id === selectedId
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          <ClassChipLabel name={c.name} />
        </Link>
      ))}
    </div>
  );
}
