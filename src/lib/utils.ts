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

// Current emulation period ("2026-T9") in Vietnam timezone.
export function currentPeriodVN(): string {
  const p = vnParts(new Date());
  return `${p.year}-T${Number(p.month)}`;
}

// Current school semester ("2026-HK1"). VN school year: HK1 Aug-Dec,
// HK2 Jan-Jul (belongs to the school year started the previous August).
export function currentSemesterVN(): string {
  const p = vnParts(new Date());
  const y = Number(p.year);
  const m = Number(p.month);
  return m >= 8 ? `${y}-HK1` : `${y - 1}-HK2`;
}

// Current school year label ("2026-2027"). VN school year starts in August.
export function currentSchoolYearVN(): string {
  const p = vnParts(new Date());
  const y = Number(p.year);
  const m = Number(p.month);
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

// First and last calendar day of the current month in Vietnam timezone.
export function currentMonthRangeVN(): { start: string; end: string } {
  const p = vnParts(new Date());
  const y = Number(p.year);
  const m = Number(p.month);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${last}` };
}

const WD_LONG = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];
const WD_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Day-of-week (0=CN) in Vietnam timezone - deterministic across ICU builds. */
function weekdayVN(iso: string | Date): number {
  const p = vnParts(iso);
  return new Date(
    Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)),
  ).getUTCDay();
}

export function formatDate(
  iso: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  // Intl weekday names differ between server/client ICU builds -> render
  // them ourselves to avoid hydration mismatch.
  const { weekday, ...rest } = options ?? {};
  const base = new Date(iso).toLocaleDateString("vi-VN", {
    timeZone: VN_TZ,
    ...rest,
  });
  if (!weekday) return base;
  const name = (weekday === "short" ? WD_SHORT : WD_LONG)[weekdayVN(iso)];
  return `${name}, ${base}`;
}

export function formatDateTime(
  iso: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const { weekday, ...rest } = options ?? {};
  const base = new Date(iso).toLocaleString("vi-VN", {
    timeZone: VN_TZ,
    ...rest,
  });
  if (!weekday) return base;
  const name = (weekday === "short" ? WD_SHORT : WD_LONG)[weekdayVN(iso)];
  return `${name}, ${base}`;
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
