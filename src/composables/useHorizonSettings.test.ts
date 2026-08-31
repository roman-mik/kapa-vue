import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useHorizonSettings } from './useHorizonSettings';

const {
  getSettings,
  getWorkCalendar,
  listHolidays,
  getCap,
  setEventOrder,
  setSpendMode,
  upsertWorkCalendar,
  addHoliday,
  deleteHoliday,
} = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getWorkCalendar: vi.fn(),
  listHolidays: vi.fn(),
  getCap: vi.fn(),
  setEventOrder: vi.fn(),
  setSpendMode: vi.fn(),
  upsertWorkCalendar: vi.fn(),
  addHoliday: vi.fn(),
  deleteHoliday: vi.fn(),
}));

vi.mock('@roman-mik/kapa-core/horizon/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/horizon/queries')>();
  return {
    ...actual,
    getSettings,
    getWorkCalendar,
    listHolidays,
    setEventOrder,
    setSpendMode,
    upsertWorkCalendar,
    addHoliday,
    deleteHoliday,
  };
});

vi.mock('@roman-mik/kapa-core/pocket/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/pocket/queries')>();
  return {
    ...actual,
    getCap,
  };
});

function flush(): Promise<void> {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());
}

const DEFAULT_SETTINGS = {
  space_id: 'sp1',
  reporting_currency: 'RSD',
  event_order: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
  tax_fixed_monthly_minor: null,
  tax_marginal_rate_bps: null,
  spend_mode: 'cap',
};

function fakeHoliday(overrides: Record<string, unknown> = {}) {
  return {
    id: 'h1',
    space_id: 'sp1',
    date: '2026-09-01',
    name: "New Year's Day",
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('useHorizonSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
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
    getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS });
    getWorkCalendar.mockResolvedValue({
      workingWeekdays: [1, 2, 3, 4, 5],
      holidays: [],
    });
    listHolidays.mockResolvedValue([fakeHoliday()]);
    getCap.mockResolvedValue({ space_id: 'sp1', monthly_cap_minor: 100000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads settings, work calendar, holidays and cap on space change', async () => {
    const { settings, workingWeekdays, holidays, capMinor, loading } = useHorizonSettings();
    await flush();

    expect(loading.value).toBe(false);
    expect(settings.value).toEqual(DEFAULT_SETTINGS);
    expect(workingWeekdays.value).toEqual([1, 2, 3, 4, 5]);
    expect(holidays.value).toHaveLength(1);
    expect(capMinor.value).toBe(100000);
  });

  it('saveEventOrder persists and updates the local settings', async () => {
    setEventOrder.mockResolvedValue(undefined);
    const { settings, saveEventOrder } = useHorizonSettings();
    await flush();

    await saveEventOrder('oneOffOut,income,obligation,plannedSpend,oneOffIn');

    expect(setEventOrder).toHaveBeenCalledWith(
      expect.anything(),
      'sp1',
      'oneOffOut,income,obligation,plannedSpend,oneOffIn'
    );
    expect(settings.value?.event_order).toBe('oneOffOut,income,obligation,plannedSpend,oneOffIn');
  });

  it('saveSpendMode persists and updates the local settings', async () => {
    setSpendMode.mockResolvedValue(undefined);
    const { settings, saveSpendMode } = useHorizonSettings();
    await flush();

    await saveSpendMode('runRate');

    expect(setSpendMode).toHaveBeenCalledWith(expect.anything(), 'sp1', 'runRate');
    expect(settings.value?.spend_mode).toBe('runRate');
  });

  it('saveWorkCalendar upserts and updates the local weekdays', async () => {
    upsertWorkCalendar.mockResolvedValue(undefined);
    const { workingWeekdays, saveWorkCalendar } = useHorizonSettings();
    await flush();

    await saveWorkCalendar([1, 2, 3, 4, 5, 6]);

    expect(upsertWorkCalendar).toHaveBeenCalledWith(expect.anything(), 'sp1', [1, 2, 3, 4, 5, 6]);
    expect(workingWeekdays.value).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('addHolidayForSpace refreshes on success and passes through a duplicate result', async () => {
    addHoliday.mockResolvedValue({ ok: true });
    const { holidays, addHolidayForSpace } = useHorizonSettings();
    await flush();

    const result = await addHolidayForSpace('2026-09-01', 'Test');

    expect(addHoliday).toHaveBeenCalledWith(expect.anything(), 'sp1', {
      date: '2026-09-01',
      name: 'Test',
    });
    expect(result).toEqual({ ok: true });
    // Refreshed after insert, so listHolidays is called again.
    expect(listHolidays).toHaveBeenCalledTimes(2);
    expect(holidays.value).toHaveLength(1);
  });

  it('addHolidayForSpace surfaces a duplicate without refreshing', async () => {
    addHoliday.mockResolvedValue({ ok: false, reason: 'duplicate' });
    const { addHolidayForSpace } = useHorizonSettings();
    await flush();

    const result = await addHolidayForSpace('2026-09-01', 'Test');

    expect(result).toEqual({ ok: false, reason: 'duplicate' });
    expect(listHolidays).toHaveBeenCalledTimes(1);
  });

  it('removeHoliday deletes and drops the row locally', async () => {
    deleteHoliday.mockResolvedValue(undefined);
    const { holidays, removeHoliday } = useHorizonSettings();
    await flush();

    await removeHoliday('h1');

    expect(deleteHoliday).toHaveBeenCalledWith(expect.anything(), 'h1');
    expect(holidays.value).toEqual([]);
  });

  it('clears state when no space is selected', async () => {
    useSpaceStore().currentSpaceId = null;
    const { settings, workingWeekdays, holidays, capMinor } = useHorizonSettings();
    await flush();

    expect(settings.value).toBeNull();
    expect(workingWeekdays.value).toEqual([]);
    expect(holidays.value).toEqual([]);
    expect(capMinor.value).toBeNull();
  });

  it('records an error and keeps previous state when loading fails', async () => {
    getWorkCalendar.mockRejectedValue(new Error('permission denied'));
    const { error } = useHorizonSettings();
    await flush();

    expect(error.value).toBe('permission denied');
  });
});
