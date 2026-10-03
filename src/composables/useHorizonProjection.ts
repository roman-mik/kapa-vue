import { computed } from 'vue';
import { addDays, projectionForRange } from '@roman-mik/kapa-core/horizon';
import { zonedDateKey } from '@roman-mik/kapa-core/pocket';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { useSpaceStore } from '@/stores/space';
import { supabase } from '@/lib/supabase';

/** Equal date ranges share one projection. */
export function useHorizonProjection(dayOffset: () => number) {
  const space = useSpaceStore();
  const range = computed(() => {
    const current = space.currentSpace;
    if (!current) return null;
    const from = zonedDateKey(new Date(), current.timezone);
    return { from, to: addDays(from, dayOffset()), timeZone: current.timezone };
  });
  return useSpaceQuery({
    resource: 'projection',
    staleTimeMs: 30_000,
    params: () => [range.value?.from, range.value?.to, range.value?.timeZone],
    load: ({ spaceId, params }) => {
      const [from, to, timeZone] = params as [string, string, string];
      return projectionForRange(supabase, spaceId, {
        now: new Date(),
        timeZone,
        range: { from, to },
      });
    },
  });
}
