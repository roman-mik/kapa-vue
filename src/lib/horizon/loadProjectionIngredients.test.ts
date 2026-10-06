import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import { useSessionStore } from '@/stores/session';
import { queryCache } from '@/lib/serverState/queryCache';
import { invalidateResources } from '@/lib/serverState/invalidation';
import { loadProjectionIngredients } from './loadProjectionIngredients';
const { load, tracking } = vi.hoisted(() => ({ load: vi.fn(), tracking: vi.fn() }));
vi.mock('@roman-mik/kapa-core/horizon', async (original) => ({
  ...(await original<typeof import('@roman-mik/kapa-core/horizon')>()),
  loadProjectionInput: load,
}));
vi.mock('@roman-mik/kapa-core/horizon/queries', async (original) => ({
  ...(await original<typeof import('@roman-mik/kapa-core/horizon/queries')>()),
  getPaymentTrackingState: tracking,
}));
beforeEach(() => {
  setActivePinia(createPinia());
  useSessionStore().user = { id: 'u' } as never;
  queryCache.clear();
  load.mockReset().mockResolvedValue({ input: {}, settings: {}, unconverted: [] });
  tracking.mockReset().mockResolvedValue(null);
});
it('shares matching ingredients and refreshes them after history review', async () => {
  const client = {} as never;
  const [a, b] = await Promise.all([
    loadProjectionIngredients(client, 's', 'UTC', 90),
    loadProjectionIngredients(client, 's', 'UTC', 90),
  ]);
  expect(a).toBe(b);
  expect(load).toHaveBeenCalledTimes(1);
  await invalidateResources('u', 's', 'historyCoverage');
  expect(load).toHaveBeenCalledTimes(2);
  await loadProjectionIngredients(client, 's', 'UTC', 90, 'runRate');
  expect(load).toHaveBeenCalledTimes(3);
  expect(load).toHaveBeenLastCalledWith(
    client,
    's',
    expect.objectContaining({ spendMode: 'runRate' })
  );
});
it('does not reuse another space or hide a refresh error behind cached ingredients', async () => {
  const client = {} as never;
  await loadProjectionIngredients(client, 's', 'UTC', 90);
  await loadProjectionIngredients(client, 'other', 'UTC', 90);
  expect(load).toHaveBeenCalledTimes(2);
  load.mockRejectedValue(new Error('offline'));
  await invalidateResources('u', 's', 'historyCoverage');
  await expect(loadProjectionIngredients(client, 's', 'UTC', 90)).rejects.toThrow('offline');
});
