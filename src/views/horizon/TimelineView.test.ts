import type { HorizonMetrics, LedgerEvent, ProjectionDay } from '@roman-mik/kapa-core/horizon';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vite-plus/test';
import { ref } from 'vue';
import BalanceLineChart from '@/components/horizon/BalanceLineChart.vue';
import WaterfallChart from '@/components/horizon/WaterfallChart.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import TimelineView from './TimelineView.vue';

const { useHorizonTimeline } = vi.hoisted(() => ({ useHorizonTimeline: vi.fn() }));

vi.mock('@/composables/useHorizonTimeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useHorizonTimeline')>();
  return { ...actual, useHorizonTimeline };
});

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
  { date: '2026-09-01', balanceMinor: 1000, events: [] },
  { date: '2026-09-02', balanceMinor: -49000, events: [fakeEvent()] },
];

const metrics: HorizonMetrics = {
  horizonDate: '2026-09-02',
  endBalanceMinor: -49000,
  months: [
    {
      month: '2026-09',
      endBalanceMinor: -49000,
      minBalanceMinor: -49000,
      minBalanceDate: '2026-09-02',
      surplusMinor: -49000,
    },
  ],
  firstNegativeDay: '2026-09-02',
  firstNegativeDayMinor: -49000,
  runwayMonths: 0.5,
};

function baseComposable(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    loading: ref(false),
    error: ref(null),
    rangeMonths: ref(3),
    reportingCurrency: ref('RSD'),
    days: ref(days),
    events: ref([fakeEvent()]),
    metrics: ref(metrics),
    warnings: ref([]),
    dismiss: vi.fn(),
    ...overrides,
  };
}

describe('TimelineView', () => {
  it('shows skeletons while loading with no data yet', () => {
    useHorizonTimeline.mockReturnValue(
      baseComposable({ loading: ref(true), days: ref([]), events: ref([]), metrics: ref(null) })
    );
    const wrapper = mount(TimelineView);
    expect(wrapper.findComponent(SkeletonBlock).exists()).toBe(true);
    expect(wrapper.find('h1').exists()).toBe(true);
  });

  it('shows the error message when the fetch fails', () => {
    useHorizonTimeline.mockReturnValue(baseComposable({ error: ref('boom') }));
    const wrapper = mount(TimelineView);
    expect(wrapper.find('[role="alert"]').text()).toBe('boom');
  });

  it('renders one month-summary row per MonthMetric, pairing end balance and minimum together', () => {
    useHorizonTimeline.mockReturnValue(baseComposable());
    const wrapper = mount(TimelineView);

    const row = wrapper.find('.month-table tbody tr');
    expect(row.text()).toContain('2026-09');
    expect(row.text()).toContain('2026-09-02');
  });

  it('renders the event-detail table from the raw event ledger', () => {
    useHorizonTimeline.mockReturnValue(baseComposable());
    const wrapper = mount(TimelineView);

    const row = wrapper.find('.event-table tbody tr');
    expect(row.text()).toContain('Rent');
    expect(row.text()).toContain('obligation');
  });

  it("passes warnings through to NegativeDayBanner and wires its dismiss emit to the composable's dismiss", async () => {
    const dismiss = vi.fn();
    useHorizonTimeline.mockReturnValue(
      baseComposable({
        warnings: ref([
          {
            date: '2026-09-02',
            shortfallMinor: 500,
            currency: 'RSD',
            fix: { kind: 'holdBack', amountMinor: 500 },
          },
        ]),
        dismiss,
      })
    );
    const wrapper = mount(TimelineView);

    await wrapper.find('input').setValue('will top up before then');
    await wrapper.find('form').trigger('submit');

    expect(dismiss).toHaveBeenCalledWith('2026-09-02', 'will top up before then');
  });

  it('switches between the balance-line and waterfall charts', async () => {
    useHorizonTimeline.mockReturnValue(baseComposable());
    const wrapper = mount(TimelineView);

    expect(wrapper.findComponent(BalanceLineChart).exists()).toBe(true);
    expect(wrapper.findComponent(WaterfallChart).exists()).toBe(false);

    const waterfallButton = wrapper.findAll('button').find((b) => b.text() === 'Waterfall');
    await waterfallButton?.trigger('click');

    expect(wrapper.findComponent(BalanceLineChart).exists()).toBe(false);
    expect(wrapper.findComponent(WaterfallChart).exists()).toBe(true);
  });
});
