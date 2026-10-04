import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import { useCategoryCapRules } from './useCategoryCapRules';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { queryCache } from '@/lib/serverState/queryCache';
const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock('@roman-mik/kapa-core/pocket/queries', async (original) => ({
  ...(await original<typeof import('@roman-mik/kapa-core/pocket/queries')>()),
  listCategoryCapRules: mocks.list,
  setCategoryCapRule: mocks.save,
}));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
beforeEach(() => {
  setActivePinia(createPinia());
  queryCache.clear();
  vi.clearAllMocks();
  useSessionStore().user = { id: 'u' } as never;
  useSpaceStore().currentSpaceId = 's1';
  mocks.list.mockResolvedValue([{ space_id: 's1', category_id: 'rent', counts_toward_cap: false }]);
  mocks.save.mockResolvedValue(undefined);
});
it('shares defaults and refreshes projection without changing existing expense records', async () => {
  const first = useCategoryCapRules();
  const second = useCategoryCapRules();
  const projectionLoad = vi.fn().mockResolvedValue('forecast');
  const expenseLoad = vi.fn().mockResolvedValue('history');
  await queryCache
    .use({ key: ['u', 's1', 'projection'], staleTimeMs: 30000, load: projectionLoad })
    .refresh();
  await queryCache
    .use({ key: ['u', 's1', 'pocketExpenses'], staleTimeMs: 30000, load: expenseLoad })
    .refresh();
  await flush();
  expect(first.countsTowardCap('rent')).toBe(false);
  mocks.list.mockResolvedValue([{ space_id: 's1', category_id: 'rent', counts_toward_cap: true }]);
  await first.setDefault('rent', true);
  expect(second.countsTowardCap('rent')).toBe(true);
  expect(projectionLoad).toHaveBeenCalledTimes(2);
  expect(expenseLoad).toHaveBeenCalledTimes(1);
});
it('isolates defaults on space switch and preserves a failed save', async () => {
  const rules = useCategoryCapRules();
  await flush();
  mocks.save.mockRejectedValueOnce(new Error('Write failed'));
  await expect(rules.setDefault('rent', true)).rejects.toThrow('Write failed');
  expect(rules.countsTowardCap('rent')).toBe(false);
  mocks.list.mockResolvedValue([]);
  useSpaceStore().currentSpaceId = 's2';
  await flush();
  expect(rules.countsTowardCap('rent')).toBe(true);
  expect(mocks.list).toHaveBeenLastCalledWith(expect.anything(), 's2');
});
