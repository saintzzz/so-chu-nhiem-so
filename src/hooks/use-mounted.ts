"use client";

import { useSyncExternalStore } from "react";

// useMounted: true sau hydration. Next 16 render client components trong
// layout voi pathname context stale -> usePathname-dependent output phai
// gate sau mounted de SSR va hydration giong het nhau (tranh mismatch).
export function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
