import {
  coveredPeriod,
  formatMonthLabel,
  nextScheduledOccurrences,
  type ScheduleCalendar,
  type ScheduleRule,
} from '@roman-mik/kapa-core/horizon';
import type { SchedulePreviewItem } from './incomeEditor';

/**
 * What the obligation schedule fields on the form map to once stored.
 * Obligations are fixed amounts on their own due dates (D1), so the only
 * shapes the create form produces are day-of-month and month-end — this is
 * the whole "schedule editor" surface the Money-out edit needs.
 */
export interface ObligationRuleDraft {
  when: 'dayOfMonth' | 'monthEnd';
  /** The day of month (1–31); ignored when `when === 'monthEnd'`. */
  dueDay: number;
}

const PREVIEW_ID = 'preview-0';

/**
 * The stored-shaped rule `useObligations.update` would write for these fields,
 * with a stable preview id. `coversPeriod` is always `'same'` — the covered
 * period is the payment's own month (the create form pins this too).
 */
export function draftObligationRule(draft: ObligationRuleDraft): ScheduleRule & { id: string } {
  return {
    id: PREVIEW_ID,
    kind: draft.when === 'monthEnd' ? 'monthEnd' : 'dayOfMonth',
    dayOfMonth: draft.when === 'dayOfMonth' ? draft.dueDay : null,
    intervalDays: null,
    nthWeekday: null,
    weekday: null,
    anchorDate: null,
    slippagePolicy: 'nextBusinessDay',
    coversPeriod: 'same',
  };
}

/**
 * Maps an existing obligation's stored schedules back onto the form's
 * `when`/`dueDay` fields. Deterministic for every shape the create form can
 * produce (1× dayOfMonth or 1× monthEnd) — that's the only legacy an
 * obligation can have, since it was created through this same form.
 */
export function schedulesToObligationRule(
  schedules: { kind: string; day_of_month: number | null }[]
): ObligationRuleDraft {
  const single = schedules.find((s) => s.kind === 'dayOfMonth' || s.kind === 'monthEnd');
  if (single?.kind === 'monthEnd') return { when: 'monthEnd', dueDay: 15 };
  return { when: 'dayOfMonth', dueDay: single?.day_of_month ?? 1 };
}

/**
 * The next `count` payment dates this obligation would land on, starting
 * at-or-after `from` (`YYYY-MM-DD`, inclusive) — the H4 6-date preview,
 * same engine the Money-in editor uses.
 */
export function obligationPreviewDates(
  draft: ObligationRuleDraft,
  calendar: ScheduleCalendar,
  from: string,
  count = 6
): SchedulePreviewItem[] {
  const rule = draftObligationRule(draft);
  return nextScheduledOccurrences([rule], calendar, from, count).map((occ) => ({
    date: occ.date,
    shifted: occ.shifted,
    ...(occ.originalDate ? { originalDate: occ.originalDate } : {}),
    label: formatMonthLabel(coveredPeriod(occ.originalDate ?? occ.date, rule)),
  }));
}
