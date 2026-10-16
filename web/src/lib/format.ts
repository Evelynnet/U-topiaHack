import type { Locale } from "@/i18n/config";

const BANGKOK_OFFSET_MS = 7 * 3_600_000;

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

export function formatMoney(amount: number): string {
  return `฿${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** The next full hour in Thailand time, as a local date string (YYYY-MM-DD) and hour (0-23). */
export function nextBangkokHour(): { date: string; hour: number } {
  const next = (Math.floor((Date.now() + BANGKOK_OFFSET_MS) / 3_600_000) + 1) * 3_600_000;
  const iso = new Date(next).toISOString(); // already shifted to Bangkok wall-clock
  return { date: iso.slice(0, 10), hour: Number(iso.slice(11, 13)) };
}

/** Bangkok wall-clock date + hour -> UTC ISO string (Thailand has no DST). */
export function bangkokToIso(date: string, hour: number): string {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+07:00`).toISOString();
}

export function todayBangkok(): string {
  return new Date(Date.now() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Adds whole days to a YYYY-MM-DD date string (calendar arithmetic, no time zone involved). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week that contains the given YYYY-MM-DD date. */
export function weekStartOf(date: string): string {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -dow);
}

/** "Mon 12 Oct" / "จ. 12 ต.ค." for a YYYY-MM-DD date. */
export function formatDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
