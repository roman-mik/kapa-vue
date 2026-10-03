import type { Cap } from '@roman-mik/kapa-core/pocket/queries';
import { getCap, upsertCap } from '@roman-mik/kapa-core/pocket/queries';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

export interface SetCapInput {
  monthlyCapMinor: number;
  nudgeEnabled: boolean;
  nudgePct: number;
}

// No arithmetic here — this composable only fetches/writes pocket.caps via
// kapa-core's query layer. Deriving spend/pace/projection figures from the
// cap belongs to usePocketHome.
export function useCap() {
  const query = useSpaceQuery<Cap | null>({
    resource: 'cap',
    staleTimeMs: 30_000,
    load: ({ spaceId }) => getCap(supabase, spaceId),
  });

  async function setCap(input: SetCapInput): Promise<void> {
    const invalidate = query.invalidate;
    const spaceId = useSpaceStore().currentSpaceId;
    if (!spaceId) return;
    await upsertCap(supabase, {
      space_id: spaceId,
      monthly_cap_minor: input.monthlyCapMinor,
      nudge_enabled: input.nudgeEnabled,
      nudge_pct: input.nudgePct,
    });
    await invalidate();
  }

  return {
    cap: computed(() => query.data.value ?? null),
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    setCap,
  };
}
