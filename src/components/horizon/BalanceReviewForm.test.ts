import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { beforeEach, expect, it } from 'vite-plus/test';
import type { PaymentContext } from '@/composables/usePaymentTracking';
import BalanceReviewForm from './BalanceReviewForm.vue';
beforeEach(() => setActivePinia(createPinia()));
const context = () =>
  ({
    state: { revision: 4, cash_revision: 7 },
    today: '2026-10-04',
    accounts: [
      {
        id: 'bank',
        name: 'Bank',
        currency: 'RSD',
        current_balance_minor: 1000,
        include_in_total: true,
        archived: false,
      },
    ],
    observations: [
      { id: 'obs', accountId: 'bank', balanceMinor: 1000, currency: 'RSD', date: '2026-10-03' },
    ],
    expenses: [
      {
        id: 'expense',
        spent_at: '2026-10-04T10:00:00Z',
        updated_at: 'version',
        amount_minor: 300,
        currency: 'RSD',
        note: 'Rent',
      },
    ],
    coverage: [{ expenseId: 'expense', occurrenceId: 'rent', revision: 1 }],
    cutovers: [],
    occurrences: [
      {
        id: 'rent',
        state: 'completed',
        actual: { accountId: 'bank', amountMinor: -300, currency: 'RSD', date: '2026-10-04' },
        expected: { label: 'Rent' },
      },
    ],
  }) as unknown as PaymentContext;
it('a linked rent is reviewed once as a payment, never again as a standalone expense', async () => {
  const wrapper = mount(BalanceReviewForm, { props: { context: context(), busy: false } });
  expect(wrapper.text()).not.toContain('Recorded expenses already included');
  await wrapper.find('#checked-bank').setValue('650');
  const boxes = wrapper.findAll('input[type="checkbox"]');
  await boxes[0].setValue(true);
  await boxes[1].setValue(true);
  await wrapper.find('form').trigger('submit');
  expect(wrapper.emitted('submit')?.[0][0]).toEqual(
    expect.objectContaining({
      checks: [
        expect.objectContaining({
          accountId: 'bank',
          observationId: 'obs',
          previousBalanceMinor: 1000,
          balanceMinor: 650,
          includedPaymentIds: ['rent'],
        }),
      ],
      expenses: [],
      sourceRevision: 4,
      cashRevision: 7,
    })
  );
  wrapper.unmount();
});
it('invalid minor precision writes nothing and preserves the checked draft', async () => {
  const wrapper = mount(BalanceReviewForm, { props: { context: context(), busy: false } });
  await wrapper.find('#checked-bank').setValue('650.5');
  await wrapper.findAll('input[type="checkbox"]')[1].setValue(true);
  await wrapper.find('form').trigger('submit');
  expect(wrapper.emitted('submit')).toBeUndefined();
  expect(wrapper.text()).toContain('valid checked balance');
  expect((wrapper.find('#checked-bank').element as HTMLInputElement).value).toBe('650.5');
  wrapper.unmount();
});
it('a bank balance cannot save without explicit checked-today confirmation', async () => {
  const wrapper = mount(BalanceReviewForm, { props: { context: context(), busy: false } });
  await wrapper.find('form').trigger('submit');
  expect(wrapper.emitted('submit')).toBeUndefined();
  wrapper.unmount();
});
