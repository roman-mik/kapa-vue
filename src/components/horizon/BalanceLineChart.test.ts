import type { LedgerEvent, ProjectionDay } from '@roman-mik/kapa-core/horizon';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import BalanceLineChart from './BalanceLineChart.vue';

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

const days: ProjectionDay[] = [
  { date: '2026-09-01', balanceMinor: 5000, events: [] },
  { date: '2026-09-02', balanceMinor: -49000, events: [fakeEvent()] },
  { date: '2026-09-03', balanceMinor: -30000, events: [] },
];

describe('BalanceLineChart', () => {
  it('is an accessible SVG image with a plain-English summary', () => {
    const wrapper = mount(BalanceLineChart, {
      props: { days, events: [fakeEvent()], currency: 'RSD' },
    });
    const svg = wrapper.find('svg');
    expect(svg.attributes('role')).toBe('img');
    expect(svg.attributes('aria-label')).toContain('3 days');
    expect(svg.attributes('aria-label')).toContain('2 day(s) go negative');
  });

  it('renders one marker per non-unconvertible event, tagged with its kind', () => {
    const events = [
      fakeEvent({ kind: 'obligation', sourceId: 'ob1' }),
      fakeEvent({ kind: 'income', sourceId: 'in1', date: '2026-09-01', unconvertible: false }),
      fakeEvent({ kind: 'plannedSpend', sourceId: 'ps1', unconvertible: true }),
    ];
    const wrapper = mount(BalanceLineChart, { props: { days, events, currency: 'RSD' } });

    const markers = wrapper.findAll('[data-kind]');
    expect(markers).toHaveLength(2);
    expect(
      markers.map((m) => m.attributes('data-kind') ?? '').sort((a, b) => a.localeCompare(b))
    ).toEqual(['income', 'obligation']);
  });

  it('shades a negative-balance band when any day goes negative', () => {
    const wrapper = mount(BalanceLineChart, { props: { days, events: [], currency: 'RSD' } });
    expect(wrapper.find('.negative-band').exists()).toBe(true);
  });

  it('omits the negative-balance band when every day stays non-negative', () => {
    const positiveDays: ProjectionDay[] = [
      { date: '2026-09-01', balanceMinor: 100, events: [] },
      { date: '2026-09-02', balanceMinor: 200, events: [] },
    ];
    const wrapper = mount(BalanceLineChart, {
      props: { days: positiveDays, events: [], currency: 'RSD' },
    });
    expect(wrapper.find('.negative-band').exists()).toBe(false);
  });

  it('splits the balance path at zero-crossings so negative runs can be dashed', () => {
    const wrapper = mount(BalanceLineChart, { props: { days, events: [], currency: 'RSD' } });
    const paths = wrapper.findAll('path.balance-line');
    expect(paths.length).toBeGreaterThan(1);
    expect(wrapper.findAll('path.balance-line.negative').length).toBeGreaterThan(0);
  });
});
