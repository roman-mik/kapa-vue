import type { ProjectionInput } from '@roman-mik/kapa-core/horizon';
export function input(): ProjectionInput {
  return {
    accounts: [
      {
        id: 'a',
        currency: 'EUR',
        current_balance_minor: 50000,
        archived: false,
        include_in_total: true,
      },
    ],
    incomeStreams: [],
    obligations: [],
    plannedSpend: [],
    oneOffEvents: [
      {
        id: 'salary',
        name: 'Salary',
        date: '2026-10-15',
        currency: 'EUR',
        amountMinor: 100000,
        direction: 'in',
        accountId: 'a',
      },
    ],
    pocketSpend: { actuals: [], forward: [] },
    todayKey: '2026-10-01',
    range: { from: '2026-10-01', to: '2026-10-31' },
    reportingCurrency: 'EUR',
    rates: [],
    calendar: { workingWeekdays: [1, 2, 3, 4, 5], holidays: [] },
    eventOrder: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
    assessment: {
      complete: true,
      issues: [],
      provenance: {
        spaceId: 's1',
        timeZone: 'Europe/Belgrade',
        generatedAt: '',
        fetchedAt: '',
        revision: '1',
        range: { from: '2026-10-01', to: '2026-10-31' },
        spendMode: 'cap',
        spendingWindow: null,
        historyReview: null,
        includedAccountIds: ['a'],
        excludedAccountIds: [],
        observationDates: [],
        fxDates: [],
      },
    },
  };
}
