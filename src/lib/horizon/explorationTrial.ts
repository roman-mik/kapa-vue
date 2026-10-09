import {
  buildProjection,
  calendarMonthEndpoint,
  generateTrackedOccurrences,
  type ProjectionInput,
  type ProjectionResult,
  type DecisionSummary,
  type DecisionWindow,
  type CashPoint,
} from '@roman-mik/kapa-core/horizon';
import { convertToCurrency, type Currency } from '@roman-mik/kapa-core/pocket';
import { entryDateSchema } from './entryValidation';

export interface ExplorationTrial {
  kind: 'exploration';
  purpose: 'spending' | 'saving';
  savingTreatment: 'earmark' | 'outside';
  cadence: 'once' | 'monthly';
  amountMinor: number;
  currency: Currency;
  accountId: string;
  date: string;
  endDate: string;
}
export function explorationDates(base: ProjectionInput, trial: ExplorationTrial): string[] {
  if (!Number.isSafeInteger(trial.amountMinor) || trial.amountMinor <= 0)
    throw new Error('Enter a positive amount per occurrence.');
  if (
    ![trial.date, trial.endDate].every((d) => entryDateSchema.safeParse(d).success) ||
    trial.date < base.todayKey ||
    trial.endDate < trial.date ||
    trial.endDate > base.range.to
  )
    throw new Error('Choose start and end dates inside this forecast.');
  if (!base.accounts.some((a) => a.id === trial.accountId && a.include_in_total && !a.archived))
    throw new Error('Choose an included account.');
  if (trial.cadence === 'once') return [trial.date];
  const dates = [trial.date];
  for (let month = 1; month <= 120; month++) {
    const date = calendarMonthEndpoint(trial.date, month);
    if (date > trial.endDate) return dates;
    dates.push(date);
  }
  throw new Error('Monthly trials support up to ten years. Choose a shorter end date.');
}
export function applyExplorationTrial(
  base: ProjectionInput,
  trial: ExplorationTrial
): ProjectionInput {
  const dates = explorationDates(base, trial);
  if (!Number.isSafeInteger(dates.length * trial.amountMinor))
    throw new Error('The total trial amount exceeds the supported range.');
  if (trial.purpose === 'saving' && trial.savingTreatment === 'earmark') return base;
  const prior = buildProjection(base);
  const forward = base.lifecycle
    ? prior.value.events
        .filter((e) => e.kind === 'pocketSpend' && e.date >= base.todayKey)
        .map((e) => ({ dateKey: e.date, amountMinor: Math.max(0, -e.amountMinor) }))
    : base.pocketSpend.forward;
  const entries = dates.map((date) => ({
    id: '__exploration_' + date,
    name:
      trial.purpose === 'saving'
        ? 'Savings transfer outside included cash (trial)'
        : 'Additional spending (trial)',
    accountId: trial.accountId,
    currency: trial.currency,
    amountMinor: trial.amountMinor,
    direction: 'out' as const,
    date,
  }));
  const generated = generateTrackedOccurrences(
    { incomeStreams: [], obligations: [], oneOffEvents: entries },
    base.calendar,
    { from: base.todayKey, to: base.range.to },
    base.todayKey
  ).map((expected) => ({
    id: expected.key,
    expected,
    state: 'expected' as const,
    revision: 0,
    actual: null,
    postponedDate: null,
  }));
  return {
    ...base,
    oneOffEvents: [...base.oneOffEvents, ...entries],
    pocketSpend: { ...base.pocketSpend, forward },
    ...(base.lifecycle
      ? {
          lifecycle: {
            ...base.lifecycle,
            occurrences: [...base.lifecycle.occurrences, ...generated],
            allowanceCoverage: { mode: 'separate' as const },
            issues: [...base.lifecycle.issues, ...(prior.value.lifecycleIssues ?? [])],
          },
        }
      : base.temporaryOccurrences
        ? { temporaryOccurrences: [...base.temporaryOccurrences, ...generated] }
        : {}),
  };
}
/** Earmarking changes a dated required reserve, never the cash ledger or movement totals. */
export function assessExplorationReserve(
  base: ProjectionInput,
  result: ProjectionResult,
  summary: DecisionSummary,
  reserve: number | null,
  trial: ExplorationTrial
): DecisionSummary {
  if (trial.purpose !== 'saving' || trial.savingTreatment !== 'earmark') return summary;
  const earmarks = explorationDates(base, trial).map((date) => {
    const amount = convertToCurrency(
      trial.amountMinor,
      trial.currency,
      base.reportingCurrency,
      date,
      base.rates
    );
    if (amount === undefined)
      throw new Error('Missing FX for the dated savings reserve. Coverage cannot be assessed.');
    return { date, amount };
  });
  if (reserve === null) return { ...summary, reserveValid: false };
  const floorAt = (date: string) => {
    const total = earmarks
      .filter((e) => e.date <= date)
      .reduce((sum, e) => sum + e.amount, reserve);
    if (!Number.isSafeInteger(total))
      throw new Error('Savings reserve exceeds the supported amount.');
    return total;
  };
  function window(w: DecisionWindow): DecisionWindow {
    let first: CashPoint | null = null,
      shortfall = 0;
    const check = (point: CashPoint) => {
      const deficit = Math.max(0, floorAt(point.date) - point.balanceMinor);
      if (deficit > 0 && !first) first = point;
      shortfall = Math.max(shortfall, deficit);
    };
    let balance = w.startingCashMinor;
    check({ date: w.from, balanceMinor: balance, cause: 'Starting cash and savings reserve' });
    for (const day of result.days.filter((d) => d.date >= w.from && d.date <= w.to)) {
      check({
        date: day.date,
        balanceMinor: balance,
        cause: 'Dated savings reserve before movements',
      });
      for (const e of day.events) {
        check({
          date: day.date,
          balanceMinor: e.balanceBeforeMinor,
          cause: 'Before ' + e.label,
          occurrenceId: e.occurrenceId,
        });
        check({
          date: day.date,
          balanceMinor: e.balanceAfterMinor,
          cause: e.label,
          occurrenceId: e.occurrenceId,
        });
      }
      balance = day.balanceMinor;
      check({ date: day.date, balanceMinor: balance, cause: 'Day end with savings reserve' });
    }
    return { ...w, firstReserveBreach: first, reserveShortfallMinor: shortfall };
  }
  return {
    ...summary,
    selected: window(summary.selected),
    nextIncome: {
      ...summary.nextIncome,
      window: summary.nextIncome.window ? window(summary.nextIncome.window) : null,
    },
    months: summary.months.map((m) => ({ ...window(m), month: m.month, partial: m.partial })),
  };
}
