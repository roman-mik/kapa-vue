import { describe, expect, it } from 'vite-plus/test';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats a zero-exponent currency (RSD) with no decimals', () => {
    expect(formatMoney(52200, 'RSD')).toMatch(/52,?200/);
    expect(formatMoney(52200, 'RSD')).not.toMatch(/\./);
  });

  it('formats a two-exponent currency (EUR) with cents', () => {
    expect(formatMoney(1550, 'EUR')).toMatch(/15[.,]50/);
  });

  it('divides by the currency exponent, not a fixed factor', () => {
    // RSD has exponent 0, so amount_minor is already whole units.
    expect(formatMoney(1, 'RSD')).toMatch(/\b1\b/);
  });
});
