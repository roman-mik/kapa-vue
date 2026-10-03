import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { expect, it, vi } from 'vite-plus/test';
import TodayView from './TodayView.vue';
const { today } = vi.hoisted(() => ({ today: vi.fn() }));
vi.mock('@/composables/useHorizonToday', () => ({ useHorizonToday: today }));
vi.mock('@/composables/useAccounts', () => ({ useAccounts: () => ({ accounts: ref([]) }) }));
it('explains incomplete totals and unavailable event conversion', () => {
  today.mockReturnValue({
    loading: ref(false),
    error: ref(null),
    conversionIssues: ref([{ currency: 'EUR', amountMinor: 50000 }]),
    isPartial: ref(true),
    refresh: vi.fn(),
    reportingCurrency: ref('RSD'),
    spendMode: ref('cap'),
    capMinor: ref(null),
    trough: ref({ minBalanceMinor: 100000, minBalanceDate: '2026-10-03' }),
    balanceToday: ref(100000),
    monthEnd: ref({ month: '2026-10', balanceMinor: 100000 }),
    nextEvents: ref([
      {
        date: '2026-10-03',
        sourceId: 'rent',
        label: 'Rent',
        amountMinor: 0,
        nativeAmountMinor: -50000,
        nativeCurrency: 'EUR',
        unconvertible: true,
        balanceAfterMinor: 100000,
      },
    ]),
    warnings: ref([]),
    daysUnderCount: ref(0),
    dismiss: vi.fn(),
  });
  const wrapper = mount(TodayView);
  expect(wrapper.text()).toContain('Forecast incomplete');
  expect(wrapper.find('.hero').text()).toContain('(partial)');
  expect(wrapper.find('.amount').text()).toContain('conversion unavailable');
  expect(wrapper.find('.hero-trough').classes()).not.toContain('has-shortfall');
});
