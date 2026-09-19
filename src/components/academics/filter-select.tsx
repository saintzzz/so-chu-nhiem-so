"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

/** Render as inline chips when the option set is small (<= 4). */
const CHIP_THRESHOLD = 4;

/**
 * Select that persists its value in the URL search params so the
 * Server Component page re-fetches with the new filter.
 */
export function FilterSelect({
  name,
  label,
  value,
  options,
  params,
}: {
  name: string;
  label: string;
  value: string;
  options: FilterOption[];
  params: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const choose = (v: string) => {
    const sp = new URLSearchParams(params);
    sp.set(name, v);
    router.push(`${pathname}?${sp.toString()}`);
  };

  if (options.length <= CHIP_THRESHOLD) {
    return (
      <fieldset className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        <legend className="sr-only">{label}</legend>
        <span aria-hidden>{label}</span>
        <div className="flex h-9 items-center gap-1.5">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={value === o.value}
              onClick={() => choose(o.value)}
              className={cn(
                "h-full rounded-lg border px-2.5 text-sm font-medium transition-colors",
                value === o.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => choose(e.target.value)}
        className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
