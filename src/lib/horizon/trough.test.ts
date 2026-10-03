import { describe, expect, it } from 'vite-plus/test';
import type { ProjectionDay, LedgerEvent } from '@roman-mik/kapa-core/horizon';
import { globalTrough } from './trough';

function day(date: string, balanceMinor: number): ProjectionDay {
  return { date, balanceMinor, events: [] as LedgerEvent[] };
}

describe('globalTrough', () => {
  it('returns the lowest balance with its date', () => {
    const days = [
      day('2026-09-01', 100),
      day('2026-09-10', -34813),
      day('2026-09-12', -23213),
      day('2026-09-14', -34813),
      day('2026-10-01', 91200),
    ];
    expect(globalTrough(days)).toEqual({ minBalanceMinor: -34813, minBalanceDate: '2026-09-10' });
  });

  it('ties on the earliest date, not the latest', () => {
    const days = [day('2026-09-02', -1000), day('2026-09-01', -1000)];
    expect(globalTrough(days)).toEqual({ minBalanceMinor: -1000, minBalanceDate: '2026-09-01' });
  });

  it('is the current-month minimum when the low sits inside the first month', () => {
    const days = [day('2026-09-01', 5000), day('2026-09-02', -1000), day('2026-09-03', 2000)];
    expect(globalTrough(days)).toEqual({ minBalanceMinor: -1000, minBalanceDate: '2026-09-02' });
  });

  it('returns null for an empty series', () => {
    expect(globalTrough([])).toBeNull();
  });
});
