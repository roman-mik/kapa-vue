import { expect, it } from 'vite-plus/test';
import { buildProjection, computeDecisionSummary } from '@roman-mik/kapa-core/horizon';
import { input } from '@/composables/__fixtures__/cashflow';
import {
  applyExplorationTrial,
  assessExplorationReserve,
  explorationDates,
  type ExplorationTrial,
} from './explorationTrial';
function trial(patch: Partial<ExplorationTrial> = {}): ExplorationTrial {
  return {
    kind: 'exploration',
    purpose: 'spending',
    savingTreatment: 'earmark',
    cadence: 'once',
    amountMinor: 10000,
    currency: 'EUR',
    accountId: 'a',
    date: '2026-10-10',
    endDate: '2026-10-31',
    ...patch,
  };
}
it('checks finite one-off spending and outside savings without mutating baseline', () => {
  const base = input();
  const before = JSON.stringify(base);
  for (const purpose of ['spending', 'saving'] as const) {
    const next = applyExplorationTrial(base, trial({ purpose, savingTreatment: 'outside' }));
    const summary = computeDecisionSummary(next, buildProjection(next), 45000);
    expect(summary.selected.minimum.balanceMinor).toBe(40000);
    expect(summary.selected.reserveShortfallMinor).toBe(5000);
    expect(summary.selected.endingCashMinor).toBe(140000);
  }
  expect(JSON.stringify(base)).toBe(before);
});
it('earmarks cash in place without changing cash or net movements, checking dated reserve', () => {
  const base = input();
  const draft = trial({ purpose: 'saving', amountMinor: 35000 });
  const next = applyExplorationTrial(base, draft);
  const result = buildProjection(next);
  const summary = assessExplorationReserve(
    next,
    result.value,
    computeDecisionSummary(next, result, 20000),
    20000,
    draft
  );
  expect(summary.selected.endingCashMinor).toBe(150000);
  expect(summary.selected.netMovementMinor).toBe(100000);
  expect(summary.selected.reserveShortfallMinor).toBe(5000);
  expect(summary.selected.firstReserveBreach?.date).toBe('2026-10-10');
});
it('preserves equality, checks intraday shortfalls and does not use a later receipt to fund an earlier reserve', () => {
  const base = input();
  base.oneOffEvents.unshift({
    id: 'bill',
    name: 'Bill',
    amountMinor: 60000,
    currency: 'EUR',
    accountId: 'a',
    date: '2026-10-15',
    direction: 'out',
  });
  base.eventOrder = 'oneOffOut,oneOffIn,income,obligation,plannedSpend';
  const draft = trial({ purpose: 'saving', amountMinor: 30000, date: '2026-10-15' });
  const result = buildProjection(base);
  const summary = assessExplorationReserve(
    base,
    result.value,
    computeDecisionSummary(base, result, 20000),
    20000,
    draft
  );
  expect(summary.selected.firstReserveBreach?.date).toBe('2026-10-15');
  expect(summary.selected.reserveShortfallMinor).toBe(60000);
  const clean = input();
  const r = buildProjection(clean);
  expect(
    assessExplorationReserve(
      clean,
      r.value,
      computeDecisionSummary(clean, r, 20000),
      20000,
      trial({ purpose: 'saving', amountMinor: 30000 })
    ).selected.reserveShortfallMinor
  ).toBe(0);
});
it('anchors monthly dates with short-month clamping and finite recurrence', () => {
  const base = input();
  base.todayKey = '2026-01-01';
  base.range = { from: base.todayKey, to: '2026-04-30' };
  const draft = trial({ cadence: 'monthly', date: '2026-01-31', endDate: '2026-04-30' });
  expect(explorationDates(base, draft)).toEqual([
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
  ]);
  expect(
    buildProjection(applyExplorationTrial(base, draft)).value.events.filter(
      (e) => e.amountMinor < 0
    )
  ).toHaveLength(4);
});
it('rejects unsupported scope/dates and missing earmark FX; keeps incomplete forecasts qualified', () => {
  const base = input();
  const result = buildProjection(base);
  expect(() => applyExplorationTrial(base, trial({ accountId: 'excluded' }))).toThrow('included');
  expect(() => applyExplorationTrial(base, trial({ endDate: '2026-11-01' }))).toThrow('forecast');
  expect(() =>
    assessExplorationReserve(
      base,
      result.value,
      computeDecisionSummary(base, result, 20000),
      20000,
      trial({ purpose: 'saving', currency: 'USD' })
    )
  ).toThrow('FX');
  base.assessment!.issues = [{ code: 'missingCap', message: 'Review spending', repair: 'cap' }];
  const next = applyExplorationTrial(base, trial());
  expect(computeDecisionSummary(next, buildProjection(next), 20000).complete).toBe(false);
});
