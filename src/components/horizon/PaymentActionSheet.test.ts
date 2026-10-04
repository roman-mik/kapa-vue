import { createPinia, setActivePinia } from 'pinia';
import { mount, DOMWrapper, flushPromises } from '@vue/test-utils';
import { computed, ref, shallowRef } from 'vue';
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useSessionStore } from '@/stores/session';
import { usePaymentActionSheet } from '@/composables/usePaymentActionSheet';
import type { PaymentContext } from '@/composables/usePaymentTracking';
import PaymentActionSheet from './PaymentActionSheet.vue';
const { usePaymentActions, apply, undo, refreshSaved, refresh } = vi.hoisted(() => ({
  usePaymentActions: vi.fn(),
  apply: vi.fn(),
  undo: vi.fn(),
  refreshSaved: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/composables/usePaymentActions', () => ({ usePaymentActions }));
const context = shallowRef<PaymentContext>();
const latest = shallowRef<unknown>(null);
const dom = () => new DOMWrapper(document.body);
let wrapper: ReturnType<typeof mount>;
beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  const space = useSpaceStore();
  space.spaces = [{ id: 'home', name: 'Home', timezone: 'UTC', currency: 'RSD', created_at: '' }];
  space.currentSpaceId = 'home';
  useSessionStore().user = { id: 'user' } as never;
  context.value = {
    today: '2026-10-04',
    projectionInput: null,
    accounts: [
      { id: 'bank', name: 'Bank', currency: 'RSD', archived: false, include_in_total: true },
      { id: 'euro', name: 'Euro', currency: 'EUR', archived: false, include_in_total: false },
    ],
    observations: [
      { id: 'obs', accountId: 'bank', date: '2026-10-03', balanceMinor: 500, currency: 'RSD' },
    ],
    coverage: [],
    occurrences: [
      {
        id: 'salary',
        revision: 0,
        state: 'expected',
        actual: null,
        postponedDate: null,
        expected: {
          label: 'Salary',
          date: '2026-10-15',
          originalDate: '2026-10-15',
          amountMinor: 1000,
          currency: 'RSD',
          accountId: 'bank',
          kind: 'income',
        },
      },
    ],
  } as unknown as PaymentContext;
  latest.value = null;
  refresh.mockImplementation(async () => context.value);
  refreshSaved.mockResolvedValue(undefined);
  apply.mockResolvedValue({ refresh: refreshSaved });
  undo.mockResolvedValue({ refresh: refreshSaved });
  usePaymentActions.mockReturnValue({
    tracking: { context, loading: ref(false), error: ref(null), refresh },
    history: { refresh, loading: ref(false), error: ref(null) },
    latest,
    records: computed(() => (latest.value ? [latest.value] : [])),
    apply,
    undo,
  });
  usePaymentActionSheet().open('salary');
});
afterEach(() => {
  wrapper?.unmount();
  usePaymentActionSheet().close();
  document.body.innerHTML = '';
});
async function open() {
  wrapper = mount(PaymentActionSheet, { attachTo: document.body });
  await flushPromises();
}
async function click(name: string) {
  const b = dom()
    .findAll('button')
    .find((b) => b.text() === name)!;
  await b.trigger('click');
  await flushPromises();
}
async function receipt() {
  await open();
  await click('Mark received');
  await dom().find('#actual-amount').setValue('900');
  await dom().find('input[value="excluded"]').setValue();
}
it('records an early receipt with actual facts and original observation', async () => {
  await receipt();
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'salary', revision: 0 }),
    {
      kind: 'complete',
      actual: {
        amountMinor: 900,
        currency: 'RSD',
        date: '2026-10-04',
        accountId: 'bank',
        observationId: 'obs',
        inclusion: 'excluded',
      },
    },
    expect.any(String)
  );
  expect(usePaymentActionSheet().paymentId.value).toBeNull();
});
it('postpones only the selected occurrence', async () => {
  await open();
  await click('Change date');
  await dom().find('#postponed-date').setValue('2026-10-20');
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(apply.mock.calls[0][1]).toEqual({ kind: 'postpone', date: '2026-10-20' });
  expect(context.value!.occurrences[0].expected.date).toBe('2026-10-15');
});
it('dismissal of cancellation writes nothing; confirmed cancellation writes once', async () => {
  await open();
  await click('Cancel this payment');
  await click('Back');
  expect(apply).not.toHaveBeenCalled();
  await click('Cancel this payment');
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(apply.mock.calls[0][1]).toEqual({ kind: 'cancel' });
});
it('future actual date cannot save and post-observation included choice is disabled', async () => {
  await receipt();
  expect(dom().find('input[value="included"]').attributes('disabled')).toBeDefined();
  await dom().find('#actual-date').setValue('2026-10-05');
  await dom().find('form').trigger('submit');
  expect(apply).not.toHaveBeenCalled();
});
it('changing currency requires a new native amount and inclusion choice', async () => {
  await receipt();
  await dom().find('#actual-account').setValue('euro');
  expect((dom().find('#actual-amount').element as HTMLInputElement).value).toBe('');
  expect((dom().find('input[value="excluded"]').element as HTMLInputElement).checked).toBe(false);
});
it('conflict preserves entered facts and retry request identity', async () => {
  apply.mockRejectedValueOnce(new Error('Payment changed. Reload.'));
  await receipt();
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(dom().text()).toContain('Payment changed');
  expect((dom().find('#actual-amount').element as HTMLInputElement).value).toBe('900');
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(apply.mock.calls[0][2]).toBe(apply.mock.calls[1][2]);
});
it('a saved refresh failure retries reads only', async () => {
  refreshSaved.mockRejectedValueOnce(new Error('Offline'));
  await receipt();
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(dom().text()).toContain('Saved. Refresh your forecast');
  await click('Retry refresh');
  expect(apply).toHaveBeenCalledTimes(1);
  expect(refreshSaved).toHaveBeenCalledTimes(2);
});
it('Pocket-linked payments do not offer direct correction or reopen', async () => {
  context.value!.coverage = [{ occurrenceId: 'salary' }] as never;
  context.value!.occurrences[0].state = 'completed';
  await open();
  expect(dom().text()).toContain('Recorded in Pocket');
  expect(dom().text()).not.toContain('Correct actual');
  expect(dom().text()).not.toContain('Reopen this payment');
});
it('safe undo uses the current action ID', async () => {
  context.value!.occurrences[0].state = 'cancelled';
  context.value!.occurrences[0].revision = 1;
  latest.value = {
    id: 'last',
    after_value: { revision: 1 },
    before_value: { actual: null },
    command: { action: { kind: 'cancel' } },
    recorded_at: '2026-10-04T10:00:00Z',
  };
  await open();
  await click('Undo last action');
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(undo).toHaveBeenCalledWith(
    expect.objectContaining({ revision: 1 }),
    'last',
    expect.any(String)
  );
});
it('a pending response cannot close a new review after unmount', async () => {
  let resolve!: (r: { refresh: typeof refreshSaved }) => void;
  apply.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  await receipt();
  await dom().find('form').trigger('submit');
  wrapper.unmount();
  usePaymentActionSheet().open('another');
  resolve({ refresh: refreshSaved });
  await flushPromises();
  expect(usePaymentActionSheet().paymentId.value).toBe('another');
  expect(refreshSaved).not.toHaveBeenCalled();
});

it('an open payment draft expires at zoned midnight without a write', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-10-04T23:59:45Z'));
  try {
    await receipt();
    vi.advanceTimersByTime(30_000);
    await flushPromises();
    expect(dom().text()).toContain('The date changed');
    await dom().find('form').trigger('submit');
    expect(apply).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
    vi.useRealTimers();
  }
});
