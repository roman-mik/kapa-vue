import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useAccounts } from './useAccounts';

const { listAccounts, createAccount, updateAccount, archiveAccount } = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  archiveAccount: vi.fn(),
}));

vi.mock('@roman-mik/kapa-core/horizon', () => ({
  listAccounts,
  createAccount,
  updateAccount,
  archiveAccount,
}));

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useAccounts', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const space = useSpaceStore();
    space.spaces = [
      {
        id: 's1',
        name: 'Home',
        currency: 'EUR',
        timezone: 'Europe/Belgrade',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    space.currentSpaceId = 's1';
    listAccounts.mockResolvedValue([
      {
        id: 'a1',
        space_id: 's1',
        name: 'Checking',
        currency: 'EUR',
        current_balance_minor: 1000,
        type: 'bank',
        include_in_total: true,
        archived: false,
        sort_order: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'a2',
        space_id: 's1',
        name: 'Stash',
        currency: 'USD',
        current_balance_minor: 200,
        type: 'bank',
        include_in_total: true,
        archived: false,
        sort_order: 2,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
  });

  it('fetches accounts for the current space on init', async () => {
    const { accounts } = useAccounts();
    await flush();
    expect(listAccounts).toHaveBeenCalledWith(expect.anything(), 's1');
    expect(accounts.value).toHaveLength(2);
  });

  it('sums the hero total only from include_in_total accounts in the space currency', async () => {
    const { totalMinor, totalCurrency } = useAccounts();
    await flush();
    // a1 (EUR, include) counts; a2 (USD) is excluded — single-currency math.
    expect(totalMinor.value).toBe(1000);
    expect(totalCurrency.value).toBe('EUR');
  });

  it('drops archived accounts from the list and the total', async () => {
    listAccounts.mockResolvedValueOnce([
      {
        id: 'a1',
        space_id: 's1',
        name: 'Closed',
        currency: 'EUR',
        current_balance_minor: 5000,
        type: 'bank',
        include_in_total: true,
        archived: true,
        sort_order: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    const { accounts, totalMinor } = useAccounts();
    await flush();
    expect(accounts.value).toHaveLength(0);
    expect(totalMinor.value).toBe(0);
  });

  it('add() creates the account through and refreshes', async () => {
    const { add, accounts } = useAccounts();
    await flush();
    createAccount.mockResolvedValue(undefined);
    listAccounts.mockResolvedValueOnce([]);

    await add({
      name: 'Savings',
      currency: 'EUR',
      balanceMinor: 500,
      type: 'bank',
      includeInTotal: true,
    });

    expect(createAccount).toHaveBeenCalledWith(expect.anything(), {
      space_id: 's1',
      name: 'Savings',
      currency: 'EUR',
      current_balance_minor: 500,
      type: 'bank',
      include_in_total: true,
    });
    expect(accounts.value).toHaveLength(0);
  });

  it('update() calls through with the expected updated_at and returns the outcome', async () => {
    const { update } = useAccounts();
    await flush();
    updateAccount.mockResolvedValue({ ok: true });

    const outcome = await update('a1', { name: 'Renamed' }, '2026-01-01T00:00:00Z');

    expect(updateAccount).toHaveBeenCalledWith(
      expect.anything(),
      'a1',
      { name: 'Renamed' },
      '2026-01-01T00:00:00Z'
    );
    expect(outcome).toEqual({ ok: true });
  });

  it('archive() calls through and returns the conflict outcome', async () => {
    const { archive } = useAccounts();
    await flush();
    archiveAccount.mockResolvedValue({ ok: false, reason: 'conflict' });

    const outcome = await archive('a1', 'stale');

    expect(archiveAccount).toHaveBeenCalledWith(expect.anything(), 'a1', 'stale');
    expect(outcome).toEqual({ ok: false, reason: 'conflict' });
  });
});
