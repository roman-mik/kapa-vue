import { describe, expect, it } from 'vite-plus/test';
import { buildSchedulePreview, draftScheduleRules, schedulesToPaymentRule } from './incomeEditor';

// Mon–Fri, no holidays — the default the space has before H5 config.
const CALENDAR = { workingWeekdays: [1, 2, 3, 4, 5], holidays: [] };

describe('draftScheduleRules', () => {
  it('maps fixed dayOfMonth to a single clamped rule with the picked pay day', () => {
    const rules = draftScheduleRules({
      kind: 'fixed',
      paymentRule: 'dayOfMonth',
      payDay: 20,
      earningPeriodKind: 'monthly',
      lagDays: 0,
    });
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      kind: 'dayOfMonth',
      dayOfMonth: 20,
      slippagePolicy: 'nextBusinessDay',
      coversPeriod: 'same',
    });
  });

  it('maps monthEnd and the semi-monthly pair to their schedule shapes', () => {
    const monthEnd = draftScheduleRules({
      kind: 'fixed',
      paymentRule: 'monthEnd',
      payDay: 15,
      earningPeriodKind: 'monthly',
      lagDays: 0,
    });
    expect(monthEnd[0].kind).toBe('monthEnd');

    const semi = draftScheduleRules({
      kind: 'variable',
      paymentRule: 'semiMonthly',
      payDay: 15,
      earningPeriodKind: 'monthly',
      lagDays: 0,
    });
    expect(semi.map((r) => r.dayOfMonth)).toEqual([1, 15]);
  });

  it('uses the placeholder 15th for hourly — the payment math wins from there', () => {
    const rules = draftScheduleRules({
      kind: 'hourly',
      paymentRule: 'dayOfMonth',
      payDay: 3,
      earningPeriodKind: 'monthly',
      lagDays: 0,
    });
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ dayOfMonth: 15 });
  });
});

describe('buildSchedulePreview — fixed/variable', () => {
  it('shows the next 6 dayOfMonth dates with shifted markers for weekend slips', () => {
    const items = buildSchedulePreview(
      {
        kind: 'fixed',
        paymentRule: 'dayOfMonth',
        payDay: 20,
        earningPeriodKind: 'monthly',
        lagDays: 0,
      },
      CALENDAR,
      '2026-09-01'
    );
    // Sep 20 2026 is a Sunday → slips to Monday the 21st.
    expect(items[0]).toMatchObject({
      date: '2026-09-21',
      shifted: true,
      originalDate: '2026-09-20',
      label: 'Sep',
    });
    expect(items[1]).toMatchObject({ date: '2026-10-20', shifted: false, label: 'Oct' });
    expect(items).toHaveLength(6);
  });

  it('monthEnd claims ranges and mutates across weekends', () => {
    const items = buildSchedulePreview(
      {
        kind: 'fixed',
        paymentRule: 'monthEnd',
        payDay: 15,
        earningPeriodKind: 'monthly',
        lagDays: 0,
      },
      CALENDAR,
      '2026-09-01'
    );
    expect(items[0]).toMatchObject({ date: '2026-09-30', shifted: false });
    // Oct 31 2026 is a Saturday → slips into November.
    expect(items[1]).toMatchObject({
      date: '2026-11-02',
      shifted: true,
      originalDate: '2026-10-31',
    });
  });

  it('semiMonthly merges 1st and 15th into one date stream', () => {
    const items = buildSchedulePreview(
      {
        kind: 'fixed',
        paymentRule: 'semiMonthly',
        payDay: 15,
        earningPeriodKind: 'monthly',
        lagDays: 0,
      },
      CALENDAR,
      '2026-09-01'
    );
    expect(items.map((i) => i.date)).toEqual([
      '2026-09-01',
      '2026-09-15',
      '2026-10-01',
      '2026-10-15',
      '2026-11-02',
      '2026-11-16',
    ]);
    expect(items[4]).toMatchObject({ shifted: true, originalDate: '2026-11-01' });
    expect(items[5]).toMatchObject({ shifted: true, originalDate: '2026-11-15' });
  });
});

describe('buildSchedulePreview — hourly (H6 payment math)', () => {
  it('dates semi-monthly earnings by period-end + lag, with covered-period labels', () => {
    const items = buildSchedulePreview(
      {
        kind: 'hourly',
        paymentRule: 'dayOfMonth',
        payDay: 15,
        earningPeriodKind: 'semiMonthly',
        lagDays: 15,
      },
      CALENDAR,
      '2026-09-01'
    );
    // Sep 1–15 pays Sep 30; Sep 16–30 pays Oct 15; Oct 1–15 pays Oct 30;
    // Oct 16–31 pays Nov 15 (Sunday) → slips to Nov 16.
    expect(items.map((i) => i.date)).toEqual([
      '2026-09-30',
      '2026-10-15',
      '2026-10-30',
      '2026-11-16',
      '2026-11-30',
      '2026-12-15',
    ]);
    expect(items[0].label).toBe('Sep 1–15');
    expect(items[3]).toMatchObject({ shifted: true, originalDate: '2026-11-15' });
  });
});

describe('schedulesToPaymentRule', () => {
  it('round-trips the three creatable shapes', () => {
    expect(schedulesToPaymentRule([{ kind: 'dayOfMonth', day_of_month: 20 }])).toEqual({
      paymentRule: 'dayOfMonth',
      payDay: 20,
    });
    expect(schedulesToPaymentRule([{ kind: 'monthEnd', day_of_month: null }])).toEqual({
      paymentRule: 'monthEnd',
      payDay: 15,
    });
    expect(
      schedulesToPaymentRule([
        { kind: 'dayOfMonth', day_of_month: 15 },
        { kind: 'dayOfMonth', day_of_month: 1 },
      ])
    ).toEqual({ paymentRule: 'semiMonthly', payDay: 15 });
  });
});
