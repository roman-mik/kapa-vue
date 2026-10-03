import { computeNegativeDayWarnings } from '@roman-mik/kapa-core/horizon';
import { dismissNegativeDay } from '@roman-mik/kapa-core/horizon/queries';
import { computed } from 'vue';
import { useHorizonProjection } from '@/composables/useHorizonProjection';
import { useProjectionDismissals } from '@/composables/useProjectionDismissals';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

export function useHorizonWarnings() {
  const space = useSpaceStore();
  const projection = useHorizonProjection(() => 90);
  const dismissals = useProjectionDismissals();
  const warnings = computed(() => {
    if (!space.currentSpace || !projection.data.value || !dismissals.data.value) return [];
    return computeNegativeDayWarnings(
      projection.data.value.value.days,
      dismissals.data.value.map((d) => ({
        negativeDate: d.negative_date,
        shortfallMinor: d.shortfall_minor,
      })),
      space.currentSpace.currency
    );
  });

  async function dismiss(date: string, reason: string): Promise<void> {
    const invalidate = dismissals.invalidate;
    const spaceId = space.currentSpaceId;
    const warning = warnings.value.find((w) => w.date === date);
    if (!spaceId || !warning) return;
    await dismissNegativeDay(supabase, spaceId, {
      negative_date: warning.date,
      shortfall_minor: warning.shortfallMinor,
      currency: warning.currency,
      reason,
    });
    await invalidate();
  }

  return {
    warnings,
    loading: computed(() => projection.loading.value || dismissals.loading.value),
    error: computed(() => projection.error.value ?? dismissals.error.value),
    refresh: async () => {
      await Promise.all([projection.refresh(), dismissals.refresh()]);
    },
    dismiss,
  };
}
