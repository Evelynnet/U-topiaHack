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
