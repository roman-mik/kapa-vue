import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import type { PocketSummary } from '@/composables/usePocketHome';
import CapProgressCard from './CapProgressCard.vue';

function baseSummary(overrides: Partial<PocketSummary> = {}): PocketSummary {
  return {
    month: '2026-09',
    currency: 'RSD',
    spent: 34_180_00,
    remaining: 65_820_00,
    safeDaily: 3_657_00,
    paceGap: 5_820_00,
    projection: 85_450_00,
    spentPct: 34,
    overspend: 0,
    categoryBreakdown: [],
    dailyTotals: [],
    dailyCapReference: 0,
    unconverted: [],
    todayExpenses: [],
    daysUntilReset: 18,
    home: { kind: 'in-budget', nudge: false, showPace: true, showProjection: true },
    ...overrides,
  };
}

describe('CapProgressCard', () => {
  it('shows the remaining amount and on-bar percentage for an in-budget month', () => {
    const wrapper = mount(CapProgressCard, { props: { summary: baseSummary() } });
    expect(wrapper.text()).toContain('left this month');
    expect(wrapper.text()).toContain('34%');
    expect(wrapper.text()).toContain('under an even pace');
    expect(wrapper.find('.fill').classes()).toContain('state-healthy');
  });

  it('flags the nudge state without relying on colour alone', () => {
    const wrapper = mount(CapProgressCard, {
      props: {
        summary: baseSummary({
          spentPct: 92,
          home: { kind: 'in-budget', nudge: true, showPace: true, showProjection: true },
        }),
      },
    });
    expect(wrapper.find('.fill').classes()).toContain('state-nudge');
    expect(wrapper.text()).toContain("You're approaching your cap");
  });

  it('shows the overspend amount and recovery copy when over cap', () => {
    const wrapper = mount(CapProgressCard, {
      props: {
        summary: baseSummary({
          spent: 110_000_00,
          remaining: -10_000_00,
          spentPct: 110,
          overspend: 10_000_00,
          home: {
            kind: 'over',
            overspend: 10_000_00,
            recovery: { suggested: true, cap: 90_000_00 },
          },
        }),
      },
    });
    expect(wrapper.text()).toContain('over your cap');
    expect(wrapper.find('.fill').classes()).toContain('state-over');
    // the visual fill clamps at 100% even though the true percentage is higher
    expect(wrapper.find('.fill').attributes('style')).toContain('width: 100%');
    expect(wrapper.text()).toContain('110%');
    expect(wrapper.text()).toContain("consider next month's cap");
  });

  it('omits the pace marker and safe-daily tile once a cap is exceeded', () => {
    const wrapper = mount(CapProgressCard, {
      props: {
        summary: baseSummary({
          spent: 110_000_00,
          remaining: -10_000_00,
          spentPct: 110,
          overspend: 10_000_00,
          home: { kind: 'over', overspend: 10_000_00, recovery: { suggested: false } },
        }),
      },
    });
    expect(wrapper.find('.pace-marker').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('safe a day');
  });
});
