import type { LedgerEvent } from '@roman-mik/kapa-core/horizon';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import WaterfallChart from './WaterfallChart.vue';

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
    balanceBeforeMinor: 1000,
    balanceAfterMinor: -49000,
    ...overrides,
  };
}

describe('WaterfallChart', () => {
  it('buckets same-day, same-kind events into a single bar', () => {
    const events = [
      fakeEvent({ sourceId: 'ob1', amountMinor: -30000, balanceAfterMinor: -29000 }),
      fakeEvent({ sourceId: 'ob2', amountMinor: -20000, balanceAfterMinor: -49000 }),
    ];
    const wrapper = mount(WaterfallChart, { props: { events, currency: 'RSD' } });

    const bars = wrapper.findAll('[data-kind]');
    expect(bars).toHaveLength(1);
    expect(bars[0].find('title').text()).toContain('2 events');
  });

  it('keeps different kinds on the same day as separate bars, tagged by kind', () => {
    const events = [
      fakeEvent({ kind: 'obligation', sourceId: 'ob1' }),
      fakeEvent({ kind: 'income', sourceId: 'in1', amountMinor: 100000, balanceAfterMinor: 51000 }),
    ];
    const wrapper = mount(WaterfallChart, { props: { events, currency: 'RSD' } });

    const bars = wrapper.findAll('[data-kind]');
    expect(
      bars.map((b) => b.attributes('data-kind') ?? '').sort((a, b) => a.localeCompare(b))
    ).toEqual(['income', 'obligation']);
  });

  it('excludes unconvertible events', () => {
    const events = [fakeEvent({ unconvertible: true })];
    const wrapper = mount(WaterfallChart, { props: { events, currency: 'RSD' } });
    expect(wrapper.findAll('[data-kind]')).toHaveLength(0);
  });

  it('is an accessible SVG image', () => {
    const wrapper = mount(WaterfallChart, { props: { events: [fakeEvent()], currency: 'RSD' } });
    const svg = wrapper.find('svg');
    expect(svg.attributes('role')).toBe('img');
    expect(svg.attributes('aria-label')).toContain('1 grouped events');
  });

  it('shades a negative-balance band when a bucket ends negative', () => {
    const wrapper = mount(WaterfallChart, { props: { events: [fakeEvent()], currency: 'RSD' } });
    expect(wrapper.find('.negative-band').exists()).toBe(true);
  });
});
