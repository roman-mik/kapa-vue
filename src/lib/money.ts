import { CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';

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
