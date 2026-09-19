import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const VN_TZ = "Asia/Ho_Chi_Minh";

export function formatDate(
  iso: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    timeZone: VN_TZ,
    ...options,
  });
}

export function formatDateTime(
  iso: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(iso).toLocaleString("vi-VN", { timeZone: VN_TZ, ...options });
}

export function formatDateOnly(
  yyyymmdd: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatDate(yyyymmdd + "T00:00:00", options);
}

const VN_COLLATOR = new Intl.Collator("vi", { sensitivity: "base" });

// Vietnamese convention sorts by given name (last token), then full name.
export function compareVietnameseName(a: string, b: string): number {
  const lastA = a.trim().split(/\s+/).pop() ?? "";
  const lastB = b.trim().split(/\s+/).pop() ?? "";
  return VN_COLLATOR.compare(lastA, lastB) || VN_COLLATOR.compare(a, b);
}

export function sortByVietnameseName<T>(rows: T[], get: (r: T) => string): T[] {
  return [...rows].sort((x, y) => compareVietnameseName(get(x), get(y)));
}
