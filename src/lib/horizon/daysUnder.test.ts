import { describe, expect, it } from 'vite-plus/test';
import type { ProjectionDay, LedgerEvent } from '@roman-mik/kapa-core/horizon';
import { daysUnder, daysUnderPerMonth } from './daysUnder';

function day(date: string, balanceMinor: number): ProjectionDay {
  return { date, balanceMinor, events: [] as LedgerEvent[] };
}

describe('daysUnder', () => {
  it('counts only days with a negative balance', () => {
    const days = [
      day('2026-09-01', 100),
      day('2026-09-02', -50),
      day('2026-09-03', -10),
      day('2026-09-04', 0),
      day('2026-09-05', 250),
    ];
    expect(daysUnder(days)).toBe(2);
  });

  it('returns zero for an all-positive series', () => {
    expect(daysUnder([day('2026-09-01', 1), day('2026-09-02', 2)])).toBe(0);
  });

  it('handles an empty series', () => {
    expect(daysUnder([])).toBe(0);
  });
});

describe('daysUnderPerMonth', () => {
  it('groups negative days by month, ascending', () => {
    const days = [
      day('2026-08-29', -1),
      day('2026-08-30', -2),
      day('2026-08-31', 10),
      day('2026-09-01', -3),
      day('2026-09-02', 5),
      day('2026-10-01', -4),
    ];
    expect(daysUnderPerMonth(days)).toEqual([
      { month: '2026-08', daysUnder: 2 },
      { month: '2026-09', daysUnder: 1 },
      { month: '2026-10', daysUnder: 1 },
    ]);
  });

  it('omits months with no negative days', () => {
    const days = [
      day('2026-09-01', 1),
      day('2026-09-02', 2),
      day('2026-09-03', 3),
      day('2026-10-01', -1),
    ];
    expect(daysUnderPerMonth(days)).toEqual([{ month: '2026-10', daysUnder: 1 }]);
  });

  it('handles an empty series', () => {
    expect(daysUnderPerMonth([])).toEqual([]);
  });

  it('counts a stretch crossing a month-boundary into each month', () => {
    const days = [day('2026-09-30', -5), day('2026-10-01', -6), day('2026-10-02', 0)];
    expect(daysUnderPerMonth(days)).toEqual([
      { month: '2026-09', daysUnder: 1 },
      { month: '2026-10', daysUnder: 1 },
    ]);
  });
});
