import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import type { NewOneOffEvent } from '@/composables/useOneOffEvents';
import { useEntryDryRun } from './useEntryDryRun';

const {
  listAccounts,
  listIncomeStreams,
  listObligations,
  listOneOffEvents,
  listPlannedSpend,
  getSettings,
  getWorkCalendar,
  listFxRates,
  pocketActualsForRange,
  forwardSpendForRange,
  runRateSpendForRange,
} = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  listIncomeStreams: vi.fn(),
  listObligations: vi.fn(),
  listOneOffEvents: vi.fn(),
  listPlannedSpend: vi.fn(),
  getSettings: vi.fn(),
  getWorkCalendar: vi.fn(),
  listFxRates: vi.fn(),
  pocketActualsForRange: vi.fn(),
  forwardSpendForRange: vi.fn(),
  runRateSpendForRange: vi.fn(),
}));

vi.mock('@roman-mik/kapa-core/horizon/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/horizon/queries')>();
  return {
    ...actual,
    listAccounts,
    listIncomeStreams,
    listObligations,
    listOneOffEvents,
    listPlannedSpend,
    getSettings,
    getWorkCalendar,
  };
});

vi.mock('@roman-mik/kapa-core/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/core')>();
  return { ...actual, listFxRates };
});

vi.mock('@roman-mik/kapa-core/horizon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/horizon')>();
  return { ...actual, pocketActualsForRange, forwardSpendForRange, runRateSpendForRange };
});

describe('useEntryDryRun', () => {
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

    listAccounts.mockResolvedValue([
      {
        id: 'a1',
        currency: 'RSD',
        current_balance_minor: 100_000,
        include_in_total: true,
        archived: false,
      },
    ]);
    listIncomeStreams.mockResolvedValue([]);
    listObligations.mockResolvedValue([]);
    listOneOffEvents.mockResolvedValue([]);
    listPlannedSpend.mockResolvedValue([]);
    getSettings.mockResolvedValue({
      space_id: 'sp1',
      reporting_currency: 'RSD',
      event_order: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
      tax_fixed_monthly_minor: null,
      tax_marginal_rate_bps: null,
      spend_mode: 'cap',
    });
    getWorkCalendar.mockResolvedValue({ workingWeekdays: [0, 1, 2, 3, 4, 5, 6], holidays: [] });
    listFxRates.mockResolvedValue([]);
    pocketActualsForRange.mockResolvedValue({ value: [], unconverted: [] });
    forwardSpendForRange.mockResolvedValue({ value: [], unconverted: [] });
    runRateSpendForRange.mockResolvedValue({ value: [], unconverted: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('populates ingredients from the exported kapa-core queries', async () => {
    const { loadBaseline, ingredients } = useEntryDryRun();
    await loadBaseline();
    expect(ingredients.value).not.toBeNull();
    expect(ingredients.value?.accounts).toHaveLength(1);
    expect(ingredients.value?.reportingCurrency).toBe('RSD');
    expect(ingredients.value?.todayKey).toBe('2026-09-01');
  });

  it('preview() produces a DryRunEffect for a same-day draft', async () => {
    const { loadBaseline, preview, effect } = useEntryDryRun();
    await loadBaseline();
    const draft: { kind: 'oneOff'; value: NewOneOffEvent } = {
      kind: 'oneOff',
      value: {
        name: 'Coffee',
        category: 'other',
        currency: 'RSD',
        accountId: 'a1',
        date: '2026-09-01',
        amountMinor: 500,
        direction: 'out',
      },
    };
    preview(draft);
    expect(effect.value).not.toBeNull();
    expect(effect.value?.todayDeltaMinor).toBe(-500);
  });

  it('preview() returns null effect with no baseline loaded', () => {
    const { preview, effect } = useEntryDryRun();
    preview({
      kind: 'oneOff',
      value: {
        name: 'Coffee',
        category: 'other',
        currency: 'RSD',
        accountId: 'a1',
        date: '2026-09-01',
        amountMinor: 500,
        direction: 'out',
      },
    });
    expect(effect.value).toBeNull();
  });
});
