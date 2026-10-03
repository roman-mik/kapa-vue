// The projection-wide low point, derived from a `ProjectionDay[]` series.
// "Lowest point ahead" spans the whole horizon, not just the current month —
// the current-month minimum (`MonthMetric.months[0]`) is not necessarily the
// trough a reader should be warned about. Pure reduction, no I/O, so it lives
// here (and is unit-tested) rather than in templates.

import type { ProjectionDay } from '@roman-mik/kapa-core/horizon';

export interface Trough {
  minBalanceMinor: number;
  /** The date `minBalanceMinor` occurred — always paired (D2), never reported alone. */
  minBalanceDate: string;
}

/**
 * The lowest `balanceMinor` across all days, paired with the first date that
 * reaches it. `null` when `days` is empty.
 */
export function globalTrough(days: ProjectionDay[]): Trough | null {
  if (days.length === 0) return null;
  let min = days[0];
  for (const day of days) {
    if (day.balanceMinor < min.balanceMinor) min = day;
    else if (day.balanceMinor === min.balanceMinor && day.date < min.date) min = day;
  }
  return { minBalanceMinor: min.balanceMinor, minBalanceDate: min.date };
}
