import { setSpendMode, type SpendMode } from '@roman-mik/kapa-core/horizon/queries';
import { computed, ref } from 'vue';
import { useHorizonSettingsResource } from '@/composables/useHorizonSettingsResource';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';
import { useSessionStore } from '@/stores/session';
import { queryCache } from '@/lib/serverState/queryCache';

/**
 * The active space's forward-spend mode (H14 cap vs H15 run-rate). Reads via
 * the settings query module — a space with no lazily-provisioned settings row
 * reports the DB default, 'cap' — and flips it with an upsert. No UI here:
 * the toggle lands in HorizonSettingsView in H21.
 */
export function useSpendMode() {
  const space = useSpaceStore();
  const query = useHorizonSettingsResource();
  const spendMode = computed<SpendMode>(() => query.data.value?.spend_mode ?? 'cap');
  const saveError = ref<string | null>(null);
  const error = computed(() => saveError.value ?? query.error.value);

  async function setMode(mode: SpendMode): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) return;
    saveError.value = null;
    try {
      await setSpendMode(supabase, currentSpace.id, mode);
      if (space.currentSpaceId === currentSpace.id && query.data.value) {
        query.setData((data) => ({ ...data!, spend_mode: mode }));
      }
      const userId = useSessionStore().user?.id;
      if (userId) await queryCache.invalidate([userId, currentSpace.id, 'projection']);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't save spend mode.";
      await query.refresh();
      saveError.value = message;
    }
  }

  return { spendMode, loading: query.loading, error, setMode };
}
