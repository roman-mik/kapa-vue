import type { HorizonMetrics, LedgerEvent, ProjectionDay } from '@roman-mik/kapa-core/horizon';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vite-plus/test';
import { ref } from 'vue';
import BalanceLineChart from '@/components/horizon/BalanceLineChart.vue';
import WaterfallChart from '@/components/horizon/WaterfallChart.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { formatFullMonth } from '@/lib/date';
import TimelineView from './TimelineView.vue';

const { useHorizonTimeline } = vi.hoisted(() => ({ useHorizonTimeline: vi.fn() }));
const { useViewport } = vi.hoisted(() => ({ useViewport: vi.fn() }));

vi.mock('@/composables/useHorizonTimeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useHorizonTimeline')>();
  return { ...actual, useHorizonTimeline };
});

vi.mock('@/composables/useViewport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useViewport')>();
  return { ...actual, useViewport };
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
    daysUnderByMonth: ref([{ month: '2026-09', daysUnder: 2 }]),
    dismiss: vi.fn(),
    ...overrides,
  };
}

function setDesktop(value: boolean): void {
  useViewport.mockReturnValue({ isDesktop: ref(value) });
}

describe('TimelineView', () => {
  it('shows skeletons while loading with no data yet', () => {
    setDesktop(false);
    useHorizonTimeline.mockReturnValue(
      baseComposable({ loading: ref(true), days: ref([]), events: ref([]), metrics: ref(null) })
    );
    const wrapper = mount(TimelineView);
    expect(wrapper.findComponent(SkeletonBlock).exists()).toBe(true);
    expect(wrapper.find('h1').exists()).toBe(true);
  });

  it('shows the error message when the fetch fails', () => {
    setDesktop(false);
    useHorizonTimeline.mockReturnValue(baseComposable({ error: ref('boom') }));
    const wrapper = mount(TimelineView);
    expect(wrapper.find('[role="alert"]').text()).toBe('boom');
  });

  it('renders one day-by-day month block with the month header summary and event rows', () => {
    setDesktop(false);
    useHorizonTimeline.mockReturnValue(baseComposable());
    const wrapper = mount(TimelineView);

    const month = wrapper.find('.month');
    expect(month.find('.month-name').text()).toBe(formatFullMonth('2026-09'));
    expect(month.find('.month-line').text()).toContain('on the 2');

    const row = month.find('.row');
    expect(row.text()).toContain('Rent');
    expect(row.text()).toContain('50,000');
  });

  it('shows the days-under badge on a month that dips below zero', () => {
    setDesktop(false);
    useHorizonTimeline.mockReturnValue(baseComposable());
    const wrapper = mount(TimelineView);
    expect(wrapper.find('.under-badge').text()).toContain('2');
  });

  it('marks the global trough day with a lowest-point tag', () => {
    setDesktop(false);
    useHorizonTimeline.mockReturnValue(baseComposable());
    const wrapper = mount(TimelineView);
    expect(wrapper.find('.row.trough .trough-tag').text()).toBe('lowest point');
  });

  it('drops the waterfall toggle on a phone viewport, keeping the balance line', () => {
    setDesktop(false);
    useHorizonTimeline.mockReturnValue(baseComposable());
    const wrapper = mount(TimelineView);

    expect(wrapper.findComponent(BalanceLineChart).exists()).toBe(true);
    expect(wrapper.findComponent(WaterfallChart).exists()).toBe(false);
    expect(wrapper.find('.view-toggle').exists()).toBe(false);
  });

  it('shows the right-column month summary and the waterfall toggle on desktop', async () => {
    setDesktop(true);
    useHorizonTimeline.mockReturnValue(baseComposable());
    const wrapper = mount(TimelineView);

    // Waterfall toggle appears on desktop.
    expect(wrapper.find('.view-toggle').exists()).toBe(true);
    const waterfallButton = wrapper.findAll('button').find((b) => b.text() === 'Waterfall');
    await waterfallButton?.trigger('click');
    expect(wrapper.findComponent(BalanceLineChart).exists()).toBe(false);
    expect(wrapper.findComponent(WaterfallChart).exists()).toBe(true);

    // Compact month-summary table sits in the right column.
    const summary = wrapper.find('.page-side .month-table');
    expect(summary.exists()).toBe(true);
    expect(summary.text()).toContain(formatFullMonth('2026-09'));
  });

  it("passes warnings through to NegativeDayBanner and wires its dismiss emit to the composable's dismiss", async () => {
    setDesktop(false);
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

    const quiet = wrapper.findAll('button').find((b) => b.text() === "It's fine");
    await quiet!.trigger('click');
    await wrapper.find('input').setValue('will top up before then');
    await wrapper.find('form').trigger('submit');

    expect(dismiss).toHaveBeenCalledWith('2026-09-02', 'will top up before then');
  });
});
