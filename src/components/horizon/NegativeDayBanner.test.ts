import type { LedgerEvent, NegativeDayWarning } from '@roman-mik/kapa-core/horizon';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import { formatFullDate } from '@/lib/date';
import NegativeDayBanner from './NegativeDayBanner.vue';

function fakeEvent(overrides: Partial<LedgerEvent> = {}): LedgerEvent {
  return {
    date: '2026-09-02',
    originalDate: '2026-09-02',
    shifted: false,
    kind: 'obligation',
    label: 'Rent',
    sourceId: 'ob1',
    amountMinor: -50000,
    nativeCurrency: 'RSD',
    nativeAmountMinor: -50000,
    unconvertible: false,
    accountId: 'a1',
    coveredPeriod: null,
    recurring: true,
    balanceBeforeMinor: 0,
    balanceAfterMinor: -1000,
    ...overrides,
  };
}

const shiftWarning: NegativeDayWarning = {
  date: '2026-09-02',
  shortfallMinor: 1000,
  currency: 'RSD',
  fix: { kind: 'shiftPayment', event: fakeEvent() },
};

describe('NegativeDayBanner', () => {
  it('renders nothing when there are no warnings', () => {
    const wrapper = mount(NegativeDayBanner, { props: { warnings: [] } });
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('renders the shortfall and the shift-payment fix suggestion', () => {
    const wrapper = mount(NegativeDayBanner, { props: { warnings: [shiftWarning] } });
    const text = wrapper.text();
    expect(text).toContain(formatFullDate('2026-09-02'));
    expect(text).toContain('Shift the Rent payment');
  });

  it('renders a hold-back suggestion when the fix has no shiftable event', () => {
    const holdBackWarning: NegativeDayWarning = {
      date: '2026-09-03',
      shortfallMinor: 500,
      currency: 'RSD',
      fix: { kind: 'holdBack', amountMinor: 500 },
    };
    const wrapper = mount(NegativeDayBanner, { props: { warnings: [holdBackWarning] } });
    expect(wrapper.text()).toContain('Hold back');
  });

  it('emits dismiss with the entered reason', async () => {
    const wrapper = mount(NegativeDayBanner, { props: { warnings: [shiftWarning] } });

    await wrapper.find('input').setValue('will top up before then');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('dismiss')).toEqual([['2026-09-02', 'will top up before then']]);
  });

  it('does not emit dismiss when the reason is empty', async () => {
    const wrapper = mount(NegativeDayBanner, { props: { warnings: [shiftWarning] } });
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('dismiss')).toBeUndefined();
  });
});
