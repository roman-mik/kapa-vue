import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useSessionStore } from '@/stores/session';
import { queryCache } from '@/lib/serverState/queryCache';
import { useExpenses } from './useExpenses';
import { usePocketHome } from './usePocketHome';

const { listExpensesInRange, addExpense, updateExpense, deleteExpense, getExpense } = vi.hoisted(
  () => ({
    listExpensesInRange: vi.fn(),
    addExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
    getExpense: vi.fn(),
  })
);

vi.mock('@roman-mik/kapa-core/pocket/queries', () => ({
  listExpensesInRange,
  addExpense,
  updateExpense,
  deleteExpense,
  getExpense,
  getCap: vi
    .fn()
    .mockResolvedValue({ monthly_cap_minor: 10000, nudge_enabled: false, nudge_pct: 80 }),
}));

vi.mock('@roman-mik/kapa-core/core', () => ({ listFxRates: vi.fn().mockResolvedValue([]) }));

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const CONFLICT = { ok: false, reason: 'conflict' } as const;

describe('useExpenses', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    queryCache.clear();
    vi.clearAllMocks();
    useSessionStore().user = { id: 'u1' } as never;
    listExpensesInRange.mockResolvedValue([{ id: 'e1', updated_at: '2026-08-28T10:00:00Z' }]);
    const space = useSpaceStore();
    space.spaces = [
      {
        created_at: '2026-08-01T00:00:00Z',
        currency: 'RSD',
        id: 's1',
        name: 'Home',
        timezone: 'Europe/Belgrade',
      },
    ];
    space.currentSpaceId = 's1';
  });

  it('fetches the current month for the current space on init', async () => {
    const { expenses } = useExpenses();
    await flush();
    expect(listExpensesInRange).toHaveBeenCalledWith(
      expect.anything(),
      's1',
      expect.any(Date),
      expect.any(Date)
    );
    expect(expenses.value).toEqual([{ id: 'e1', updated_at: '2026-08-28T10:00:00Z' }]);
  });

  it('updates already-open History and Home after successive adds through a separate sheet consumer', async () => {
    listExpensesInRange.mockResolvedValue([]);
    const history = useExpenses();
    const home = usePocketHome();
    const sheet = useExpenses();
    await flush();
    expect(listExpensesInRange).toHaveBeenCalledTimes(1);
    const rows = [
      { id: 'new', amount_minor: 1200, currency: 'RSD', spent_at: new Date().toISOString() },
    ];
    listExpensesInRange.mockResolvedValue(rows);
    addExpense.mockResolvedValue(undefined);
    await sheet.add({ amountMinor: 1200, currency: 'RSD', categoryId: null, note: null });
    expect(history.expenses.value).toEqual(rows);
    expect(home.summary.value?.spent).toBe(1200);
    expect(listExpensesInRange).toHaveBeenCalledTimes(2);
    listExpensesInRange.mockResolvedValue([...rows, { ...rows[0], id: 'duplicate' }]);
    await sheet.add({ amountMinor: 1200, currency: 'RSD', categoryId: null, note: null });
    expect(history.expenses.value).toHaveLength(2);
    expect(home.summary.value?.spent).toBe(2400);
  });

  it('does not refresh or append a row when adding fails', async () => {
    const history = useExpenses();
    const sheet = useExpenses();
    await flush();
    const before = history.expenses.value;
    addExpense.mockRejectedValueOnce(new Error('Write failed'));
    await expect(
      sheet.add({ amountMinor: 1, currency: 'RSD', categoryId: null, note: null })
    ).rejects.toThrow('Write failed');
    expect(history.expenses.value).toBe(before);
    expect(listExpensesInRange).toHaveBeenCalledTimes(1);
  });

  it('invalidates the originating space when selection changes during an add', async () => {
    const space = useSpaceStore();
    space.spaces.push({ ...space.spaces[0]!, id: 's2', name: 'Other' });
    const history = useExpenses();
    const sheet = useExpenses();
    await flush();
    let complete!: () => void;
    addExpense.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        })
    );
    const save = sheet.add({ amountMinor: 42, currency: 'RSD', categoryId: null, note: null });
    listExpensesInRange.mockImplementation(async (_client, spaceId) => [
      { id: spaceId === 's1' ? 'added-to-first' : 'second-row' },
    ]);
    space.currentSpaceId = 's2';
    await flush();
    complete();
    await save;
    expect(addExpense).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ space_id: 's1' })
    );
    expect(history.expenses.value).toEqual([{ id: 'second-row' }]);
    expect(listExpensesInRange).toHaveBeenLastCalledWith(
      expect.anything(),
      's1',
      expect.any(Date),
      expect.any(Date)
    );
    space.currentSpaceId = 's1';
    await flush();
    expect(history.expenses.value).toEqual([{ id: 'added-to-first' }]);
  });

  it('update() scopes the write to the read updated_at, refreshes, and returns the ok outcome', async () => {
    const { update } = useExpenses();
    await flush();
    updateExpense.mockResolvedValue({ ok: true });

    const outcome = await update('e1', { note: 'edited' }, '2026-08-28T10:00:00Z');

    expect(updateExpense).toHaveBeenCalledWith(
      expect.anything(),
      'e1',
      { note: 'edited' },
      '2026-08-28T10:00:00Z'
    );
    expect(outcome).toEqual({ ok: true });
    // once for init, once after the mutation
    expect(listExpensesInRange).toHaveBeenCalledTimes(2);
  });

  it('update() returns the conflict outcome instead of throwing and still refreshes', async () => {
    const { update } = useExpenses();
    await flush();
    updateExpense.mockResolvedValue(CONFLICT);

    const outcome = await update('e1', { note: 'edited' }, '2026-08-28T10:00:00Z');

    expect(outcome).toEqual(CONFLICT);
    expect(listExpensesInRange).toHaveBeenCalledTimes(2);
  });

  it('remove() scopes the delete to the read updated_at and refreshes', async () => {
    const { remove } = useExpenses();
    await flush();
    deleteExpense.mockResolvedValue({ ok: true });

    const outcome = await remove('e1', '2026-08-28T10:00:00Z');

    expect(deleteExpense).toHaveBeenCalledWith(expect.anything(), 'e1', '2026-08-28T10:00:00Z');
    expect(outcome).toEqual({ ok: true });
    expect(listExpensesInRange).toHaveBeenCalledTimes(2);
  });

  it('remove() returns the conflict outcome instead of throwing and still refreshes', async () => {
    const { remove } = useExpenses();
    await flush();
    deleteExpense.mockResolvedValue(CONFLICT);

    const outcome = await remove('e1', '2026-08-28T10:00:00Z');

    expect(outcome).toEqual(CONFLICT);
    expect(listExpensesInRange).toHaveBeenCalledTimes(2);
  });

  it('getById() returns the already-loaded row without an extra fetch', async () => {
    const { getById } = useExpenses();
    await flush();

    const result = await getById('e1');

    expect(result).toEqual({ id: 'e1', updated_at: '2026-08-28T10:00:00Z' });
    expect(getExpense).not.toHaveBeenCalled();
  });

  it('getById() falls back to a direct fetch when the row is outside the loaded month window', async () => {
    const { getById } = useExpenses();
    await flush();
    getExpense.mockResolvedValue({ id: 'e2', updated_at: '2026-07-15T10:00:00Z' });

    const result = await getById('e2');

    expect(getExpense).toHaveBeenCalledWith(expect.anything(), 'e2');
    expect(result).toEqual({ id: 'e2', updated_at: '2026-07-15T10:00:00Z' });
  });
});
