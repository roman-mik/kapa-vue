import { expect, it } from 'vite-plus/test';
import {
  buildProjection,
  computeDecisionSummary,
  cautiousCandidates,
  occurrenceFingerprint,
  type ProjectionInput,
} from '@roman-mik/kapa-core/horizon';
import { input } from '@/composables/__fixtures__/cashflow';
import { applyCashflowTrial, type CashflowTrial } from './purchaseTrial';
function fixture(cautious = false): ProjectionInput {
  const base = input();
  base.oneOffEvents = [
    {
      id: 'rent',
      name: 'Rent',
      date: '2026-10-01',
      amountMinor: 30000,
      currency: 'EUR',
      accountId: 'a',
      direction: 'out',
    },
    {
      id: 'income',
      name: 'Income',
      date: cautious ? '2026-10-25' : '2026-10-15',
      amountMinor: cautious ? 90000 : 100000,
      currency: 'EUR',
      accountId: 'a',
      direction: 'in',
    },
  ];
  base.pocketSpend.forward = [{ dateKey: '2026-10-20', amountMinor: cautious ? 45000 : 40000 }];
  return base;
}
function trial(base: ProjectionInput, covered = false): CashflowTrial {
  return {
    kind: 'purchase',
    name: 'Purchase',
    amountMinor: 10000,
    currency: 'EUR',
    accountId: 'a',
    date: '2026-10-10',
    allocationCurrency: 'EUR',
    allocations: covered
      ? [
          {
            date: '2026-10-20',
            amountMinor: 10000,
            availableMinor: base.pocketSpend.forward[0]!.amountMinor,
          },
        ]
      : [],
  };
}
it.each([
  [false, false, 10000, 70000],
  [false, true, 10000, 80000],
  [true, false, -35000, 55000],
  [true, true, -25000, 65000],
])('matches F4/F5 and cautious fixtures (%s %s)', (cautious, covered, minimum, ending) => {
  const base = fixture(cautious);
  const snapshot = JSON.stringify(base);
  const next = applyCashflowTrial(base, trial(base, covered));
  const summary = computeDecisionSummary(next, buildProjection(next), 20000);
  expect(summary.selected.minimum.balanceMinor).toBe(minimum);
  expect(summary.selected.endingCashMinor).toBe(ending);
  expect(summary.nextIncome.window?.minimum.balanceMinor).toBe(minimum);
  expect(JSON.stringify(base)).toBe(snapshot);
});
it('rejects stale, excessive and duplicate allocations, changed scope and outside dates', () => {
  const base = fixture();
  const draft = trial(base, true);
  expect(() =>
    applyCashflowTrial({ ...base, pocketSpend: { actuals: [], forward: [] } }, draft)
  ).toThrow('Review');
  if (draft.kind !== 'purchase') return;
  expect(() =>
    applyCashflowTrial(base, {
      ...draft,
      allocations: [...draft.allocations, ...draft.allocations],
    })
  ).toThrow();
  expect(() => applyCashflowTrial(base, { ...draft, accountId: 'excluded' })).toThrow('included');
  expect(() => applyCashflowTrial(base, { ...draft, date: '2026-11-01' })).toThrow('forecast');
  expect(() => applyCashflowTrial(base, { ...draft, allocationCurrency: 'USD' })).toThrow(
    'currency'
  );
});
it('preserves incomplete inputs and missing purchase FX', () => {
  const base = fixture();
  base.assessment = { ...base.assessment!, complete: false };
  const draft = trial(base);
  if (draft.kind !== 'purchase') return;
  const next = applyCashflowTrial(base, { ...draft, currency: 'USD' });
  const result = buildProjection(next);
  expect(result.unconverted).not.toHaveLength(0);
  expect(computeDecisionSummary(next, result, 20000).complete).toBe(false);
});
it('moves only the selected bill and guards its fingerprint', () => {
  const base = fixture();
  const bill = cautiousCandidates(base).find((o) => o.expected.amountMinor < 0)!;
  const draft: CashflowTrial = {
    kind: 'billDate',
    occurrenceKey: bill.expected.key,
    fingerprint: occurrenceFingerprint(bill),
    date: '2026-10-10',
  };
  const next = applyCashflowTrial(base, draft);
  expect(buildProjection(next).value.events.find((e) => e.amountMinor < 0)?.date).toBe(
    '2026-10-10'
  );
  expect(base.oneOffEvents[0]!.date).toBe('2026-10-01');
  expect(() => applyCashflowTrial(base, { ...draft, fingerprint: 'old' })).toThrow('changed');
});

it('allocates only allowance remaining after existing payment coverage', () => {
  const base = fixture();
  const occurrences = cautiousCandidates(base);
  const rent = occurrences.find((o) => o.expected.amountMinor < 0)!;
  base.lifecycle = {
    observations: [
      { id: 'obs', accountId: 'a', date: base.todayKey, currency: 'EUR', balanceMinor: 50000 },
    ],
    occurrences,
    issues: [],
    allowanceCoverage: {
      mode: 'includesPayments',
      currency: 'EUR',
      allocations: [
        {
          occurrenceId: rent.id,
          occurrenceRevision: rent.revision,
          date: '2026-10-20',
          amountMinor: 30000,
        },
      ],
    },
  };
  const draft = trial(base, true);
  if (draft.kind !== 'purchase') return;
  expect(() => applyCashflowTrial(base, draft)).toThrow('Allowance changed');
  draft.allocations[0]!.availableMinor = 10000;
  const next = applyCashflowTrial(base, draft);
  expect(buildProjection(next).value.days.at(-1)!.balanceMinor).toBe(110000);
  expect(base.lifecycle.allowanceCoverage?.mode).toBe('includesPayments');
});

it('moves one recurring bill without changing the next recurrence', () => {
  const base = input();
  base.range.to = '2026-11-30';
  base.obligations = [
    {
      id: 'rent',
      name: 'Rent',
      currency: 'EUR',
      accountId: 'a',
      amountMinor: 30000,
      schedules: [
        {
          id: 'monthly',
          kind: 'dayOfMonth',
          dayOfMonth: 15,
          intervalDays: null,
          nthWeekday: null,
          weekday: null,
          anchorDate: null,
          slippagePolicy: 'nextBusinessDay',
          coversPeriod: 'same',
        },
      ],
    },
  ];
  const bill = cautiousCandidates(base).find(
    (o) => o.expected.date === '2026-10-15' && o.expected.amountMinor < 0
  )!;
  const next = applyCashflowTrial(base, {
    kind: 'billDate',
    occurrenceKey: bill.expected.key,
    fingerprint: occurrenceFingerprint(bill),
    date: '2026-10-20',
  });
  expect(
    buildProjection(next)
      .value.events.filter((e) => e.amountMinor < 0)
      .map((e) => e.date)
  ).toEqual(['2026-10-20', '2026-11-16']);
});
