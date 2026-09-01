// Pure diff/phrasing for the Settings consequence copy (task 14). Given two
// already-computed `ProjectionDay[]` series for the same range, describes how
// their first negative day differs in a sentence with real dates and
// amounts — never a placeholder. No I/O here; the composable does the
// fetching and the two `buildProjection` calls.

import type { ProjectionDay } from '@roman-mik/kapa-core/horizon';
import type { EventOrder } from '@roman-mik/kapa-core/horizon/queries';
import type { Currency } from '@roman-mik/kapa-core/pocket';
import { formatFullDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';

/** The first day whose end-of-day balance is below zero, or `null` if none. */
export function firstNegativeDay(days: ProjectionDay[]): ProjectionDay | null {
  return days.find((d) => d.balanceMinor < 0) ?? null;
}

/** Swaps `income` and `obligation`'s positions in an event-order string. No-op if either is absent. */
export function swapIncomeObligation(order: EventOrder): EventOrder {
  const kinds = order.split(',');
  const i = kinds.indexOf('income');
  const j = kinds.indexOf('obligation');
  if (i === -1 || j === -1) return order;
  [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  return kinds.join(',') as EventOrder;
}

/** 'Income-first' when income processes before obligations on a shared day, else 'Obligations-first'. */
export function eventOrderLabel(order: EventOrder): string {
  const kinds = order.split(',');
  return kinds.indexOf('income') < kinds.indexOf('obligation')
    ? 'Income-first'
    : 'Obligations-first';
}

export interface ConsequenceScenario {
  label: string;
  days: ProjectionDay[];
}

/**
 * Compares two scenarios' first negative day and phrases the difference.
 * Symmetric in `a`/`b` — the scenario with no dip is always named as the one
 * that "keeps" the date above zero, regardless of argument order.
 */
export function compareScenarios(
  a: ConsequenceScenario,
  b: ConsequenceScenario,
  currency: Currency
): string {
  const negA = firstNegativeDay(a.days);
  const negB = firstNegativeDay(b.days);

  if (!negA && !negB) {
    return `${a.label} and ${b.label} both keep the balance above zero over this projection.`;
  }
  if (negA && negB) {
    if (negA.date === negB.date && negA.balanceMinor === negB.balanceMinor) {
      return `${a.label} and ${b.label} both dip below zero starting ${formatFullDate(negA.date)}.`;
    }
    return (
      `${a.label} dips to ${formatMoney(negA.balanceMinor, currency)} on ${formatFullDate(negA.date)}; ` +
      `${b.label} dips to ${formatMoney(negB.balanceMinor, currency)} on ${formatFullDate(negB.date)}.`
    );
  }
  const clean = negA ? b : a;
  const dipped = negA ? a : b;
  const dip = (negA ?? negB) as ProjectionDay;
  return (
    `${clean.label} keeps ${formatFullDate(dip.date)} above zero; ${dipped.label} would show a dip ` +
    `of ${formatMoney(Math.abs(dip.balanceMinor), currency)} that never really happens.`
  );
}
