import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useIncomeStreams } from './useIncomeStreams';

const {
  getWorkCalendar,
  listIncomeStreams,
  createIncomeStream,
  createIncomeSchedule,
  deleteIncomeStream,
} = vi.hoisted(() => ({
  getWorkCalendar: vi.fn(),
  listIncomeStreams: vi.fn(),
  createIncomeStream: vi.fn(),
  createIncomeSchedule: vi.fn(),
  deleteIncomeStream: vi.fn(),
}));

vi.mock('@roman-mik/kapa-core/horizon/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/horizon/queries')>();
  return {
    ...actual,
    getWorkCalendar,
    listIncomeStreams,
    createIncomeStream,
    createIncomeSchedule,
    deleteIncomeStream,
  };
});

function flush(): Promise<void> {
  // Fake timers freeze real setTimeout, so drain the microtask queue instead.
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());
}

function streamRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    account_id: 'a1',
    archived: false,
    confidence: 'planned',
    created_at: '2026-08-01T00:00:00Z',
    currency: 'RSD',
    custom_period_days: null,
    custom_period_start_day: null,
    end_date: null,
    fixed_amount_minor: null,
    hourly_rate_minor: null,
    hours_per_day_e2: null,
    id: 's1',
    kind: 'hourly',
    name: 'Payroll',
    recurrence: 'monthly',
    sort_order: 1,
    space_id: 'sp1',
    start_date: '2026-01-01',
    taxable: false,
    updated_at: '2026-08-01T00:00:00Z',
    earning_period_kind: 'semiMonthly',
    ...overrides,
  };
}

function scheduleRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    anchor_date: null,
    covers_period: 'same',
    created_at: '2026-08-01T00:00:00Z',
    day_of_month: 15,
    id: 'sc1',
    income_stream_id: 's1',
    interval_days: null,
    kind: 'dayOfMonth',
    lag_days: 15,
    nth_weekday: null,
    slippage_policy: 'nextBusinessDay',
    space_id: 'sp1',
    weekday: null,
    ...overrides,
  };
}

describe('useIncomeStreams', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    // Sep 2026 seen from Belgrade: 22 working days (Mon–Fri, no holidays).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T00:00:00Z'));
    const space = useSpaceStore();
    space.spaces = [
      {
        id: 'sp1',
        name: 'Home',
        currency: 'RSD',
        timezone: 'Europe/Belgrade',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    space.currentSpaceId = 'sp1';
    getWorkCalendar.mockResolvedValue({ workingWeekdays: [1, 2, 3, 4, 5], holidays: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches the work calendar and streams for the space and derives month totals', async () => {
    listIncomeStreams.mockResolvedValue([
      {
        ...streamRow({ hourly_rate_minor: 5000, hours_per_day_e2: 800 }),
        schedules: [scheduleRow()],
      },
    ]);
    const { streamsWithMonth, month, convertibles } = useIncomeStreams();
    await flush();

    expect(getWorkCalendar).toHaveBeenCalledWith(expect.anything(), 'sp1');
    expect(listIncomeStreams).toHaveBeenCalledWith(expect.anything(), 'sp1');
    expect(month.value).toBe('2026-09');
    // 22 working days in Sep 2026 × 8h × 5000 RSD/h = 880,000 RSD (D9).
    expect(streamsWithMonth.value).toHaveLength(1);
    expect(streamsWithMonth.value[0].monthlyMinor).toBe(880000);
    // Semi-monthly earning periods → two payments, one per half.
    expect(streamsWithMonth.value[0].occurrences).toHaveLength(2);
    expect(convertibles.value[0]).toEqual({
      id: 's1',
      currency: 'RSD',
      amountMinor: 880000,
    });
  });

  it('drops archived streams from Money-in', async () => {
    listIncomeStreams.mockResolvedValue([
      { ...streamRow({ archived: true }), schedules: [scheduleRow()] },
    ]);
    const { streamsWithMonth } = useIncomeStreams();
    await flush();
    expect(streamsWithMonth.value).toHaveLength(0);
  });

  it('derives fixed receipts from the month\u2019s schedule occurrences', async () => {
    listIncomeStreams.mockResolvedValue([
      {
        ...streamRow({
          kind: 'fixed',
          fixed_amount_minor: 120000,
          hourly_rate_minor: null,
          hours_per_day_e2: null,
        }),
        schedules: [scheduleRow()],
      },
    ]);
    const { streamsWithMonth } = useIncomeStreams();
    await flush();
    expect(streamsWithMonth.value[0].monthlyMinor).toBe(120000);
    expect(streamsWithMonth.value[0].occurrences).toEqual([
      expect.objectContaining({ date: '2026-09-15', amountMinor: 120000 }),
    ]);
  });

  it('add() creates the stream, then its schedules, and refreshes', async () => {
    listIncomeStreams.mockResolvedValue([]);
    createIncomeStream.mockResolvedValue({ id: 's9' });
    createIncomeSchedule.mockResolvedValue(undefined);
    const { add, streamsWithMonth } = useIncomeStreams();
    await flush();

    await add({
      name: 'Rentals',
      kind: 'fixed',
      currency: 'RSD',
      accountId: 'a1',
      startDate: '2026-09-01',
      earningPeriodKind: 'monthly',
      hourlyRateMinor: null,
      hoursPerDayE2: null,
      lagDays: 0,
      amountMinor: 120000,
      paymentRule: 'semiMonthly',
      payDay: 15,
      taxable: false,
    });

    expect(createIncomeStream).toHaveBeenCalledWith(expect.anything(), {
      space_id: 'sp1',
      account_id: 'a1',
      currency: 'RSD',
      name: 'Rentals',
      kind: 'fixed',
      start_date: '2026-09-01',
      fixed_amount_minor: 120000,
      hourly_rate_minor: null,
      hours_per_day_e2: null,
      earning_period_kind: 'monthly',
      taxable: false,
    });
    expect(createIncomeSchedule).toHaveBeenCalledTimes(2);
    expect(createIncomeSchedule).toHaveBeenCalledWith(expect.anything(), {
      income_stream_id: 's9',
      space_id: 'sp1',
      kind: 'dayOfMonth',
      day_of_month: 1,
      slippage_policy: 'nextBusinessDay',
      covers_period: 'same',
      lag_days: null,
    });
    expect(createIncomeSchedule).toHaveBeenCalledWith(expect.anything(), {
      income_stream_id: 's9',
      space_id: 'sp1',
      kind: 'dayOfMonth',
      day_of_month: 15,
      slippage_policy: 'nextBusinessDay',
      covers_period: 'same',
      lag_days: null,
    });
    expect(streamsWithMonth.value).toEqual([]);
  });

  it('rolls back the stream when a schedule insert fails', async () => {
    listIncomeStreams.mockResolvedValue([]);
    createIncomeStream.mockResolvedValue({ id: 's9' });
    createIncomeSchedule.mockRejectedValue(new Error('no table'));
    const { add } = useIncomeStreams();
    await flush();

    await expect(
      add({
        name: 'Rentals',
        kind: 'fixed',
        currency: 'RSD',
        accountId: 'a1',
        startDate: '2026-09-01',
        earningPeriodKind: 'monthly',
        hourlyRateMinor: null,
        hoursPerDayE2: null,
        lagDays: 0,
        amountMinor: 120000,
        paymentRule: 'dayOfMonth',
        payDay: 15,
        taxable: true,
      })
    ).rejects.toThrow('no table');
    expect(deleteIncomeStream).toHaveBeenCalledWith(expect.anything(), 's9');
  });
});
