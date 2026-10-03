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

function shiftWarning(
  date: string,
  shortfallMinor = 1000,
  eventLabel = 'Rent'
): NegativeDayWarning {
  return {
    date,
    shortfallMinor,
    currency: 'RSD',
    fix: { kind: 'shiftPayment', event: fakeEvent({ date, label: eventLabel }) },
  };
}

function holdBackWarning(date: string, shortfallMinor = 500): NegativeDayWarning {
  return {
    date,
    shortfallMinor,
    currency: 'RSD',
    fix: { kind: 'holdBack', amountMinor: shortfallMinor },
  };
}

describe('NegativeDayBanner', () => {
  it('renders nothing when there are no warnings', () => {
    const wrapper = mount(NegativeDayBanner, { props: { warnings: [] } });
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('renders a single-day dip with the shift-payment fix suggestion', () => {
    const wrapper = mount(NegativeDayBanner, {
      props: { warnings: [shiftWarning('2026-09-02')] },
    });
    const text = wrapper.text();
    expect(text).toContain(formatFullDate('2026-09-02'));
    expect(text).toContain('Shift the Rent payment');
  });

  it('renders a hold-back suggestion when the fix has no shiftable event', () => {
    const wrapper = mount(NegativeDayBanner, {
      props: { warnings: [holdBackWarning('2026-09-03')] },
    });
    expect(wrapper.text()).toContain('Hold back');
  });

  it('groups consecutive same-shortfall days into one banner', () => {
    const warnings = [
      shiftWarning('2026-09-02', 1000),
      shiftWarning('2026-09-03', 1000),
      shiftWarning('2026-09-04', 1000),
    ];
    const wrapper = mount(NegativeDayBanner, { props: { warnings } });

    const text = wrapper.text();
    expect(text).toContain(formatFullDate('2026-09-02'));
    expect(text).toContain(formatFullDate('2026-09-04'));
    expect(wrapper.findAll('.warning')).toHaveLength(1);
  });

  it('splits a shortfall change into separate banners', () => {
    const warnings = [shiftWarning('2026-09-02', 1000), shiftWarning('2026-09-03', 2000)];
    const wrapper = mount(NegativeDayBanner, { props: { warnings } });
    expect(wrapper.findAll('.warning')).toHaveLength(2);
  });

  it('hides the dismiss form until "It\'s fine" is tapped', async () => {
    const wrapper = mount(NegativeDayBanner, {
      props: { warnings: [shiftWarning('2026-09-02')] },
    });
    expect(wrapper.find('form').exists()).toBe(false);

    const button = wrapper.findAll('button').find((b) => b.text() === "It's fine");
    expect(button).toBeDefined();
    await button!.trigger('click');

    expect(wrapper.find('form').exists()).toBe(true);
  });

  it('emits dismiss for every day in the span with the entered reason', async () => {
    const warnings = [shiftWarning('2026-09-02', 1000), shiftWarning('2026-09-03', 1000)];
    const wrapper = mount(NegativeDayBanner, { props: { warnings } });

    const quiet = wrapper.findAll('button').find((b) => b.text() === "It's fine");
    await quiet!.trigger('click');

    await wrapper.find('input').setValue('will top up before then');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('dismiss')).toEqual([
      [['2026-09-02', '2026-09-03'], 'will top up before then'],
    ]);
  });

  it('does not emit dismiss when the reason is empty', async () => {
    const wrapper = mount(NegativeDayBanner, {
      props: { warnings: [shiftWarning('2026-09-02')] },
    });

    const quiet = wrapper.findAll('button').find((b) => b.text() === "It's fine");
    await quiet!.trigger('click');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('dismiss')).toBeUndefined();
  });

  it('emits fix when the shift-payment primary action is tapped', async () => {
    const warning = shiftWarning('2026-09-02', 1000, 'Rent');
    const wrapper = mount(NegativeDayBanner, { props: { warnings: [warning] } });

    const primary = wrapper.findAll('button').find((b) => b.text().includes('Shift the Rent'));
    expect(primary).toBeDefined();
    await primary!.trigger('click');

    expect(wrapper.emitted('fix')).toEqual([[warning]]);
  });

  it('does not render a fix primary action for a hold-back warning', () => {
    const wrapper = mount(NegativeDayBanner, {
      props: { warnings: [holdBackWarning('2026-09-03')] },
    });
    const buttons = wrapper.findAll('button').map((b) => b.text());
    expect(buttons).not.toContain('Hold back');
    // Only the quiet "It's fine" action remains
    expect(buttons).toEqual(["It's fine"]);
  });
});
