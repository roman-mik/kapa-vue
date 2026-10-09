import {
  applyCautiousScenario,
  buildProjection,
  cautiousCandidates,
  occurrenceFingerprint,
  type ProjectionInput,
} from '@roman-mik/kapa-core/horizon';
import { convertToCurrency, type Currency } from '@roman-mik/kapa-core/pocket';
import { spliceDraft } from './dryRunProjection';
import { entryDateSchema } from './entryValidation';

export interface AllowanceAllocation {
  date: string;
  amountMinor: number;
  availableMinor: number;
}
export type CashflowTrial =
  | {
      kind: 'purchase';
      name: string;
      amountMinor: number;
      currency: Currency;
      accountId: string;
      date: string;
      allocationCurrency: Currency;
      allocations: AllowanceAllocation[];
    }
  | { kind: 'billDate'; occurrenceKey: string; fingerprint: string; date: string };

/** Available allowance after existing payment allocations, never the unreduced raw cap. */
export function trialAllowance(base: ProjectionInput) {
  if (!base.lifecycle) return base.pocketSpend.forward;
  return buildProjection(base)
    .value.events.filter((e) => e.kind === 'pocketSpend' && e.date >= base.todayKey)
    .map((e) => ({ dateKey: e.date, amountMinor: Math.max(0, -e.amountMinor) }));
}

/** Transform forecast inputs only; this module has no persistence dependencies. */
export function applyCashflowTrial(base: ProjectionInput, trial: CashflowTrial): ProjectionInput {
  if (
    !entryDateSchema.safeParse(trial.date).success ||
    trial.date < base.todayKey ||
    trial.date > base.range.to
  )
    throw new Error('Choose a date inside the current forecast.');
  if (trial.kind === 'billDate') {
    const original = cautiousCandidates(base).find((o) => o.expected.key === trial.occurrenceKey);
    if (
      !original ||
      original.expected.amountMinor >= 0 ||
      occurrenceFingerprint(original) !== trial.fingerprint
    )
      throw new Error('This bill changed. Review the trial before continuing.');
    return applyCautiousScenario(base, {
      changes: [
        {
          occurrenceKey: trial.occurrenceKey,
          fingerprint: trial.fingerprint,
          amountMinor: Math.abs(original.expected.amountMinor),
          date: trial.date,
          reason: 'Temporary bill date comparison',
        },
      ],
      dailySpend: null,
    });
  }
  if (!Number.isSafeInteger(trial.amountMinor) || trial.amountMinor <= 0)
    throw new Error('Enter a positive purchase amount.');
  if (!base.accounts.some((a) => a.id === trial.accountId && a.include_in_total && !a.archived))
    throw new Error('Choose an included account.');
  if (trial.allocations.length && trial.allocationCurrency !== base.reportingCurrency)
    throw new Error('Reporting currency changed. Review allowance allocations.');
  const prior = buildProjection(base);
  const availableForward = trialAllowance(base);
  const purchaseCost = convertToCurrency(
    trial.amountMinor,
    trial.currency,
    base.reportingCurrency,
    trial.date,
    base.rates
  );
  const allocations = new Map<string, AllowanceAllocation>();
  for (const a of trial.allocations) {
    const rows = availableForward.filter((d) => d.dateKey === a.date);
    const available = rows.reduce((sum, d) => sum + d.amountMinor, 0);
    if (
      allocations.has(a.date) ||
      a.date < base.todayKey ||
      a.date > base.range.to ||
      !Number.isSafeInteger(a.amountMinor) ||
      a.amountMinor <= 0 ||
      available !== a.availableMinor ||
      a.amountMinor > available
    )
      throw new Error(
        'Allowance changed or allocation exceeds the dated amount. Review the trial.'
      );
    allocations.set(a.date, a);
  }
  const covered = trial.allocations.reduce((sum, a) => sum + a.amountMinor, 0);
  if (covered && (purchaseCost === undefined || covered > purchaseCost))
    throw new Error('Allowance allocation must not exceed the converted purchase cost.');
  // Consume each explicit date once, including inputs containing multiple rows on that date.
  const remaining = new Map([...allocations].map(([date, a]) => [date, a.amountMinor]));
  const forward = availableForward.map((d) => {
    const consumed = Math.min(d.amountMinor, remaining.get(d.dateKey) ?? 0);
    remaining.set(d.dateKey, (remaining.get(d.dateKey) ?? 0) - consumed);
    return { ...d, amountMinor: d.amountMinor - consumed };
  });
  return spliceDraft(
    {
      ...base,
      pocketSpend: { ...base.pocketSpend, forward },
      ...(base.lifecycle
        ? {
            lifecycle: {
              ...base.lifecycle,
              allowanceCoverage: { mode: 'separate' as const },
              issues: [...base.lifecycle.issues, ...(prior.value.lifecycleIssues ?? [])],
            },
          }
        : {}),
    },
    {
      kind: 'oneOff',
      value: {
        name: trial.name.trim() || 'Purchase trial',
        category: 'other',
        accountId: trial.accountId,
        currency: trial.currency,
        date: trial.date,
        amountMinor: trial.amountMinor,
        direction: 'out',
      },
    }
  );
}
