import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import { usePaymentTracking, type LinkDecision } from './usePaymentTracking';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { queryCache } from '@/lib/serverState/queryCache';
const { completeLinkExpense } = vi.hoisted(() => ({ completeLinkExpense: vi.fn() }));
vi.mock('@roman-mik/kapa-core/horizon/queries', async (original) => ({
  ...(await original<typeof import('@roman-mik/kapa-core/horizon/queries')>()),
  getPaymentTrackingState: vi.fn().mockResolvedValue(null),
  listAccounts: vi.fn().mockResolvedValue([]),
  listAccountObservations: vi.fn().mockResolvedValue([]),
  listExpenseCoverage: vi.fn().mockResolvedValue([]),
  listExpenseCutovers: vi.fn().mockResolvedValue([]),
  completeLinkExpense,
}));
vi.mock('@roman-mik/kapa-core/pocket/queries', async (original) => ({
  ...(await original<typeof import('@roman-mik/kapa-core/pocket/queries')>()),
  listExpensesInRange: vi.fn().mockResolvedValue([]),
}));
beforeEach(() => {
  setActivePinia(createPinia());
  queryCache.clear();
  vi.clearAllMocks();
  useSessionStore().user = { id: 'user' } as never;
  const space = useSpaceStore();
  space.spaces = ['home', 'other'].map((id) => ({
    id,
    name: id,
    timezone: 'UTC',
    currency: 'RSD',
    created_at: '',
  }));
  space.currentSpaceId = 'home';
  completeLinkExpense.mockResolvedValue(undefined);
});
it('a write finishing after a space switch refreshes only its originating resources', async () => {
  let resolve!: () => void;
  completeLinkExpense.mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      })
  );
  const originRead = vi.fn().mockResolvedValue('origin');
  const otherRead = vi.fn().mockResolvedValue('other');
  await queryCache
    .use({ key: ['user', 'home', 'projection'], staleTimeMs: 1000, load: originRead })
    .fetch();
  await queryCache
    .use({ key: ['user', 'other', 'projection'], staleTimeMs: 1000, load: otherRead })
    .fetch();
  const tracking = usePaymentTracking();
  await tracking.refresh();
  const write = tracking.link({ expenseId: 'expense' } as LinkDecision, 'request');
  useSpaceStore().currentSpaceId = 'other';
  resolve();
  const saved = await write;
  await saved.refresh();
  expect(completeLinkExpense).toHaveBeenCalledWith(
    expect.anything(),
    'home',
    expect.anything(),
    'request'
  );
  expect(originRead).toHaveBeenCalledTimes(2);
  expect(otherRead).toHaveBeenCalledTimes(1);
});
it('an affected projection read failure is reported as saved and retry repeats only reads', async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce('initial')
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue('updated');
  await queryCache
    .use({ key: ['user', 'home', 'projection'], staleTimeMs: 1000, load: read })
    .fetch();
  const tracking = usePaymentTracking();
  await tracking.refresh();
  const saved = await tracking.link({ expenseId: 'expense' } as LinkDecision, 'request');
  await expect(saved.refresh()).rejects.toThrow('Saved, but payment details could not refresh');
  await saved.refresh();
  expect(completeLinkExpense).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(3);
});
