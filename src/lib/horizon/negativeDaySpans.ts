// Consecutive negative-day grouping for the banner redesign. The composables
// hand over one `NegativeDayWarning` per day; this groups contiguous days of
// the same shortfall into a single span so the UI renders one card instead of
// stacking identical banners. Dismissal stays per-day — the DB key is
// `(negative_date, shortfall_minor)`.

import type { NegativeDayWarning } from '@roman-mik/kapa-core/horizon';

export interface NegativeDaySpan {
  /** Start date of the span (first negative day), used as the grouping key. */
  startDate: string;
  /** All warnings in the span, in date-ascending order. */
  warnings: NegativeDayWarning[];
}

/**
 * Group consecutive negative-day warnings into spans. Two consecutive days
 * belong to the same span when they carry the same `shortfallMinor`. A gap
 * (non-negative day) or a change in shortfall starts a new span.
 */
export function groupNegativeDayWarnings(warnings: NegativeDayWarning[]): NegativeDaySpan[] {
  if (warnings.length === 0) return [];

  const spans: NegativeDaySpan[] = [];
  let current: NegativeDaySpan = {
    startDate: warnings[0].date,
    warnings: [warnings[0]],
  };

  for (let i = 1; i < warnings.length; i++) {
    const prev = warnings[i - 1];
    const w = warnings[i];

    // Consecutive date with the same shortfall extends the current span.
    const prevDate = new Date(prev.date);
    const curDate = new Date(w.date);
    const oneDay = 24 * 60 * 60 * 1000;
    const isConsecutive = Math.abs(curDate.getTime() - prevDate.getTime()) === oneDay;

    if (isConsecutive && w.shortfallMinor === prev.shortfallMinor) {
      current.warnings.push(w);
    } else {
      spans.push(current);
      current = { startDate: w.date, warnings: [w] };
    }
  }

  spans.push(current);
  return spans;
}
