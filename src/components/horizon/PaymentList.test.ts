import { mount } from '@vue/test-utils';
import { shallowRef, ref } from 'vue';
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import { usePaymentActionSheet } from '@/composables/usePaymentActionSheet';
import type { PaymentContext } from '@/composables/usePaymentTracking';
import PaymentList from './PaymentList.vue';
const { usePaymentTracking } = vi.hoisted(() => ({ usePaymentTracking: vi.fn() }));
vi.mock('@/composables/usePaymentTracking', () => ({ usePaymentTracking }));
const context = shallowRef<PaymentContext>();
beforeEach(() => {
  usePaymentActionSheet().close();
  context.value = {
    state: {},
    today: '2026-10-04',
    occurrences: [
      {
        id: 'rent',
        state: 'expected',
        expected: { label: 'Rent', date: '2026-10-03', amountMinor: -300, currency: 'RSD' },
      },
      {
        id: 'salary',
        state: 'expected',
        expected: { label: 'Salary', date: '2026-10-03', amountMinor: 1000, currency: 'RSD' },
      },
      {
        id: 'next',
        state: 'postponed',
        postponedDate: '2026-10-20',
        expected: { label: 'Next rent', date: '2026-10-15', amountMinor: -300, currency: 'RSD' },
      },
      {
        id: 'paid',
        state: 'completed',
        actual: { date: '2026-10-01', amountMinor: -280, currency: 'RSD' },
        expected: { label: 'Paid rent', date: '2026-10-15', amountMinor: -300, currency: 'RSD' },
      },
      {
        id: 'cancel',
        state: 'cancelled',
        expected: {
          label: 'Cancelled bill',
          date: '2026-10-02',
          amountMinor: -100,
          currency: 'RSD',
        },
      },
    ],
  } as unknown as PaymentContext;
  usePaymentTracking.mockReturnValue({ context, loading: ref(false), error: ref(null) });
});
it('overdue income and bills remain actionable with different forecast explanations', async () => {
  const wrapper = mount(PaymentList);
  expect(wrapper.text()).toContain('Overdue · due now');
  expect(wrapper.text()).toContain('Overdue · income not assumed');
  await wrapper
    .findAll('li button')
    .find((b) => b.text().includes('Salary'))!
    .trigger('click');
  expect(usePaymentActionSheet().paymentId.value).toBe('salary');
  wrapper.unmount();
});
it('completed and cancelled history remains reachable and filters by actual date/state', async () => {
  const wrapper = mount(PaymentList);
  await wrapper.find('#payment-history-state').setValue('completed');
  await wrapper.find('#payment-history-to').setValue('2026-10-01');
  expect(wrapper.find('details').text()).toContain('Paid rent');
  expect(wrapper.find('details').text()).not.toContain('Cancelled bill');
  await wrapper.find('details li button').trigger('click');
  expect(usePaymentActionSheet().paymentId.value).toBe('paid');
  wrapper.unmount();
});
it('postponed occurrences show their new date without changing original facts', () => {
  const wrapper = mount(PaymentList);
  expect(wrapper.text()).toContain('Postponed · Tue, Oct 20');
  expect(context.value!.occurrences.find((p) => p.id === 'next')!.expected.date).toBe('2026-10-15');
  wrapper.unmount();
});
