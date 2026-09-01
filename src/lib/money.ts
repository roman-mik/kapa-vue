import { CURRENCY_EXPONENT, type Currency, type FxRate } from '@roman-mik/kapa-core/pocket';

// The exponent (decimal places) comes from kapa-core so it can never drift
// from the DB's currency check constraint. The Intl.NumberFormat call itself
// is presentation-only and has no DOM dependency, so it stays here rather
// than in kapa-core (whose tsconfig deliberately excludes `lib: dom`).
export function formatMoney(amountMinor: number, currency: Currency): string {
  const exponent = CURRENCY_EXPONENT[currency];
  const amount = amountMinor / 10 ** exponent;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(amount);
}

// The rate itself, not the money it prices — `€1.015 @ 117,2` names the
// snapshot rate beside the native amount rather than implying live FX.
export function formatRate(rate: FxRate): string {
  const value = rate.rateE8 / 1e8;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value);
}
