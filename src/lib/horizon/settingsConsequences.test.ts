import { describe, expect, it } from 'vite-plus/test';
import type { LedgerEvent, ProjectionDay } from '@roman-mik/kapa-core/horizon';
import type { EventOrder } from '@roman-mik/kapa-core/horizon/queries';
import { formatFullDate } from '@/lib/date';
import {
  compareScenarios,
  eventOrderLabel,
  firstNegativeDay,
  swapIncomeObligation,
} from './settingsConsequences';

function day(date: string, balanceMinor: number): ProjectionDay {
  return { date, balanceMinor, events: [] as LedgerEvent[] };
}

describe('firstNegativeDay', () => {
  it('returns the first day with a negative balance', () => {
    const days = [day('2026-09-01', 100), day('2026-09-02', -50), day('2026-09-03', -10)];
    expect(firstNegativeDay(days)?.date).toBe('2026-09-02');
  });

  it('returns null when no day goes negative', () => {
    expect(firstNegativeDay([day('2026-09-01', 0), day('2026-09-02', 5)])).toBeNull();
  });

  it('returns null for an empty series', () => {
    expect(firstNegativeDay([])).toBeNull();
  });
});

describe('swapIncomeObligation', () => {
  const DEFAULT: EventOrder = 'income,oneOffIn,obligation,plannedSpend,oneOffOut';

  it('swaps income and obligation positions', () => {
    expect(swapIncomeObligation(DEFAULT)).toBe('obligation,oneOffIn,income,plannedSpend,oneOffOut');
  });

  it('is its own inverse', () => {
    expect(swapIncomeObligation(swapIncomeObligation(DEFAULT))).toBe(DEFAULT);
  });

  it('is a no-op when a kind is missing', () => {
    const order = 'income,oneOffIn,plannedSpend,oneOffOut' as EventOrder;
    expect(swapIncomeObligation(order)).toBe(order);
  });
});

describe('eventOrderLabel', () => {
  it('labels income-first when income precedes obligation', () => {
    expect(eventOrderLabel('income,obligation' as EventOrder)).toBe('Income-first');
  });

  it('labels obligations-first when obligation precedes income', () => {
    expect(eventOrderLabel('obligation,income' as EventOrder)).toBe('Obligations-first');
  });
});

describe('compareScenarios', () => {
  it('says both stay positive when neither dips', () => {
    const a = { label: 'A', days: [day('2026-09-01', 10), day('2026-09-02', 20)] };
    const b = { label: 'B', days: [day('2026-09-01', 5), day('2026-09-02', 15)] };
    expect(compareScenarios(a, b, 'RSD')).toBe(
      'A and B both keep the balance above zero over this projection.'
    );
  });

  it('names only the scenario that dips, using its date and magnitude', () => {
    const a = { label: 'Income-first', days: [day('2026-09-04', 10)] };
    const b = { label: 'Obligations-first', days: [day('2026-09-04', -45376)] };
    const sentence = compareScenarios(a, b, 'RSD');
    expect(sentence).toContain('Income-first keeps');
    expect(sentence).toContain('above zero');
    expect(sentence).toContain('Obligations-first would show a dip');
    expect(sentence).not.toContain('-45376');
  });

  it('is symmetric — the dipping scenario is always named as the dip regardless of argument order', () => {
    const clean = { label: 'Clean', days: [day('2026-09-04', 10)] };
    const dips = { label: 'Dips', days: [day('2026-09-04', -500)] };
    expect(compareScenarios(clean, dips, 'RSD')).toContain('Clean keeps');
    expect(compareScenarios(dips, clean, 'RSD')).toContain('Clean keeps');
  });

  it('describes both troughs when both scenarios dip on different days', () => {
    const a = { label: 'A', days: [day('2026-09-04', -100)] };
    const b = { label: 'B', days: [day('2026-09-05', -900)] };
    const sentence = compareScenarios(a, b, 'RSD');
    expect(sentence).toContain('A dips to');
    expect(sentence).toContain('B dips to');
  });

  it('collapses to one sentence when both scenarios dip identically', () => {
    const a = { label: 'A', days: [day('2026-09-04', -100)] };
    const b = { label: 'B', days: [day('2026-09-04', -100)] };
    const sentence = compareScenarios(a, b, 'RSD');
    expect(sentence).toBe(`A and B both dip below zero starting ${formatFullDate('2026-09-04')}.`);
  });
});
