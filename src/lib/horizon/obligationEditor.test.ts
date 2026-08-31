import { describe, expect, it } from 'vite-plus/test';
import {
  draftObligationRule,
  obligationPreviewDates,
  schedulesToObligationRule,
} from './obligationEditor';

// Mon–Fri, no holidays — the default the space has before H5 config.
const CALENDAR = { workingWeekdays: [1, 2, 3, 4, 5], holidays: [] };

describe('draftObligationRule', () => {
  it('maps day-of-month to a single clamped rule with the picked due day', () => {
    const rule = draftObligationRule({ when: 'dayOfMonth', dueDay: 20 });
    expect(rule).toMatchObject({
      kind: 'dayOfMonth',
      dayOfMonth: 20,
      slippagePolicy: 'nextBusinessDay',
      coversPeriod: 'same',
    });
  });

  it('maps month-end to a monthEnd rule', () => {
    const rule = draftObligationRule({ when: 'monthEnd', dueDay: 15 });
    expect(rule.kind).toBe('monthEnd');
    expect(rule.dayOfMonth).toBeNull();
  });
});

describe('schedulesToObligationRule', () => {
  it('round-trips a dayOfMonth schedule onto when/dueDay', () => {
    expect(schedulesToObligationRule([{ kind: 'dayOfMonth', day_of_month: 5 }])).toEqual({
      when: 'dayOfMonth',
      dueDay: 5,
    });
  });

  it('round-trips a monthEnd schedule', () => {
    expect(schedulesToObligationRule([{ kind: 'monthEnd', day_of_month: null }])).toEqual({
      when: 'monthEnd',
      dueDay: 15,
    });
  });

  it('falls back to day-of-month on an empty or unknown schedule set', () => {
    expect(schedulesToObligationRule([])).toEqual({ when: 'dayOfMonth', dueDay: 1 });
    expect(schedulesToObligationRule([{ kind: 'nthWeekday', day_of_month: null }])).toEqual({
      when: 'dayOfMonth',
      dueDay: 1,
    });
  });
});

describe('obligationPreviewDates', () => {
  it('shows the next 6 dayOfMonth dates with shifted markers for weekend slips', () => {
    const items = obligationPreviewDates(
      { when: 'dayOfMonth', dueDay: 15 },
      CALENDAR,
      '2026-09-15'
    );
    expect(items.slice(0, 3)).toEqual([
      { date: '2026-09-15', shifted: false, label: 'Sep' },
      { date: '2026-10-15', shifted: false, label: 'Oct' },
      // 15 Nov 2026 is a Sunday → pays Mon 16 Nov, still covering November.
      { date: '2026-11-16', shifted: true, originalDate: '2026-11-15', label: 'Nov' },
    ]);
    expect(items).toHaveLength(6);
  });

  it('labels a slipped month-end by its covered period, not the payment date (D3)', () => {
    const items = obligationPreviewDates({ when: 'monthEnd', dueDay: 15 }, CALENDAR, '2026-09-15');
    expect(items.slice(0, 3)).toEqual([
      { date: '2026-09-30', shifted: false, label: 'Sep' },
      // 31 Oct 2026 is a Saturday → pays Mon 2 Nov but still covers October.
      { date: '2026-11-02', shifted: true, originalDate: '2026-10-31', label: 'Oct' },
      { date: '2026-11-30', shifted: false, label: 'Nov' },
    ]);
  });
});
