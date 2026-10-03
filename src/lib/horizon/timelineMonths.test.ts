import { describe, expect, it } from 'vite-plus/test';
import type { HorizonMetrics, LedgerEvent, MonthMetric } from '@roman-mik/kapa-core/horizon';
import { timelineMonths } from './timelineMonths';

function event(date: string, label: string, amountMinor: number): LedgerEvent {
  return {
    date,
    originalDate: date,
    shifted: false,
    kind: 'obligation',
    label,
    sourceId: label,
    amountMinor,
    nativeCurrency: 'RSD',
    nativeAmountMinor: amountMinor,
    unconvertible: false,
    accountId: 'a1',
    coveredPeriod: null,
    recurring: true,
    balanceBeforeMinor: 0,
    balanceAfterMinor: amountMinor,
  };
}

function metric(month: string, endBalanceMinor: number, minBalanceMinor: number): MonthMetric {
  return {
    month,
    endBalanceMinor,
    minBalanceMinor,
    minBalanceDate: `${month}-14`,
    surplusMinor: 0,
  };
}

const metrics: HorizonMetrics = {
  horizonDate: '2026-10-31',
  endBalanceMinor: 0,
  months: [metric('2026-09', 91200, -34813), metric('2026-10', 100000, 50000)],
  firstNegativeDay: '2026-09-10',
  firstNegativeDayMinor: -14000,
  runwayMonths: 0.5,
};

const daysUnder = [
  { month: '2026-09', daysUnder: 12 },
  { month: '2026-10', daysUnder: 0 },
];

describe('timelineMonths', () => {
  it('builds one ascending block per month metric, combining summary and events', () => {
    const events = [event('2026-09-02', 'Rent', -50000), event('2026-10-01', 'Salary', 100000)];
    const months = timelineMonths(metrics, daysUnder, events);

    expect(months.map((m) => m.month)).toEqual(['2026-09', '2026-10']);
    expect(months[0]).toMatchObject({
      month: '2026-09',
      endBalanceMinor: 91200,
      minBalanceMinor: -34813,
      minBalanceDate: '2026-09-14',
      daysUnder: 12,
    });
    expect(months[0].events.map((e) => e.label)).toEqual(['Rent']);
    expect(months[1].daysUnder).toBe(0);
    expect(months[1].events.map((e) => e.label)).toEqual(['Salary']);
  });

  it('groups events into the month their date falls in, date-ascending', () => {
    const events = [event('2026-09-20', 'Later', -1), event('2026-09-02', 'Earlier', -2)];
    const months = timelineMonths(metrics, daysUnder, events);
    expect(months[0].events.map((e) => e.label)).toEqual(['Earlier', 'Later']);
  });

  it('gives a month with no events an empty list rather than dropping it', () => {
    const months = timelineMonths(metrics, daysUnder, []);
    expect(months).toHaveLength(2);
    expect(months[0].events).toEqual([]);
  });

  it('caps the days-under count at the per-month figure, defaulting to 0', () => {
    const months = timelineMonths(metrics, daysUnder, []);
    expect(months[1].daysUnder).toBe(0);
  });

  it('returns an empty list when there are no months', () => {
    expect(timelineMonths({ months: [] }, [], [event('2026-09-02', 'Rent', -50)])).toEqual([]);
  });
});
