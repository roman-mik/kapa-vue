import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref, shallowRef } from 'vue';
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { usePaymentLinkSheet } from '@/composables/usePaymentLinkSheet';
import AccountsView from './AccountsView.vue';
const { useAccounts, usePaymentTracking, useConvertedAmount, update } = vi.hoisted(() => ({
  useAccounts: vi.fn(),
  usePaymentTracking: vi.fn(),
  useConvertedAmount: vi.fn(),
  update: vi.fn(),
}));
vi.mock('@/composables/useAccounts', () => ({ useAccounts }));
vi.mock('@/composables/usePaymentTracking', () => ({ usePaymentTracking }));
vi.mock('@/composables/useConvertedAmount', () => ({ useConvertedAmount }));
const context = shallowRef<{ state: unknown } | undefined>({ state: {} });
beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  useSpaceStore().spaces = [
    { id: 'home', name: 'Home', currency: 'RSD', timezone: 'UTC', created_at: '' },
  ];
  useSpaceStore().currentSpaceId = 'home';
  context.value = { state: {} };
  usePaymentTracking.mockReturnValue({ context, error: ref(null) });
  useAccounts.mockReturnValue({
    accounts: ref([
      {
        id: 'bank',
        name: 'Bank',
        currency: 'RSD',
        current_balance_minor: 1000,
        include_in_total: true,
        type: 'bank',
        archived: false,
        updated_at: 'version',
      },
    ]),
    loading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    add: vi.fn(),
    update,
    archive: vi.fn(),
  });
  update.mockResolvedValue({ ok: true });
  useConvertedAmount.mockReturnValue({
    convertedMinor: () => 1000,
    spaceCurrencyAmount: () => 1000,
    unconvertible: ref([]),
    rateFor: () => null,
    refresh: vi.fn(),
    loading: ref(false),
  });
  usePaymentLinkSheet().close();
});
it('tracked account edits cannot bypass bank observation review', async () => {
  const wrapper = mount(AccountsView, {
    global: { stubs: { RouterLink: true, ReconcilePanel: true } },
  });
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Edit')!
    .trigger('click');
  expect(wrapper.find('form').text()).not.toContain('Current balance');
  await wrapper.find('form').trigger('submit');
  await flushPromises();
  expect(update.mock.calls[0][1]).not.toHaveProperty('current_balance_minor');
  expect(usePaymentLinkSheet().balanceReview.value).toBe(true);
  wrapper.unmount();
  usePaymentLinkSheet().close();
});
it('unknown tracking state cannot fall through to legacy reconciliation or write', async () => {
  context.value = undefined;
  const wrapper = mount(AccountsView, {
    global: { stubs: { RouterLink: true, ReconcilePanel: true } },
  });
  expect(wrapper.find('reconcile-panel-stub').exists()).toBe(false);
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Edit')!
    .trigger('click');
  await wrapper.find('form').trigger('submit');
  expect(update).not.toHaveBeenCalled();
  expect(wrapper.text()).toContain('Load payment tracking');
  wrapper.unmount();
});
