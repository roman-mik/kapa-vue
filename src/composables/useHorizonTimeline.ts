import {
  addDays,
  computeMetrics,
  computeNegativeDayWarnings,
  projectionForRange,
  type HorizonMetrics,
  type LedgerEvent,
  type NegativeDayWarning,
  type ProjectionDay,
} from '@roman-mik/kapa-core/horizon';
import {
  dismissNegativeDay,
  getSettings,
  listProjectionDismissals,
  type ProjectionDismissal,
} from '@roman-mik/kapa-core/horizon/queries';
import { zonedDateKey, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

export const RANGE_PRESETS = [1, 3, 6, 12] as const;
export type RangeMonths = (typeof RANGE_PRESETS)[number];

const DAYS_PER_MONTH = 30;

/**
 * The Timeline screen's own fetch — unlike `useHorizonToday`'s fixed 90-day
 * window, the range here is user-controlled (`rangeMonths`), so it can't
 * share a single projection fetch with Today without refetching on every
 * range change either way. Deliberately not unified with `useHorizonToday`/
 * `useHorizonWarnings` for the same reason documented there.
 */
export function useHorizonTimeline() {
  const space = useSpaceStore();
  const loading = ref(false);
  const error = ref<string | null>(null);

  const rangeMonths = ref<RangeMonths>(3);
  const reportingCurrency = ref<Currency>('RSD');
  const days = ref<ProjectionDay[]>([]);
  const events = ref<LedgerEvent[]>([]);
  const metrics = ref<HorizonMetrics | null>(null);
  const allWarnings = ref<NegativeDayWarning[]>([]);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      days.value = [];
      events.value = [];
      metrics.value = null;
      allWarnings.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const now = new Date();
      const todayKey = zonedDateKey(now, currentSpace.timezone);
      const range = {
        from: todayKey,
        to: addDays(todayKey, rangeMonths.value * DAYS_PER_MONTH - 1),
      };

      const [projection, settings, dismissals] = await Promise.all([
        projectionForRange(supabase, currentSpace.id, {
          now,
          timeZone: currentSpace.timezone,
          range,
        }),
        getSettings(supabase, currentSpace.id),
        listProjectionDismissals(supabase, currentSpace.id),
      ]);

      reportingCurrency.value = settings.reporting_currency as Currency;
      days.value = projection.value.days;
      events.value = projection.value.events;
      metrics.value = computeMetrics(projection.value.days);
      allWarnings.value = computeNegativeDayWarnings(
        projection.value.days,
        dismissals.map((d: ProjectionDismissal) => ({
          negativeDate: d.negative_date,
          shortfallMinor: d.shortfall_minor,
        })),
        reportingCurrency.value
      );
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load the timeline.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });
  watch(rangeMonths, refresh);

  const warnings = computed(() => allWarnings.value);

  async function dismiss(date: string, reason: string): Promise<void> {
    const spaceId = space.currentSpaceId;
    const warning = allWarnings.value.find((w) => w.date === date);
    if (!spaceId || !warning) return;
    await dismissNegativeDay(supabase, spaceId, {
      negative_date: warning.date,
      shortfall_minor: warning.shortfallMinor,
      currency: warning.currency,
      reason,
    });
    allWarnings.value = allWarnings.value.filter((w) => w.date !== date);
  }

  return {
    loading,
    error,
    refresh,
    rangeMonths,
    reportingCurrency,
    days,
    events,
    metrics,
    warnings,
    dismiss,
  };
}
