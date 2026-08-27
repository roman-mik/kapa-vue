import type { SpaceMember } from "@roman-mik/kapa-core/core";
import { listSpaceMembers } from "@roman-mik/kapa-core/core";
import { ref, watch } from "vue";
import { supabase } from "@/lib/supabase";
import { useSpaceStore } from "@/stores/space";

// Feeds pocket/attribution.ts's attributionLabel on the history screen —
// resolves "who added this expense" for the current space's members.
export function useSpaceMembers() {
  const space = useSpaceStore();
  const members = ref<SpaceMember[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) {
      members.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      members.value = await listSpaceMembers(supabase, spaceId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load space members.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  return { members, loading, error, refresh };
}
