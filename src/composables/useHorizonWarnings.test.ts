import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useHorizonWarnings } from './useHorizonWarnings';

const { projectionForRange, listProjectionDismissals, dismissNegativeDay } = vi.hoisted(() => ({
  projectionForRange: vi.fn(),
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
    listProjectionDismissals,
    dismissNegativeDay,
  };
});

function flush(): Promise<void> {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());
}

function fakeEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date: '2026-09-01',
    originalDate: '2026-09-01',
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

describe('useHorizonWarnings', () => {
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
    listProjectionDismissals.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives warnings from the fetched projection and dismissals', async () => {
    projectionForRange.mockResolvedValue({
      value: {
        days: [
          { date: '2026-09-01', balanceMinor: 1000, events: [] },
          { date: '2026-09-02', balanceMinor: -1000, events: [fakeEvent()] },
        ],
        events: [],
      },
      unconverted: [],
    });

    const { warnings, loading } = useHorizonWarnings();
    await flush();

    expect(loading.value).toBe(false);
    expect(projectionForRange).toHaveBeenCalledWith(
      expect.anything(),
      'sp1',
      expect.objectContaining({ timeZone: 'Europe/Belgrade' })
    );
    expect(warnings.value).toHaveLength(1);
    expect(warnings.value[0]).toMatchObject({
      date: '2026-09-02',
      shortfallMinor: 1000,
      currency: 'RSD',
    });
    expect(warnings.value[0].fix).toEqual({ kind: 'shiftPayment', event: fakeEvent() });
  });

  it('excludes a date already dismissed with a matching shortfall', async () => {
    projectionForRange.mockResolvedValue({
      value: { days: [{ date: '2026-09-02', balanceMinor: -1000, events: [] }], events: [] },
      unconverted: [],
    });
    listProjectionDismissals.mockResolvedValue([
      {
        negative_date: '2026-09-02',
        shortfall_minor: 1000,
        currency: 'RSD',
        reason: 'ok',
        id: 'd1',
        space_id: 'sp1',
        created_at: '2026-09-01T00:00:00Z',
      },
    ]);

    const { warnings } = useHorizonWarnings();
    await flush();

    expect(warnings.value).toEqual([]);
  });

  it('dismiss() persists with the current shortfall and drops the warning locally without refetching', async () => {
    projectionForRange.mockResolvedValue({
      value: { days: [{ date: '2026-09-02', balanceMinor: -500, events: [] }], events: [] },
      unconverted: [],
    });
    dismissNegativeDay.mockResolvedValue(undefined);

    const { warnings, dismiss } = useHorizonWarnings();
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
