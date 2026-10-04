import { computeMetrics, computeNegativeDayWarnings } from '@roman-mik/kapa-core/horizon';
import { dismissNegativeDay } from '@roman-mik/kapa-core/horizon/queries';
import { type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref } from 'vue';
import { useHorizonProjection } from '@/composables/useHorizonProjection';
import { useHorizonSettingsResource } from '@/composables/useHorizonSettingsResource';
import { useProjectionDismissals } from '@/composables/useProjectionDismissals';
import { supabase } from '@/lib/supabase';
import { daysUnder, daysUnderPerMonth } from '@/lib/horizon/daysUnder';
import { useSpaceStore } from '@/stores/space';

export const RANGE_PRESETS = [1, 3, 6, 12] as const;
export type RangeMonths = (typeof RANGE_PRESETS)[number];

export function useHorizonTimeline() {
  const space = useSpaceStore();
  const rangeMonths = ref<RangeMonths>(3);
  const projection = useHorizonProjection(() => rangeMonths.value * 30 - 1);
  const settings = useHorizonSettingsResource();
  const dismissals = useProjectionDismissals();
  const reportingCurrency = computed(
    () => (settings.data.value?.reporting_currency ?? 'RSD') as Currency
  );
  const days = computed(() => projection.data.value?.value.days ?? []);
  const events = computed(() => projection.data.value?.value.events ?? []);
  const metrics = computed(() => (projection.data.value ? computeMetrics(days.value) : null));
  const warnings = computed(() => {
    if (!projection.data.value || !dismissals.data.value) return [];
    return computeNegativeDayWarnings(
      days.value,
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
    conversionIssues: computed(() => projection.data.value?.unconverted ?? []),
    lifecycleIssues: computed(() => projection.data.value?.value.lifecycleIssues ?? []),
    isPartial: computed(
      () =>
        !!projection.data.value?.unconverted.length ||
        !!projection.data.value?.value.lifecycleIssues?.length
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
