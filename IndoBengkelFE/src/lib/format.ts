import type { Locale } from "@/lib/api/types";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactCurrency(value: number) {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `Rp ${Math.round(value / 1_000)}rb`;
  return formatCurrency(value);
}

export function formatDate(
  value: string | Date,
  locale: Locale = "en",
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" },
) {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", options).format(
    typeof value === "string" ? new Date(value) : value,
  );
}

export function formatDateTime(value: string | Date, locale: Locale = "en") {
  return formatDate(value, locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value: string | Date, locale: Locale = "en") {
  return formatDate(value, locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatWeekday(value: string | Date, locale: Locale = "en") {
  return formatDate(value, locale, { weekday: "short" });
}

export function formatDistance(km?: number) {
  if (km === undefined || Number.isNaN(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function minutesUntil(value: string | Date) {
  return Math.max(0, Math.floor((new Date(value).getTime() - Date.now()) / 60_000));
}

export function relativeTime(value: string | Date, locale: Locale = "en") {
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale === "id" ? "id-ID" : "en", {
    numeric: "auto",
  });
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}
