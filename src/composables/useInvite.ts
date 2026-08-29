import type { SpaceInvite } from '@roman-mik/kapa-core/core';
import { mintInvite } from '@roman-mik/kapa-core/core';
import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';

// Mint-on-demand invite for the current space. kapa-core reuses the space's
// outstanding live invite if one exists (DB unique index on space_id where
// redeemed_at is null), otherwise it mints a new 10-char Crockford code with
// a 24h expiry. Core 1.3.0 has no list/revoke helpers, so there's no
// fetch-on-mount — the view mints when the user asks.
export function useInvite() {
  const space = useSpaceStore();
  const session = useSessionStore();
  const invite = ref<SpaceInvite | null>(null);
  const busy = ref(false);
  const error = ref<string | null>(null);

  async function mint(): Promise<void> {
    const spaceId = space.currentSpaceId;
    const userId = session.user?.id;
    if (!spaceId || !userId) return;

    busy.value = true;
    error.value = null;
    try {
      invite.value = await mintInvite(supabase, spaceId, userId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't generate invite code.";
    } finally {
      busy.value = false;
    }
  }

  return { invite, busy, error, mint };
}
