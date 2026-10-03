import { computeMetrics, computeNegativeDayWarnings } from '@roman-mik/kapa-core/horizon';
import { dismissNegativeDay } from '@roman-mik/kapa-core/horizon/queries';
import { zonedDateKey, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed } from 'vue';
import { useCap } from '@/composables/useCap';
import { useHorizonProjection } from '@/composables/useHorizonProjection';
import { useHorizonSettingsResource } from '@/composables/useHorizonSettingsResource';
import { useProjectionDismissals } from '@/composables/useProjectionDismissals';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

export interface MonthMin {
  minBalanceMinor: number;
  minBalanceDate: string;
}

export function useHorizonToday() {
  const space = useSpaceStore();
  const projection = useHorizonProjection(() => 90);
  const settings = useHorizonSettingsResource();
  const dismissals = useProjectionDismissals();
  const cap = useCap();
  const reportingCurrency = computed(
    () => (settings.data.value?.reporting_currency ?? 'RSD') as Currency
  );
  const metrics = computed(() =>
    projection.data.value ? computeMetrics(projection.data.value.value.days) : null
  );
  const monthMin = computed<MonthMin | null>(() => {
    const month = metrics.value?.months[0];
    return month
      ? { minBalanceMinor: month.minBalanceMinor, minBalanceDate: month.minBalanceDate }
      : null;
  });
  const nextEvents = computed(() => {
    const current = space.currentSpace;
    if (!current) return [];
    const today = zonedDateKey(new Date(), current.timezone);
    return (
      projection.data.value?.value.events.filter((event) => event.date >= today).slice(0, 3) ?? []
    );
  });
  const warnings = computed(() => {
    if (!projection.data.value || !dismissals.data.value) return [];
    return computeNegativeDayWarnings(
      projection.data.value.value.days,
      dismissals.data.value.map((d) => ({
        negativeDate: d.negative_date,
        shortfallMinor: d.shortfall_minor,
      })),
      reportingCurrency.value
    );
  });
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
    loading: computed(
      () =>
        projection.loading.value ||
        settings.loading.value ||
        dismissals.loading.value ||
        cap.loading.value
    ),
    error: computed(
      () =>
        projection.error.value ?? settings.error.value ?? dismissals.error.value ?? cap.error.value
    ),
    refresh: async () => {
      await Promise.all([
        projection.refresh(),
        settings.refresh(),
        dismissals.refresh(),
        cap.refresh(),
      ]);
    },
    reportingCurrency,
    spendMode: computed(() => settings.data.value?.spend_mode ?? 'cap'),
    capMinor: computed(() => cap.cap.value?.monthly_cap_minor ?? null),
    endBalanceMinor: computed(() => metrics.value?.endBalanceMinor ?? 0),
    monthMin,
    nextEvents,
    warnings,
    dismiss,
  };
}
