// Days under zero derived from a `ProjectionDay[]` series. Derived from the
// raw days, never from `warnings` — warnings are dismissal-filtered and would
// undercount. Pure reductions, no I/O, so they live here (and are unit-tested)
// rather than in templates.

import type { ProjectionDay } from '@roman-mik/kapa-core/horizon';

/** The number of days in `days` whose end-of-day balance is below zero. */
export function daysUnder(days: ProjectionDay[]): number {
  return days.filter((d) => d.balanceMinor < 0).length;
}

/** Days under zero grouped by 'YYYY-MM', ascending, for month headers. */
export interface DaysUnderMonth {
  month: string;
  daysUnder: number;
}

export function daysUnderPerMonth(days: ProjectionDay[]): DaysUnderMonth[] {
  const counts = new Map<string, number>();
  for (const day of days) {
    if (day.balanceMinor < 0) {
      const month = day.date.slice(0, 7);
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([month, n]) => ({ month, daysUnder: n }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}
