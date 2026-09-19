"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Textarea that grows vertically with its content instead of clipping.
 * Use for notes/comments/remarks — replaces single-line inputs that cut
 * off long Vietnamese remarks.
 */
export function AutoGrowTextarea({
  className,
  value,
  bare = false,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { bare?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={cn(
        bare
          ? // In-table editing: no box of its own — the cell is the container.
            // Underline appears on hover/focus like Fluent inline fields.
            "block w-full resize-none overflow-hidden border-0 border-b border-transparent bg-transparent px-0 py-0.5 text-sm outline-none transition-colors hover:border-border focus:border-primary"
          : "block w-full resize-none overflow-hidden rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}
