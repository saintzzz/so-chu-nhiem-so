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
