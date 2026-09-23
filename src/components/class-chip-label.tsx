"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/** Chip content - shows a spinner the moment the link is clicked,
 *  while the server-rendered target is still loading. */
export function ClassChipLabel({ name }: { name: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex items-center gap-1.5">
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {name}
    </span>
  );
}
