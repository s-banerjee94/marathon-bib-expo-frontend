/**
 * Money formatting that is safe on a fresh deployment where amounts or the
 * currency code may be missing. A null/undefined amount renders as the
 * zero-value for the currency; an unknown/missing currency falls back to INR,
 * and a bad ISO code degrades gracefully instead of throwing.
 */
const DEFAULT_CURRENCY = 'INR';

export function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  const value = amount ?? 0;
  const code = currency?.trim() || DEFAULT_CURRENCY;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Intl throws on an invalid currency code — degrade to "<CODE> <number>".
    return `${code} ${value.toLocaleString()}`;
  }
}
