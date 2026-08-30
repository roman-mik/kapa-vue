import { describe, expect, it } from 'vite-plus/test';
import { horizonProjection, REPORTING_CURRENCY } from './horizonDemo';

const BASE_DATE = new Date(Date.UTC(2026, 0, 1));

describe('horizonProjection', () => {
  it('is deterministic — same base date, byte-identical output', () => {
    const a = horizonProjection(BASE_DATE);
    const b = horizonProjection(new Date(Date.UTC(2026, 0, 1)));
    expect(a).toEqual(b);
  });

  it('never lets month-end alone hide an interior negative day (D2)', () => {
    const projection = horizonProjection(BASE_DATE);
    expect(projection.monthEnd.every((m) => m.balanceMinor >= 0)).toBe(true);
    expect(projection.dailyBalances.some((d) => d.balanceMinor < 0)).toBe(true);
  });

  it('flags the first negative day and it matches the daily series', () => {
    const projection = horizonProjection(BASE_DATE);
    expect(projection.firstNegativeDate).not.toBeNull();
    const flagged = projection.dailyBalances.find((d) => d.date === projection.firstNegativeDate);
    expect(flagged?.balanceMinor).toBeLessThan(0);
  });

  // Pins the fixture's headline moment: solvent on the 1st, broke by the
  // 12th, and recovered before month end — exactly the D2 scenario this
  // demo exists to show. If a fixture tweak moves these numbers, the
  // landing page's copy (task 8) must move with them.
  it('pins the fixture trough — regression guard for the landing page copy', () => {
    const projection = horizonProjection(BASE_DATE);
    expect(projection.firstNegativeDate).toBe('2026-01-05');
    expect(projection.monthMinimum[0]).toEqual({
      month: '2026-01',
      date: '2026-01-12',
      balanceMinor: -28_120,
    });
    expect(projection.monthEnd[0]?.balanceMinor).toBeGreaterThanOrEqual(0);
  });

  it('every event applies its reporting-currency delta exactly (D3 ordering never corrupts the running balance)', () => {
    const projection = horizonProjection(BASE_DATE);
    for (const event of projection.events) {
      if (event.currency !== REPORTING_CURRENCY) continue;
      expect(event.balanceAfter).toBe(event.balanceBefore + event.amountMinor);
    }
    // The last event's balanceAfter (or the starting balance if no events)
    // must match the last daily balance recorded.
    const lastEvent = projection.events.at(-1);
    const lastDaily = projection.dailyBalances.at(-1);
    expect(lastEvent?.balanceAfter).toBe(lastDaily?.balanceMinor);
  });

  it('keeps every obligation on its own due date, in its own currency (D1, D15)', () => {
    const projection = horizonProjection(BASE_DATE);
    // 4 months of fixture → one Rent event per month, each its own due
    // date (never spread evenly across the month, see D1).
    const rent = projection.events.filter((e) => e.label === 'Rent');
    expect(rent).toHaveLength(4);
    expect(new Set(rent.map((e) => e.date)).size).toBe(4);
    for (const event of rent) expect(event.currency).toBe('EUR');
    const carLoan = projection.events.find((e) => e.label === 'Car loan');
    expect(carLoan?.currency).toBe('USD');
  });

  it('labels the covered period separately from the payment date (D4)', () => {
    const projection = horizonProjection(BASE_DATE);
    const rent = projection.events.find((e) => e.label === 'Rent');
    expect(rent?.coversPeriod).toBe('next month');
  });
});
