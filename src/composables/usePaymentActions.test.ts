import { createPinia, setActivePinia } from 'pinia';
import { shallowRef } from 'vue';
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import type { TrackedOccurrence } from '@roman-mik/kapa-core/horizon';
import { usePaymentActions } from './usePaymentActions';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { queryCache } from '@/lib/serverState/queryCache';
const { applyPaymentAction, undoPaymentAction, listPaymentActions, usePaymentTracking } =
  vi.hoisted(() => ({
    applyPaymentAction: vi.fn(),
    undoPaymentAction: vi.fn(),
    listPaymentActions: vi.fn(),
    usePaymentTracking: vi.fn(),
  }));
vi.mock('@roman-mik/kapa-core/horizon/queries', async (original) => ({
  ...(await original<typeof import('@roman-mik/kapa-core/horizon/queries')>()),
  applyPaymentAction,
  undoPaymentAction,
  listPaymentActions,
}));
vi.mock('./usePaymentTracking', () => ({ usePaymentTracking }));
const payment = { id: 'salary', state: 'expected', revision: 4 } as TrackedOccurrence;
const context = shallowRef({ occurrences: [payment], coverage: [] as { occurrenceId: string }[] });
beforeEach(() => {
  setActivePinia(createPinia());
  queryCache.clear();
  vi.clearAllMocks();
  useSessionStore().user = { id: 'user' } as never;
  const space = useSpaceStore();
  space.spaces = ['home', 'other'].map((id) => ({
    id,
    name: id,
    currency: 'RSD',
    timezone: 'UTC',
    created_at: '',
  }));
  space.currentSpaceId = 'home';
  context.value = { occurrences: [payment], coverage: [] };
  usePaymentTracking.mockReturnValue({ context });
  listPaymentActions.mockResolvedValue([
    { id: 'latest', occurrence_id: 'salary', after_value: { revision: 4 } },
  ]);
  applyPaymentAction.mockResolvedValue({ ...payment, revision: 5 });
  undoPaymentAction.mockResolvedValue({ ...payment, revision: 5 });
});
it('keeps the captured revision/request on a rejected command retry', async () => {
  const actions = usePaymentActions(() => payment.id);
  applyPaymentAction.mockRejectedValueOnce(new Error('Payment changed'));
  await expect(actions.apply(payment, { kind: 'cancel' }, 'request')).rejects.toThrow(
    'Payment changed'
  );
  await actions.apply(payment, { kind: 'cancel' }, 'request');
  expect(applyPaymentAction.mock.calls[0]).toEqual(applyPaymentAction.mock.calls[1]);
  expect(applyPaymentAction).toHaveBeenLastCalledWith(
    expect.anything(),
    'home',
    'salary',
    4,
    'request',
    { kind: 'cancel' }
  );
});
it('undo submits exactly the latest action; an older or mismatched revision cannot write', async () => {
  const actions = usePaymentActions(() => payment.id);
  await actions.history.refresh();
  await expect(actions.undo(payment, 'old', 'request')).rejects.toThrow('latest action');
  await expect(actions.undo({ ...payment, revision: 5 }, 'latest', 'request')).rejects.toThrow(
    'latest action'
  );
  expect(undoPaymentAction).not.toHaveBeenCalled();
  await actions.undo(payment, 'latest', 'request');
  expect(undoPaymentAction).toHaveBeenCalledWith(
    expect.anything(),
    'home',
    'salary',
    4,
    'request',
    'latest'
  );
});
it('a linked Pocket payment rejects direct correction or undo before writing', async () => {
  context.value.coverage = [{ occurrenceId: 'salary' }];
  const actions = usePaymentActions(() => payment.id);
  await expect(actions.apply(payment, { kind: 'reopen' }, 'request')).rejects.toThrow(
    'linked Pocket expense'
  );
  await expect(actions.undo(payment, 'latest', 'request')).rejects.toThrow('linked Pocket expense');
  expect(applyPaymentAction).not.toHaveBeenCalled();
  expect(undoPaymentAction).not.toHaveBeenCalled();
});
it('a pending save refreshes its original space, never the newly selected space', async () => {
  let resolve!: (p: TrackedOccurrence) => void;
  applyPaymentAction.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const originRead = vi.fn().mockResolvedValue('home');
  const otherRead = vi.fn().mockResolvedValue('other');
  await queryCache
    .use({ key: ['user', 'home', 'projection'], staleTimeMs: 1000, load: originRead })
    .fetch();
  await queryCache
    .use({ key: ['user', 'other', 'projection'], staleTimeMs: 1000, load: otherRead })
    .fetch();
  const actions = usePaymentActions(() => payment.id);
  const pending = actions.apply(payment, { kind: 'cancel' }, 'request');
  useSpaceStore().currentSpaceId = 'other';
  resolve(payment);
  await (await pending).refresh();
  expect(originRead).toHaveBeenCalledTimes(2);
  expect(otherRead).toHaveBeenCalledTimes(1);
});
it('saved refresh recovery retries reads without resubmitting the action', async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce('initial')
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue('updated');
  await queryCache
    .use({ key: ['user', 'home', 'projection'], staleTimeMs: 1000, load: read })
    .fetch();
  const actions = usePaymentActions(() => payment.id);
  const saved = await actions.apply(payment, { kind: 'cancel' }, 'request');
  await expect(saved.refresh()).rejects.toThrow('Saved, but');
  await saved.refresh();
  expect(applyPaymentAction).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(3);
});

it('history selects the highest revision when transaction timestamps tie', async () => {
  listPaymentActions.mockResolvedValue([
    { id: 'old', occurrence_id: 'salary', after_value: { revision: 3 } },
    { id: 'latest', occurrence_id: 'salary', after_value: { revision: 4 } },
  ]);
  const actions = usePaymentActions(() => payment.id);
  await actions.history.refresh();
  expect(actions.latest.value?.id).toBe('latest');
});
