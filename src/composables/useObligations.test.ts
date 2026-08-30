import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useObligations } from './useObligations';

const {
  getWorkCalendar,
  listObligations,
  createObligation,
  createObligationSchedule,
  deleteObligation,
} = vi.hoisted(() => ({
  getWorkCalendar: vi.fn(),
  listObligations: vi.fn(),
  createObligation: vi.fn(),
  createObligationSchedule: vi.fn(),
  deleteObligation: vi.fn(),
}));

vi.mock('@roman-mik/kapa-core/horizon/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/horizon/queries')>();
  return {
    ...actual,
    getWorkCalendar,
    listObligations,
    createObligation,
    createObligationSchedule,
    deleteObligation,
  };
});

function flush(): Promise<void> {
  // Fake timers freeze real setTimeout, so drain the microtask queue instead.
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());
}

function obligationRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    account_id: 'a1',
    amount_minor: 45000,
    archived: false,
    category: 'housing',
    confidence: 'confirmed',
    created_at: '2026-08-01T00:00:00Z',
    currency: 'RSD',
    end_date: null,
    id: 'o1',
    name: 'Rent',
    recurrence: 'recurring',
    sort_order: 1,
    space_id: 'sp1',
    start_date: '2026-01-01',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function scheduleRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    anchor_date: null,
    covers_period: 'same',
    created_at: '2026-08-01T00:00:00Z',
    day_of_month: 1,
    id: 'sc1',
    interval_days: null,
    kind: 'dayOfMonth',
    nth_weekday: null,
    obligation_id: 'o1',
    slippage_policy: 'nextBusinessDay',
    space_id: 'sp1',
    weekday: null,
    ...overrides,
  };
}

describe('useObligations', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    // Sep 2026 seen from Belgrade.
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

  it('fetches the work calendar and obligations for the space and derives due dates', async () => {
    listObligations.mockResolvedValue([{ ...obligationRow(), schedules: [scheduleRow()] }]);
    const { obligationsWithMonth, month, convertibles } = useObligations();
    await flush();

    expect(getWorkCalendar).toHaveBeenCalledWith(expect.anything(), 'sp1');
    expect(listObligations).toHaveBeenCalledWith(expect.anything(), 'sp1');
    expect(month.value).toBe('2026-09');
    expect(obligationsWithMonth.value).toHaveLength(1);
    // One due date (Sep 1) × 45,000 = 45,000 due in September.
    expect(obligationsWithMonth.value[0].monthlyMinor).toBe(45000);
    // 1 Sep 2026 is a Tuesday — a working day, no slippage.
    expect(obligationsWithMonth.value[0].occurrences).toEqual([
      { date: '2026-09-01', shifted: false, periodLabel: 'Sep' },
    ]);
    expect(convertibles.value[0]).toEqual({
      id: 'o1',
      currency: 'RSD',
      amountMinor: 45000,
    });
  });

  it('drops archived obligations from Money-out', async () => {
    listObligations.mockResolvedValue([
      { ...obligationRow({ archived: true }), schedules: [scheduleRow()] },
    ]);
    const { obligationsWithMonth } = useObligations();
    await flush();
    expect(obligationsWithMonth.value).toHaveLength(0);
  });

  it('slips a weekend due date and labels the covered period from the un-slipped date (D3)', async () => {
    // 13 Sep 2026 is a Sunday → slips to Mon 14 Sep.
    listObligations.mockResolvedValue([
      {
        ...obligationRow(),
        schedules: [scheduleRow({ day_of_month: 13, covers_period: 'next' })],
      },
    ]);
    const { obligationsWithMonth } = useObligations();
    await flush();

    expect(obligationsWithMonth.value[0].occurrences).toEqual([
      {
        date: '2026-09-14',
        shifted: true,
        originalDate: '2026-09-13',
        // covers 'next' from the 13th (un-slipped) → October.
        periodLabel: 'Oct',
      },
    ]);
  });

  it('add() creates the obligation, then its schedule, and refreshes', async () => {
    listObligations.mockResolvedValue([]);
    createObligation.mockResolvedValue({ id: 'o9' });
    createObligationSchedule.mockResolvedValue(undefined);
    const { add, obligationsWithMonth } = useObligations();
    await flush();

    await add({
      name: 'Rent',
      category: 'housing',
      currency: 'RSD',
      accountId: 'a1',
      startDate: '2026-09-01',
      amountMinor: 45000,
      rule: { kind: 'dayOfMonth', dayOfMonth: 1 },
    });

    expect(createObligation).toHaveBeenCalledWith(expect.anything(), {
      space_id: 'sp1',
      account_id: 'a1',
      currency: 'RSD',
      name: 'Rent',
      category: 'housing',
      amount_minor: 45000,
      start_date: '2026-09-01',
    });
    expect(createObligationSchedule).toHaveBeenCalledWith(expect.anything(), {
      obligation_id: 'o9',
      space_id: 'sp1',
      kind: 'dayOfMonth',
      day_of_month: 1,
      slippage_policy: 'nextBusinessDay',
      covers_period: 'same',
    });
    expect(obligationsWithMonth.value).toEqual([]);
  });

  it('rolls back the obligation when a schedule insert fails', async () => {
    listObligations.mockResolvedValue([]);
    createObligation.mockResolvedValue({ id: 'o9' });
    createObligationSchedule.mockRejectedValue(new Error('no table'));
    const { add } = useObligations();
    await flush();

    await expect(
      add({
        name: 'Rent',
        category: 'housing',
        currency: 'RSD',
        accountId: 'a1',
        startDate: '2026-09-01',
        amountMinor: 45000,
        rule: { kind: 'monthEnd' },
      })
    ).rejects.toThrow('no table');
    expect(deleteObligation).toHaveBeenCalledWith(expect.anything(), 'o9');
  });
});
