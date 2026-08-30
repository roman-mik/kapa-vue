import { getSettings, setSpendMode, type SpendMode } from '@roman-mik/kapa-core/horizon/queries';
import { ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

/**
 * The active space's forward-spend mode (H14 cap vs H15 run-rate). Reads via
 * the settings query module — a space with no lazily-provisioned settings row
 * reports the DB default, 'cap' — and flips it with an upsert. No UI here:
 * the toggle lands in HorizonSettingsView in H21.
 */
export function useSpendMode() {
  const space = useSpaceStore();
  const spendMode = ref<SpendMode>('cap');
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      spendMode.value = 'cap';
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const settings = await getSettings(supabase, currentSpace.id);
      spendMode.value = settings.spend_mode;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load spend mode.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  async function setMode(mode: SpendMode): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) return;
    error.value = null;
    try {
      await setSpendMode(supabase, currentSpace.id, mode);
      spendMode.value = mode;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't save spend mode.";
      await refresh();
      error.value = message;
    }
  }

  return { spendMode, loading, error, setMode };
}
