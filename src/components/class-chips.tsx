import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ClassChipItem {
  id: string;
  name: string;
}

/** Class switcher chips - renders only when the teacher owns more than one class. */
export function ClassChips({
  classes,
  selectedId,
  href,
}: {
  classes: ClassChipItem[];
  selectedId: string;
  href: string;
}) {
  if (classes.length <= 1) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Lớp:</span>
      {classes.map((c) => (
        <Link
          prefetch={false}
          key={c.id}
          href={`${href}?class=${c.id}`}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            c.id === selectedId
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
