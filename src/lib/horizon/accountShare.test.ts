import { describe, expect, it } from 'vite-plus/test';
import { accountShareOfTotal } from './accountShare';

describe('accountShareOfTotal', () => {
  it('returns the fraction of the total for an included account', () => {
    expect(accountShareOfTotal(2500, 10000, true)).toBe(0.25);
  });

  it('returns null for an excluded account regardless of amount', () => {
    expect(accountShareOfTotal(2500, 10000, false)).toBeNull();
  });

  it('returns null for an unconvertible amount', () => {
    expect(accountShareOfTotal(null, 10000, true)).toBeNull();
  });

  it('returns zero when the total is zero', () => {
    expect(accountShareOfTotal(0, 0, true)).toBe(0);
  });

  it('returns zero when the total is negative', () => {
    expect(accountShareOfTotal(100, -500, true)).toBe(0);
  });

  it('shares across included accounts sum to 1', () => {
    const amounts = [4000, 3500, 2500];
    const total = amounts.reduce((a, b) => a + b, 0);
    const shares = amounts.map((a) => accountShareOfTotal(a, total, true) ?? 0);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});
