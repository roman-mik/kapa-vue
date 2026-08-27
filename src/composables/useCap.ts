import type { Cap } from "@roman-mik/kapa-core/pocket/queries";
import { getCap, upsertCap } from "@roman-mik/kapa-core/pocket/queries";
import { ref, watch } from "vue";
import { supabase } from "@/lib/supabase";
import { useSpaceStore } from "@/stores/space";

export interface SetCapInput {
  monthlyCapMinor: number;
  nudgeEnabled: boolean;
  nudgePct: number;
}

// No arithmetic here — this composable only fetches/writes pocket.caps via
// kapa-core's query layer. Deriving spend/pace/projection figures from the
// cap belongs to usePocketHome.
export function useCap() {
  const space = useSpaceStore();
  const cap = ref<Cap | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) {
      cap.value = null;
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      cap.value = await getCap(supabase, spaceId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load the cap.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  async function setCap(input: SetCapInput): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    await upsertCap(supabase, {
      space_id: spaceId,
      monthly_cap_minor: input.monthlyCapMinor,
      nudge_enabled: input.nudgeEnabled,
      nudge_pct: input.nudgePct,
    });
    await refresh();
  }

  return { cap, loading, error, refresh, setCap };
}
