import { useHorizonClock } from './useHorizonClock';
import { computed } from 'vue';
import { addDays, buildProjection } from '@roman-mik/kapa-core/horizon';
import { loadProjectionIngredients } from '@/lib/horizon/loadProjectionIngredients';
import { daysBetween } from '@roman-mik/kapa-core/horizon';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { useSpaceStore } from '@/stores/space';
import { supabase } from '@/lib/supabase';

/** Equal date ranges share one projection. */
export function useHorizonProjection(dayOffset: () => number) {
  const space = useSpaceStore();
  const clock = useHorizonClock();
  const range = computed(() => {
    const current = space.currentSpace;
    if (!current) return null;
    const from = clock.today.value;
    return { from, to: addDays(from, dayOffset()), timeZone: current.timezone };
  });
  return useSpaceQuery({
    resource: 'projection',
    staleTimeMs: 30_000,
    params: () => [range.value?.from, range.value?.to, range.value?.timeZone],
    load: async ({ spaceId, params }) => {
      const [from, to, timeZone] = params as [string, string, string];
      const loaded = await loadProjectionIngredients(
        supabase,
        spaceId,
        timeZone,
        daysBetween(from, to)
      );
      const result = buildProjection(loaded.input);
      return {
        ...result,
        input: loaded.input,
        unconverted: [...result.unconverted, ...loaded.unconverted],
      };
    },
  });
}
