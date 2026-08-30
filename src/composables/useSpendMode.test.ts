import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useSpendMode } from './useSpendMode';

const { getSettings, setSpendMode } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  setSpendMode: vi.fn(),
}));

vi.mock('@roman-mik/kapa-core/horizon/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/horizon/queries')>();
  return {
    ...actual,
    getSettings,
    setSpendMode,
  };
});

function flush(): Promise<void> {
  // Fake timers freeze real setTimeout, so drain the microtask queue instead.
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());
}

describe('useSpendMode', () => {
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the current mode for the active space', async () => {
    getSettings.mockResolvedValue({
      space_id: 'sp1',
      reporting_currency: 'RSD',
      event_order: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
      tax_fixed_monthly_minor: null,
      tax_marginal_rate_bps: null,
      spend_mode: 'runRate',
    });

    const { spendMode, loading } = useSpendMode();
    await flush();

    expect(getSettings).toHaveBeenCalledWith(expect.anything(), 'sp1');
    expect(spendMode.value).toBe('runRate');
    expect(loading.value).toBe(false);
  });

  it('reports the default cap for a space with no settings row', async () => {
    getSettings.mockResolvedValue({
      space_id: 'sp1',
      reporting_currency: 'RSD',
      event_order: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
      tax_fixed_monthly_minor: null,
      tax_marginal_rate_bps: null,
      spend_mode: 'cap',
    });

    const { spendMode } = useSpendMode();
    await flush();

    expect(spendMode.value).toBe('cap');
  });

  it('flips the mode via upsert and reflects it locally', async () => {
    getSettings.mockResolvedValue({
      space_id: 'sp1',
      reporting_currency: 'RSD',
      event_order: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
      tax_fixed_monthly_minor: null,
      tax_marginal_rate_bps: null,
      spend_mode: 'cap',
    });
    setSpendMode.mockResolvedValue(undefined);

    const { spendMode, setMode } = useSpendMode();
    await flush();
    await setMode('runRate');

    expect(setSpendMode).toHaveBeenCalledWith(expect.anything(), 'sp1', 'runRate');
    expect(spendMode.value).toBe('runRate');
  });

  it('surfaces a write failure and re-reads the stored mode', async () => {
    getSettings
      .mockResolvedValueOnce({
        space_id: 'sp1',
        reporting_currency: 'RSD',
        event_order: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
        tax_fixed_monthly_minor: null,
        tax_marginal_rate_bps: null,
        spend_mode: 'cap',
      })
      .mockResolvedValue({
        space_id: 'sp1',
        reporting_currency: 'RSD',
        event_order: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
        tax_fixed_monthly_minor: null,
        tax_marginal_rate_bps: null,
        spend_mode: 'cap',
      });
    setSpendMode.mockRejectedValue(new Error('check_violation'));

    const { spendMode, error, setMode } = useSpendMode();
    await flush();
    await setMode('runRate');

    expect(error.value).toBe('check_violation');
    // The optimistic state was rolled back by the re-read.
    expect(spendMode.value).toBe('cap');
  });

  it('resets to cap when no space is active', async () => {
    getSettings.mockResolvedValue({
      space_id: 'sp1',
      reporting_currency: 'RSD',
      event_order: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
      tax_fixed_monthly_minor: null,
      tax_marginal_rate_bps: null,
      spend_mode: 'runRate',
    });

    const { spendMode } = useSpendMode();
    await flush();
    const space = useSpaceStore();
    space.currentSpaceId = null;
    await flush();

    expect(spendMode.value).toBe('cap');
  });
});
