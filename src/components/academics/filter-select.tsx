"use client";

import { usePathname, useRouter } from "next/navigation";

export interface FilterOption {
  value: string;
  label: string;
}

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

  return (
    <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => {
          const sp = new URLSearchParams(params);
          sp.set(name, e.target.value);
          router.push(`${pathname}?${sp.toString()}`);
        }}
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
