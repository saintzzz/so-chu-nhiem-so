import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const VN_TZ = "Asia/Ho_Chi_Minh";

// Current calendar date (YYYY-MM-DD) in Vietnam timezone.
export function todayVN(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ }).format(
    new Date(),
  );
}

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

const VN_DT_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function vnParts(iso: string | Date) {
  const parts: Record<string, string> = {};
  for (const p of VN_DT_PARTS.formatToParts(new Date(iso))) {
    parts[p.type] = p.value;
  }
  return parts;
}

// "20/09/2026 08:30" in Vietnam timezone — server TZ agnostic.
export function fmtDateTimeVN(iso: string | Date): string {
  const p = vnParts(iso);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

// "08:30 20/09/2026" in Vietnam timezone.
export function fmtTimeDateVN(iso: string | Date): string {
  const p = vnParts(iso);
  return `${p.hour}:${p.minute} ${p.day}/${p.month}/${p.year}`;
}

// "20/09/2026" in Vietnam timezone.
export function fmtDateVN(iso: string | Date): string {
  const p = vnParts(iso);
  return `${p.day}/${p.month}/${p.year}`;
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
