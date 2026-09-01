import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useExpenses } from './useExpenses';

const { listExpensesInRange, addExpense, updateExpense, deleteExpense } = vi.hoisted(() => ({
  listExpensesInRange: vi.fn(),
  addExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}));

vi.mock('@roman-mik/kapa-core/pocket/queries', () => ({
  listExpensesInRange,
  addExpense,
  updateExpense,
  deleteExpense,
}));

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const CONFLICT = { ok: false, reason: 'conflict' } as const;

describe('useExpenses', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
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

  it('duplicate() carries amount/currency/category/note through add() with no spent_at, and refreshes', async () => {
    const { duplicate } = useExpenses();
    await flush();
    addExpense.mockResolvedValue(undefined);

    await duplicate({
      id: 'e1',
      amount_minor: 500,
      currency: 'RSD',
      category_id: 'cat-1',
      note: 'coffee',
    } as never);

    expect(addExpense).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        amount_minor: 500,
        currency: 'RSD',
        category_id: 'cat-1',
        note: 'coffee',
      })
    );
    const payload = addExpense.mock.calls[0][1];
    expect(payload).not.toHaveProperty('spent_at');
    // once for init, once after duplicate()'s own add()
    expect(listExpensesInRange).toHaveBeenCalledTimes(2);
  });
});
