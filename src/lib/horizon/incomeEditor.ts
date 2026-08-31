import {
  coveredPeriod,
  formatMonthLabel,
  nextScheduledOccurrences,
  paymentOccurrences,
  type ScheduleCalendar,
  type ScheduleRule,
} from '@roman-mik/kapa-core/horizon';

/**
 * What the schedule editor needs to render the H4 6-date preview live, from
 * the form's current field values. Mirrors how `useIncomeStreams.add`
 * turns the same fields into stored rows, so the dates shown before saving
 * are exactly the ones the Money-in list (and projection) will use after.
 *
 * Hourly streams pay out from H6 earning-period math, not the placeholder
 * day-of-month schedule, so they take a different path: `paymentOccurrences`
 * over the next months, same call the list uses.
 */

export interface SchedulePreviewDraft {
  kind: 'hourly' | 'fixed' | 'variable';
  paymentRule: 'dayOfMonth' | 'monthEnd' | 'semiMonthly';
  payDay: number;
  earningPeriodKind: 'monthly' | 'semiMonthly';
  lagDays: number;
}

export interface SchedulePreviewItem {
  /** `YYYY-MM-DD`, after slippage. */
  date: string;
  shifted: boolean;
  /** Present only when `shifted` — the date before slippage. */
  originalDate?: string;
  /** Covered month ("Sep") for fixed payments; the earning period for hourly. */
  label?: string;
}

/**
 * Maps an existing stream's stored schedules back onto the form's
 * `paymentRule`/`payDay` fields. Deterministic for every shape the create
 * form can produce (1× `dayOfMonth`, 1× `monthEnd`, or the semi-monthly
 * 1st-and-15th pair) — that's the only legacy a stream can have, since it was
 * created through this same form.
 */
export function schedulesToPaymentRule(
  schedules: { kind: string; day_of_month: number | null }[]
): { paymentRule: 'dayOfMonth' | 'monthEnd' | 'semiMonthly'; payDay: number } {
  const single = schedules.length === 1 ? schedules[0] : null;
  if (schedules.length === 2 && schedules.every((s) => s.kind === 'dayOfMonth')) {
    const days = schedules.map((s) => s.day_of_month).sort((a, b) => (a ?? 0) - (b ?? 0));
    if (days[0] === 1 && days[1] === 15) return { paymentRule: 'semiMonthly', payDay: 15 };
  }
  if (single?.kind === 'monthEnd') return { paymentRule: 'monthEnd', payDay: 15 };
  if (single?.kind === 'dayOfMonth' && single.day_of_month) {
    return { paymentRule: 'dayOfMonth', payDay: single.day_of_month };
  }
  return { paymentRule: 'dayOfMonth', payDay: 15 };
}

const PREVIEW_ID = 'preview-0';

function baseRule(slippage: ScheduleRule['slippagePolicy'] = 'nextBusinessDay'): ScheduleRule {
  return {
    kind: 'dayOfMonth',
    dayOfMonth: null,
    intervalDays: null,
    nthWeekday: null,
    weekday: null,
    anchorDate: null,
    slippagePolicy: slippage,
    coversPeriod: 'same',
  };
}

/** The stored-shaped rules `add` would write, with stable preview ids. */
export function draftScheduleRules(draft: SchedulePreviewDraft): (ScheduleRule & { id: string })[] {
  const nextBusinessDay = baseRule('nextBusinessDay');
  if (draft.kind === 'hourly') {
    return [{ ...nextBusinessDay, id: PREVIEW_ID, dayOfMonth: 15 }];
  }
  if (draft.paymentRule === 'monthEnd') {
    return [{ ...nextBusinessDay, id: PREVIEW_ID, kind: 'monthEnd' }];
  }
  if (draft.paymentRule === 'semiMonthly') {
    return [
      { ...nextBusinessDay, id: PREVIEW_ID, dayOfMonth: 1 },
      { ...nextBusinessDay, id: 'preview-1', dayOfMonth: 15 },
    ];
  }
  return [{ ...nextBusinessDay, id: PREVIEW_ID, dayOfMonth: draft.payDay }];
}

function monthlyKey(date: string): string {
  return date.slice(0, 7);
}

/** Next monthly key after `key` (`YYYY-MM`). */
function nextMonthKey(key: string): string {
  const [year, month1] = key.split('-').map(Number);
  return month1 === 12 ? `${year + 1}-01` : `${year}-${String(month1 + 1).padStart(2, '0')}`;
}

/**
 * The next `count` payment dates a stream with these fields would land on,
 * starting at-or-after `from` (`YYYY-MM-DD`, inclusive).
 */
export function buildSchedulePreview(
  draft: SchedulePreviewDraft,
  calendar: ScheduleCalendar,
  from: string,
  count = 6
): SchedulePreviewItem[] {
  if (draft.kind === 'hourly') {
    const stream = {
      id: PREVIEW_ID,
      kind: 'hourly' as const,
      hourlyRateMinor: null,
      hoursPerDayE2: null,
      fixedAmountMinor: null,
      earningPeriod: {
        kind: draft.earningPeriodKind,
        customPeriodStartDay: null,
        customPeriodDays: null,
      },
      startDate: from,
      endDate: null,
    };
    const schedule = {
      ...draftScheduleRules(draft)[0],
      lagDays: draft.lagDays,
    };
    const items: SchedulePreviewItem[] = [];
    let month = monthlyKey(from);
    for (let guard = 0; guard < 24 && items.length < count; guard++) {
      for (const occurrence of paymentOccurrences(stream, [schedule], calendar, month)) {
        if (occurrence.date < from) continue;
        items.push({
          date: occurrence.date,
          shifted: occurrence.shifted,
          ...(occurrence.originalDate ? { originalDate: occurrence.originalDate } : {}),
          ...(occurrence.periodLabel ? { label: occurrence.periodLabel } : {}),
        });
      }
      month = nextMonthKey(month);
    }
    return items.slice(0, count);
  }

  const rules = draftScheduleRules(draft);
  return nextScheduledOccurrences(rules, calendar, from, count).map((occ) => ({
    date: occ.date,
    shifted: occ.shifted,
    ...(occ.originalDate ? { originalDate: occ.originalDate } : {}),
    ...(occ.scheduleId ? { label: monthLabelFor(occ, rules) } : {}),
  }));
}

function monthLabelFor(
  occ: { date: string; originalDate?: string },
  rules: (ScheduleRule & { id: string })[]
): string {
  const rule = rules[0];
  const paymentDate = occ.originalDate ?? occ.date;
  return formatMonthLabel(coveredPeriod(paymentDate, rule));
}
