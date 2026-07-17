import type { Lang } from "./i18n";

// Arabic-Indic (٠-٩) and Extended/Persian (۰-۹) digits. An Arabic keyboard
// produces these, but parseFloat, `\d`, GoTrue and <input type="number"> all
// only understand 0-9 — so every numeric field folds to Latin on the way in.
const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

export function toLatinDigits(input: string): string {
  return input.replace(ARABIC_DIGITS, (d) => {
    const code = d.charCodeAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}

/** Digits only, folded to Latin — for OTP codes and phone numbers. */
export function toDigits(input: string): string {
  return toLatinDigits(input).replace(/\D/g, "");
}

/** What an amount field may hold: digits in either script plus a single
 * decimal separator (Arabic ٫ folds to '.', ٬ and ',' are thousands
 * separators and drop out). Capped at 2 decimals to match the column's
 * numeric(14,2) — the DB would round anyway, better to show it while typing. */
export function sanitizeAmount(input: string): string {
  const latin = toLatinDigits(input)
    .replace(/٫/g, ".")
    .replace(/[٬,]/g, "");
  const [whole, ...rest] = latin.replace(/[^\d.]/g, "").split(".");
  // rest non-empty means at least one '.' was typed; join collapses extras so
  // "1.2.3" settles to "1.23" rather than being rejected outright.
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

/** Currency with thousands separators; Latin digits in both languages,
 * matching the original app's ledger style. */
export function fmtMoney(amount: number, currency: string, lang: Lang) {
  return new Intl.NumberFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Today in the user's own timezone, as yyyy-mm-dd.
 *
 * Deliberately not `toISOString().slice(0, 10)`, which is UTC: in UTC+3 that
 * stamps anything logged before 03:00 local with yesterday's date. Entries are
 * dated automatically now and the form has no date field to correct it with,
 * so the value has to be right the first time. */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Short localized date for transaction rows, e.g. "12 Jul 2026". */
export function fmtDate(isoDate: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
  }).format(new Date(isoDate + "T00:00:00"));
}

/** "today", "3 days ago", "2 months ago" — localized. */
export function fmtRelative(iso: string, lang: Lang) {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return rtf.format(0, "day");
  if (days < 30) return rtf.format(-days, "day");
  if (days < 365) return rtf.format(-Math.round(days / 30), "month");
  return rtf.format(-Math.round(days / 365), "year");
}
