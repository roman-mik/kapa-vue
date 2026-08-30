import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useHorizonToday } from './useHorizonToday';

const { projectionForRange, getSettings, getCap, listProjectionDismissals, dismissNegativeDay } =
  vi.hoisted(() => ({
    projectionForRange: vi.fn(),
    getSettings: vi.fn(),
    getCap: vi.fn(),
    listProjectionDismissals: vi.fn(),
    dismissNegativeDay: vi.fn(),
  }));

vi.mock('@roman-mik/kapa-core/horizon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/horizon')>();
  return {
    ...actual,
    projectionForRange,
  };
});

vi.mock('@roman-mik/kapa-core/horizon/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/horizon/queries')>();
  return {
    ...actual,
    getSettings,
    listProjectionDismissals,
    dismissNegativeDay,
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

function fakeEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date: '2026-09-02',
    originalDate: '2026-09-02',
    shifted: false,
    kind: 'obligation',
    label: 'Rent',
    sourceId: 'ob1',
    amountMinor: -50000,
    nativeCurrency: 'RSD',
    nativeAmountMinor: -50000,
    unconvertible: false,
    accountId: 'a1',
    coveredPeriod: null,
    recurring: true,
    balanceBeforeMinor: 0,
    balanceAfterMinor: -1000,
    ...overrides,
  };
}

describe('useHorizonToday', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));
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
    getSettings.mockResolvedValue({
      space_id: 'sp1',
      reporting_currency: 'RSD',
      event_order: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
      tax_fixed_monthly_minor: null,
      tax_marginal_rate_bps: null,
      spend_mode: 'cap',
    });
    getCap.mockResolvedValue({
      space_id: 'sp1',
      monthly_cap_minor: 100000,
      nudge_enabled: true,
      nudge_pct: 80,
    });
    listProjectionDismissals.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives end balance, paired month minimum, next events, cap, and warnings from one projection fetch', async () => {
    projectionForRange.mockResolvedValue({
      value: {
        days: [
          { date: '2026-09-01', balanceMinor: 5000, events: [] },
          { date: '2026-09-02', balanceMinor: -1000, events: [fakeEvent()] },
        ],
        events: [fakeEvent()],
      },
      unconverted: [],
    });

    const {
      loading,
      reportingCurrency,
      spendMode,
      capMinor,
      endBalanceMinor,
      monthMin,
      nextEvents,
      warnings,
    } = useHorizonToday();
    await flush();

    expect(loading.value).toBe(false);
    expect(projectionForRange).toHaveBeenCalledWith(
      expect.anything(),
      'sp1',
      expect.objectContaining({ timeZone: 'Europe/Belgrade' })
    );
    expect(reportingCurrency.value).toBe('RSD');
    expect(spendMode.value).toBe('cap');
    expect(capMinor.value).toBe(100000);
    expect(endBalanceMinor.value).toBe(-1000);
    expect(monthMin.value).toEqual({ minBalanceMinor: -1000, minBalanceDate: '2026-09-02' });
    expect(nextEvents.value).toHaveLength(1);
    expect(nextEvents.value[0]).toMatchObject({ label: 'Rent', date: '2026-09-02' });
    expect(warnings.value).toHaveLength(1);
  });

  it('omits the cap when the space has none', async () => {
    getCap.mockResolvedValue(null);
    projectionForRange.mockResolvedValue({
      value: { days: [{ date: '2026-09-01', balanceMinor: 0, events: [] }], events: [] },
      unconverted: [],
    });

    const { capMinor } = useHorizonToday();
    await flush();

    expect(capMinor.value).toBeNull();
  });

  it('dismiss() persists with the current shortfall and drops the warning locally without refetching', async () => {
    projectionForRange.mockResolvedValue({
      value: { days: [{ date: '2026-09-02', balanceMinor: -500, events: [] }], events: [] },
      unconverted: [],
    });
    dismissNegativeDay.mockResolvedValue(undefined);

    const { warnings, dismiss } = useHorizonToday();
    await flush();
    expect(warnings.value).toHaveLength(1);

    await dismiss('2026-09-02', 'will top up before then');

    expect(dismissNegativeDay).toHaveBeenCalledWith(expect.anything(), 'sp1', {
      negative_date: '2026-09-02',
      shortfall_minor: 500,
      currency: 'RSD',
      reason: 'will top up before then',
    });
    expect(projectionForRange).toHaveBeenCalledTimes(1);
    expect(warnings.value).toEqual([]);
  });
});
