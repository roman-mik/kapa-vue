import { useCashflowDecision } from './useCashflowDecision';
import { useHorizonClock } from './useHorizonClock';
import { calendarMonthEndpoint, daysBetween } from '@roman-mik/kapa-core/horizon';
import { computeMetrics, computeNegativeDayWarnings } from '@roman-mik/kapa-core/horizon';
import { dismissNegativeDay } from '@roman-mik/kapa-core/horizon/queries';
import { type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref } from 'vue';
import { useHorizonProjection } from '@/composables/useHorizonProjection';
import { useHorizonSettingsResource } from '@/composables/useHorizonSettingsResource';
import { useProjectionDismissals } from '@/composables/useProjectionDismissals';
import { supabase } from '@/lib/supabase';
import { orderedDayMinimum, daysUnder, daysUnderPerMonth } from '@/lib/horizon/daysUnder';
import { useSpaceStore } from '@/stores/space';

export const RANGE_PRESETS = [1, 3, 6, 12] as const;
export type RangeMonths = (typeof RANGE_PRESETS)[number];

export function useHorizonTimeline() {
  const space = useSpaceStore();
  const rangeMonths = ref<RangeMonths>(3);
  const clock = useHorizonClock();
  const projection = useHorizonProjection(() =>
    daysBetween(clock.today.value, calendarMonthEndpoint(clock.today.value, rangeMonths.value))
  );
  const settings = useHorizonSettingsResource();
  const decisions = useCashflowDecision(projection.data, projection.loading, projection.error);
  const effective = computed(() =>
    decisions.store.mode === 'cautious' ? decisions.result.value?.projection : projection.data.value
  );
  const dismissals = useProjectionDismissals();
  const reportingCurrency = computed(
    () => (settings.data.value?.reporting_currency ?? 'RSD') as Currency
  );
  const days = computed(() => effective.value?.value.days ?? []);
  const events = computed(() => effective.value?.value.events ?? []);
  const metrics = computed(() => {
    if (!effective.value) return null;
    const base = computeMetrics(effective.value.value.days);
    const summary = decisions.result.value?.summary;
    if (!summary) return base;
    return {
      ...base,
      months: summary.months.map((m) => ({
        month: m.month,
        endBalanceMinor: m.endingCashMinor,
        minBalanceMinor: m.minimum.balanceMinor,
        minBalanceDate: m.minimum.date,
        surplusMinor: m.netMovementMinor,
      })),
    };
  });
  const warnings = computed(() => {
    if (!effective.value || !dismissals.data.value) return [];
    return computeNegativeDayWarnings(
      days.value.map((day) => ({ ...day, balanceMinor: orderedDayMinimum(day) })),
      dismissals.data.value.map((d) => ({
        negativeDate: d.negative_date,
        shortfallMinor: d.shortfall_minor,
      })),
      reportingCurrency.value
    );
  });
  const daysUnderToday = computed(() => daysUnder(days.value));
  const daysUnderByMonth = computed(() => daysUnderPerMonth(days.value));

  async function dismiss(date: string, reason: string): Promise<void> {
    const invalidate = dismissals.invalidate;
    const spaceId = space.currentSpaceId;
    const warning = warnings.value.find((w) => w.date === date);
    if (!spaceId || !warning) return;
    await dismissNegativeDay(supabase, spaceId, {
      negative_date: date,
      shortfall_minor: warning.shortfallMinor,
      currency: warning.currency,
      reason,
    });
    await invalidate();
  }
  return {
    decisions,
    assessment: computed(() => effective.value?.value.assessment),
    conversionIssues: computed(() => effective.value?.unconverted ?? []),
    lifecycleIssues: computed(() => effective.value?.value.lifecycleIssues ?? []),
    isPartial: computed(
      () =>
        projection.loading.value ||
        !!projection.error.value ||
        !decisions.ready.value ||
        effective.value?.value.assessment?.complete === false ||
        !!effective.value?.unconverted.length ||
        !!effective.value?.value.lifecycleIssues?.length
    ),
    loading: computed(
      () => projection.loading.value || settings.loading.value || dismissals.loading.value
    ),
    error: computed(() => projection.error.value ?? settings.error.value ?? dismissals.error.value),
    refresh: async () => {
      await Promise.all([projection.refresh(), settings.refresh(), dismissals.refresh()]);
    },
    rangeMonths,
    reportingCurrency,
    days,
    events,
    metrics,
    warnings,
    daysUnderToday,
    daysUnderByMonth,
    dismiss,
  };
}
