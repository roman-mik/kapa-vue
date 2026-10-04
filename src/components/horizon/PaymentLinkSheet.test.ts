import { createPinia, setActivePinia } from 'pinia';
import { mount, DOMWrapper, flushPromises } from '@vue/test-utils';
import { computed, shallowRef, ref } from 'vue';
import { beforeEach, afterEach, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useSessionStore } from '@/stores/session';
import { usePaymentLinkSheet } from '@/composables/usePaymentLinkSheet';
import type { PaymentContext } from '@/composables/usePaymentTracking';
import PaymentLinkSheet from './PaymentLinkSheet.vue';
const { usePaymentTracking, link, checkBalances, refresh, refreshSaved } = vi.hoisted(() => ({
  usePaymentTracking: vi.fn(),
  link: vi.fn(),
  checkBalances: vi.fn(),
  refresh: vi.fn(),
  refreshSaved: vi.fn(),
}));
vi.mock('@/composables/usePaymentTracking', () => ({ usePaymentTracking }));
const data = shallowRef<PaymentContext>();
const loadError = ref<string | null>(null);
function context(): PaymentContext {
  return {
    state: { space_id: 'space', revision: 4, cash_revision: 7 },
    accounts: [
      {
        id: 'bank',
        name: 'Checking',
        currency: 'RSD',
        current_balance_minor: 100000,
        include_in_total: true,
        archived: false,
      },
    ],
    observations: [
      { id: 'obs', accountId: 'bank', date: '2026-10-03', balanceMinor: 100000, currency: 'RSD' },
    ],
    expenses: [
      {
        id: 'expense',
        space_id: 'space',
        amount_minor: 30000,
        currency: 'RSD',
        spent_at: '2026-10-04T10:00:00Z',
        updated_at: 'v1',
        note: 'Rent',
        counts_toward_cap: false,
      },
    ],
    coverage: [],
    cutovers: [],
    occurrences: [
      {
        id: 'rent',
        revision: 2,
        state: 'expected',
        actual: null,
        postponedDate: null,
        expected: {
          key: 'rent',
          kind: 'obligation',
          amountMinor: -30000,
          date: '2026-10-05',
          originalDate: '2026-10-05',
          label: 'Rent',
          accountId: 'bank',
          currency: 'RSD',
        },
      },
    ],
    today: '2026-10-04',
  } as unknown as PaymentContext;
}
let wrapper: ReturnType<typeof mount>;
const dom = () => new DOMWrapper(document.body);
beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  const space = useSpaceStore();
  space.spaces = [
    { id: 'space', name: 'Home', currency: 'RSD', timezone: 'Europe/Belgrade', created_at: '' },
  ];
  space.currentSpaceId = 'space';
  useSessionStore().user = { id: 'user' } as never;
  data.value = context();
  loadError.value = null;
  refresh.mockImplementation(async () => data.value);
  refreshSaved.mockResolvedValue(undefined);
  link.mockResolvedValue({ refresh: refreshSaved });
  checkBalances.mockResolvedValue({ refresh: refreshSaved });
  usePaymentTracking.mockReturnValue({
    context: computed(() => data.value),
    error: loadError,
    loading: ref(false),
    refresh,
    link,
    checkBalances,
    allocate: link,
    separateAllowance: link,
    expenseForReview: vi.fn(async (id: string) => data.value?.expenses.find((e) => e.id === id)),
  });
  usePaymentLinkSheet().close();
});
afterEach(() => {
  wrapper?.unmount();
  usePaymentLinkSheet().close();
  document.body.innerHTML = '';
});
async function open(fromPayment = false) {
  usePaymentLinkSheet().open(
    fromPayment ? { paymentId: 'rent' } : { expense: data.value!.expenses[0] }
  );
  wrapper = mount(PaymentLinkSheet, {
    attachTo: document.body,
    global: { stubs: { RouterLink: true } },
  });
  await flushPromises();
  if (fromPayment) await dom().find('#link-expense').setValue('expense');
  else await dom().find('#link-payment').setValue('rent');
  await dom().find('input[type="radio"][value="excluded"]').setValue();
}
it('Pocket entry reviews facts and sends one completion/link with captured revisions', async () => {
  await open();
  expect(dom().text()).toContain('later recurring payments stay scheduled');
  expect(dom().find('input[value="included"]').attributes('disabled')).toBeDefined();
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(link).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      expenseId: 'expense',
      expenseUpdatedAt: 'v1',
      revision: 0,
      occurrenceId: 'rent',
      paymentRevision: 2,
      observationId: 'obs',
      inclusion: 'excluded',
    }),
    expect.any(String)
  );
  expect(usePaymentLinkSheet().isOpen.value).toBe(false);
});
it('Horizon entry chooses an existing expense', async () => {
  await open(true);
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(link).toHaveBeenCalledTimes(1);
  expect(link.mock.calls[0][0].expenseId).toBe('expense');
});
it('conflicts preserve choices and reload is an explicit review step', async () => {
  link.mockRejectedValue({ code: '40001', message: 'Payment changed. Reload before linking.' });
  await open();
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(dom().text()).toContain('Payment changed');
  expect((dom().find('#link-payment').element as HTMLSelectElement).value).toBe('rent');
  expect((dom().find('input[value="excluded"]').element as HTMLInputElement).checked).toBe(true);
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(link.mock.calls[1][1]).toBe(link.mock.calls[0][1]);
});
it('saved refresh failure only retries reads, never the payment command', async () => {
  refreshSaved.mockRejectedValueOnce(new Error('Saved, refresh failed'));
  await open();
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(dom().text()).toContain('Saved. Retry refresh to load your changes without saving again.');
  const retry = dom()
    .findAll('button')
    .find((b) => b.text() === 'Retry refresh')!;
  await retry.trigger('click');
  await flushPromises();
  expect(link).toHaveBeenCalledTimes(1);
  expect(refreshSaved).toHaveBeenCalledTimes(2);
});
it('a space change closes the draft while an old save response cannot reopen it', async () => {
  let resolve!: (v: { refresh: typeof refreshSaved }) => void;
  link.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  await open();
  await dom().find('form').trigger('submit');
  useSpaceStore().currentSpaceId = 'other';
  await flushPromises();
  expect(usePaymentLinkSheet().isOpen.value).toBe(false);
  resolve({ refresh: refreshSaved });
  await flushPromises();
  expect(refreshSaved).not.toHaveBeenCalled();
});
it('compatible completed payments require matching actual facts and inclusion', async () => {
  data.value!.occurrences[0].state = 'completed';
  data.value!.occurrences[0].actual = {
    date: '2026-10-04',
    amountMinor: -29000,
    currency: 'RSD',
    accountId: 'bank',
    observationId: 'obs',
    inclusion: 'excluded',
  };
  await open();
  expect(dom().text()).toContain('different actual details');
  expect(dom().find('button[type="submit"]').attributes('disabled')).toBeDefined();
});
it('future expenses cannot complete a payment', async () => {
  data.value!.expenses[0].spent_at = '2026-10-06T10:00:00Z';
  await open();
  expect(dom().find('button[type="submit"]').attributes('disabled')).toBeDefined();
});
it('initial cash review uses explicit checked amounts and selected spending snapshots', async () => {
  data.value!.state = null;
  data.value!.observations = [];
  usePaymentLinkSheet().open();
  wrapper = mount(PaymentLinkSheet, {
    attachTo: document.body,
    global: { stubs: { RouterLink: true } },
  });
  await flushPromises();
  await dom().find('#checked-bank').setValue('750.00');
  const checks = dom().findAll('input[type="checkbox"]');
  await checks[0].setValue(true);
  await checks.at(-1)!.setValue(true);
  await dom().find('form').trigger('submit');
  await flushPromises();
  expect(checkBalances).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceRevision: null,
      cashRevision: null,
      checks: [
        expect.objectContaining({
          accountId: 'bank',
          balanceMinor: 750,
          previousBalanceMinor: 100000,
          observationId: null,
        }),
      ],
      expenses: [{ expenseId: 'expense', expenseUpdatedAt: 'v1', revision: 0 }],
    })
  );
});

it('an expense without a planned match can save reviewed cash facts without completing a payment', async () => {
  usePaymentLinkSheet().open({ expense: data.value!.expenses[0] });
  wrapper = mount(PaymentLinkSheet, {
    attachTo: document.body,
    global: { stubs: { RouterLink: true } },
  });
  await flushPromises();
  await dom().find('#link-account').setValue('bank');
  await dom().find('input[value="excluded"]').setValue();
  await dom()
    .findAll('button')
    .find((b) => b.text() === 'Save cash movement only')!
    .trigger('click');
  await flushPromises();
  expect(link.mock.calls[0][0]).not.toHaveProperty('occurrenceId');
  expect(link.mock.calls[0][0]).toMatchObject({
    expenseId: 'expense',
    accountId: 'bank',
    inclusion: 'excluded',
  });
});

it('an unmounted review cannot close a newly opened review after its write resolves', async () => {
  let resolve!: (result: { refresh: typeof refreshSaved }) => void;
  link.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  await open();
  await dom().find('form').trigger('submit');
  wrapper.unmount();
  usePaymentLinkSheet().open({ paymentId: 'another-payment' });
  resolve({ refresh: refreshSaved });
  await flushPromises();
  expect(usePaymentLinkSheet().isOpen.value).toBe(true);
  expect(usePaymentLinkSheet().paymentId.value).toBe('another-payment');
  expect(refreshSaved).not.toHaveBeenCalled();
});
