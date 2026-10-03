import type { SpaceMember } from '@roman-mik/kapa-core/core';
import { listSpaceMembers } from '@roman-mik/kapa-core/core';
import { computed } from 'vue';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { supabase } from '@/lib/supabase';

// Feeds pocket/attribution.ts's attributionLabel on the history screen —
// resolves "who added this expense" for the current space's members.
export function useSpaceMembers() {
  const query = useSpaceQuery<SpaceMember[]>({
    resource: 'spaceMembers',
    staleTimeMs: 30_000,
    load: ({ spaceId }) => listSpaceMembers(supabase, spaceId),
  });

  return {
    members: computed(() => query.data.value ?? []),
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
  };
}
