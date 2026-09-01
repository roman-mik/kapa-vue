// The Timeline's day-by-day list, grouped by month. Folds the old "Month
// summary" and "Event detail" tables into one list: each month block carries
// its summary (end balance, low point, days-under) as the header and the
// events that land in it as the day rows — all derived in one place so month
// headers and rows can't drift apart. Pure assembly over already-computed
// data, no I/O or derivation in templates.

import type { LedgerEvent, MonthMetric } from '@roman-mik/kapa-core/horizon';
import type { DaysUnderMonth } from './daysUnder';

export interface TimelineMonth {
  /** 'YYYY-MM'. */
  month: string;
  /** Balance on the last day of the month within the range. */
  endBalanceMinor: number;
  /** Intra-month minimum, paired with its date (D2). */
  minBalanceMinor: number;
  /** 'YYYY-MM-DD'. */
  minBalanceDate: string;
  /** Days-under count for the month, 0 when the month never goes negative. */
  daysUnder: number;
  /** The events landing in this month, date-ascending. */
  events: LedgerEvent[];
}

const monthOf = (date: string): string => date.slice(0, 7);

/**
 * Builds the timeline's month blocks, ascending. `metrics` supplies the
 * balance summary; `daysUnder` supplies the per-month negative-day counts;
 * `events` supplies the day rows, grouped by their calendar month. A month
 * that appears only in one source still gets a complete block (every month
 * reported by `metrics.months` is included, with an empty row list when it
 * has no events).
 */
export function timelineMonths(
  metrics: { months: MonthMetric[] } | null,
  daysUnder: DaysUnderMonth[],
  events: LedgerEvent[]
): TimelineMonth[] {
  const eventsByMonth = new Map<string, LedgerEvent[]>();
  for (const event of events) {
    const month = monthOf(event.date);
    const list = eventsByMonth.get(month);
    if (list) list.push(event);
    else eventsByMonth.set(month, [event]);
  }
  for (const list of eventsByMonth.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  const underMap = new Map(daysUnder.map((d) => [d.month, d.daysUnder]));

  const months = metrics?.months ?? [];
  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  return sorted.map((m: MonthMetric): TimelineMonth => ({
    month: m.month,
    endBalanceMinor: m.endBalanceMinor,
    minBalanceMinor: m.minBalanceMinor,
    minBalanceDate: m.minBalanceDate,
    daysUnder: underMap.get(m.month) ?? 0,
    events: eventsByMonth.get(m.month) ?? [],
  }));
}
