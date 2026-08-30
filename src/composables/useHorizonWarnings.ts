import {
  addDays,
  computeNegativeDayWarnings,
  projectionForRange,
  type NegativeDayWarning,
} from '@roman-mik/kapa-core/horizon';
import {
  dismissNegativeDay,
  listProjectionDismissals,
  type ProjectionDismissal,
} from '@roman-mik/kapa-core/horizon/queries';
import { zonedDateKey } from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

const DEFAULT_HORIZON_DAYS = 90;

export function useHorizonWarnings() {
  const space = useSpaceStore();
  const allWarnings = ref<NegativeDayWarning[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      allWarnings.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const now = new Date();
      const todayKey = zonedDateKey(now, currentSpace.timezone);
      const range = { from: todayKey, to: addDays(todayKey, DEFAULT_HORIZON_DAYS) };

      const [projection, dismissals] = await Promise.all([
        projectionForRange(supabase, currentSpace.id, {
          now,
          timeZone: currentSpace.timezone,
          range,
        }),
        listProjectionDismissals(supabase, currentSpace.id),
      ]);

      allWarnings.value = computeNegativeDayWarnings(
        projection.value.days,
        dismissals.map((d: ProjectionDismissal) => ({
          negativeDate: d.negative_date,
          shortfallMinor: d.shortfall_minor,
        })),
        currentSpace.currency
      );
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load negative-day warnings.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  const warnings = computed(() => allWarnings.value);

  /**
   * Persists the dismissal with the warning's *current* shortfall, then
   * drops it from the local list — no refetch needed. If the shortfall for
   * that date later moves, the next `refresh()` will bring the warning back
   * (the stored shortfall no longer matches).
   */
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

  return { warnings, loading, error, refresh, dismiss };
}
