import { toDigits } from "./format";

/** Normalize a user-typed phone number to the digits-only E.164 form GoTrue
 * expects (e.g. "966512345678"). Saudi-friendly: local "05xxxxxxxx" and bare
 * "5xxxxxxxx" get the 966 country code; anything else must already include
 * its country code. Returns null when it can't be a valid number. */
export function normalizePhone(input: string): string | null {
  let d = toDigits(input);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("05")) d = "966" + d.slice(1);
  else if (d.length === 9 && d.startsWith("5")) d = "966" + d;
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

/** Display form: "+966 5x xxx xxxx"-ish, just a leading plus. */
export function displayPhone(e164: string): string {
  return "+" + e164;
}
