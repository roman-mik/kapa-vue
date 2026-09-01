import { describe, expect, it } from 'vite-plus/test';
import type { ProjectionInput } from '@roman-mik/kapa-core/horizon';
import type { NewIncomeStream } from '@/composables/useIncomeStreams';
import type { NewObligation } from '@/composables/useObligations';
import type { NewOneOffEvent } from '@/composables/useOneOffEvents';
import { diffEffect, spliceDraft, type DraftEntry } from './dryRunProjection';

const TODAY = '2026-09-01';

function baseInput(range: { from: string; to: string }): ProjectionInput {
  return {
    accounts: [
      {
        id: 'acc-1',
        currency: 'RSD',
        current_balance_minor: 100_000,
        include_in_total: true,
        archived: false,
      },
    ],
    incomeStreams: [],
    obligations: [],
    oneOffEvents: [],
    plannedSpend: [],
    pocketSpend: { actuals: [], forward: [] },
    todayKey: TODAY,
    range,
    reportingCurrency: 'RSD',
    rates: [],
    calendar: { workingWeekdays: [0, 1, 2, 3, 4, 5, 6], holidays: [] },
    eventOrder: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
  };
}

describe('spliceDraft + diffEffect', () => {
  it('a same-day one-off out lowers todayDeltaMinor by exactly its amount', () => {
    const baseline = baseInput({ from: TODAY, to: '2026-09-10' });
    const draft: DraftEntry = {
      kind: 'oneOff',
      value: {
        name: 'Coffee',
        category: 'other',
        currency: 'RSD',
        accountId: 'acc-1',
        date: TODAY,
        amountMinor: 500,
        direction: 'out',
      } satisfies NewOneOffEvent,
    };
    const effect = diffEffect(baseline, spliceDraft(baseline, draft));
    expect(effect.todayDeltaMinor).toBe(-500);
  });

  it('a same-day one-off in raises todayDeltaMinor by exactly its amount', () => {
    const baseline = baseInput({ from: TODAY, to: '2026-09-10' });
    const draft: DraftEntry = {
      kind: 'oneOff',
      value: {
        name: 'Refund',
        category: 'other',
        currency: 'RSD',
        accountId: 'acc-1',
        date: TODAY,
        amountMinor: 700,
        direction: 'in',
      } satisfies NewOneOffEvent,
    };
    const effect = diffEffect(baseline, spliceDraft(baseline, draft));
    expect(effect.todayDeltaMinor).toBe(700);
  });

  it('a future obligation does not move todayDeltaMinor', () => {
    const baseline = baseInput({ from: TODAY, to: '2026-09-10' });
    const draft: DraftEntry = {
      kind: 'obligation',
      value: {
        name: 'Rent',
        category: 'housing',
        currency: 'RSD',
        accountId: 'acc-1',
        startDate: TODAY,
        amountMinor: 40_000,
        rule: { kind: 'dayOfMonth', dayOfMonth: 5 },
      } satisfies NewObligation,
    };
    const effect = diffEffect(baseline, spliceDraft(baseline, draft));
    expect(effect.todayDeltaMinor).toBe(0);
  });

  it('a future obligation changes the trough when it precedes the current low', () => {
    const baseline = baseInput({ from: TODAY, to: '2026-09-10' });
    const before = diffEffect(baseline, baseline);
    expect(before.troughBefore).toEqual({ minBalanceMinor: 100_000, minBalanceDate: TODAY });

    const draft: DraftEntry = {
      kind: 'obligation',
      value: {
        name: 'Rent',
        category: 'housing',
        currency: 'RSD',
        accountId: 'acc-1',
        startDate: TODAY,
        amountMinor: 150_000,
        rule: { kind: 'dayOfMonth', dayOfMonth: 5 },
      } satisfies NewObligation,
    };
    const effect = diffEffect(baseline, spliceDraft(baseline, draft));
    expect(effect.troughAfter).toEqual({ minBalanceMinor: -50_000, minBalanceDate: '2026-09-05' });
    expect(effect.troughChanged).toBe(true);
  });

  it('a recurring fixed income stream is reflected on its pay day, not today', () => {
    const baseline = baseInput({ from: TODAY, to: '2026-09-10' });
    const draft: DraftEntry = {
      kind: 'incomeStream',
      value: {
        name: 'Freelance',
        kind: 'fixed',
        currency: 'RSD',
        accountId: 'acc-1',
        startDate: TODAY,
        earningPeriodKind: 'monthly',
        hourlyRateMinor: null,
        hoursPerDayE2: null,
        lagDays: 0,
        amountMinor: 20_000,
        paymentRule: 'dayOfMonth',
        payDay: 5,
        taxable: false,
        confidence: 'confirmed',
        recurrence: 'recurring',
      } satisfies NewIncomeStream,
    };
    const effect = diffEffect(baseline, spliceDraft(baseline, draft));
    expect(effect.todayDeltaMinor).toBe(0);
    expect(effect.troughChanged).toBe(false);
  });
});
