/** Extracts the charged amount from a pasted Saudi bank SMS/notification.
 *
 * Rules, in priority order:
 *  1. An explicit "total due" line (اجمالي/إجمالي المبلغ المستحق, "Total due
 *     amount") — when fees/VAT are itemized this is the real charge.
 *  2. An inline "(Total SAR 626.7)" from English prose messages.
 *  3. A مبلغ/Amount line, taking the number adjacent to SAR/SR/ريال — which
 *     also resolves foreign-currency lines like "350 EUR (1505.46 ريال)" to
 *     the riyal equivalent. Handles "24 SAR", "SR 200", and "25SR".
 *  4. Any other currency-adjacent number in a safe line.
 *
 * Lines mentioning balances, limits, fees, VAT, or exchange rates are never
 * used (رصيد/balance/limit/رسوم/fees/ضريبة/vat/سعر الصرف/exchange rate/متاح).
 */

const CUR_AFTER = /(\d[\d,]*(?:\.\d+)?)\s*(?:SAR|SR|ريال)/i;
const CUR_BEFORE = /(?:SAR|SR)\s*[: ]*(\d[\d,]*(?:\.\d+)?)/i;
const RIYAL_PAREN = /\((\d[\d,]*(?:\.\d+)?)\s*ريال\)/;
const TOTAL_LINE = /(?:[إا]جمالي\s*المبلغ\s*المستحق|total\s*due\s*amount)[^0-9]*(\d[\d,]*(?:\.\d+)?)/i;
const TOTAL_INLINE = /total\s*(?:SAR|SR)\s*[: ]*(\d[\d,]*(?:\.\d+)?)/i;
const NEVER = /رصيد|balance|limit|رسوم|fee|vat|ضريبة|سعر\s*الصرف|exchange\s*rate|متاح/i;

function toNum(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 && n < 1e9 ? Math.round(n * 100) / 100 : null;
}

export function extractAmount(text: string): number | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());

  for (const line of lines) {
    const m = line.match(TOTAL_LINE);
    if (m) return toNum(m[1]);
  }
  for (const line of lines) {
    const m = line.match(TOTAL_INLINE);
    if (m) return toNum(m[1]);
  }
  const currencyAdjacent = (line: string): number | null => {
    const paren = line.match(RIYAL_PAREN);
    if (paren) return toNum(paren[1]);
    const after = line.match(CUR_AFTER);
    if (after) return toNum(after[1]);
    const before = line.match(CUR_BEFORE);
    if (before) return toNum(before[1]);
    return null;
  };
  for (const line of lines) {
    if (NEVER.test(line) || !/مبلغ|amount/i.test(line)) continue;
    const n = currencyAdjacent(line);
    if (n != null) return n;
  }
  for (const line of lines) {
    if (NEVER.test(line)) continue;
    const n = currencyAdjacent(line);
    if (n != null) return n;
  }
  return null;
}

/** The pasted message, tidied for the description field: line breaks are
 * kept (descriptions are multi-line), trailing spaces and blank lines go. */
export function cleanMessage(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}
