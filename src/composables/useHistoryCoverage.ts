import { computed, ref, watch } from 'vue';
import { getHistoryCoverage, saveHistoryCoverage } from '@roman-mik/kapa-core/horizon/queries';
import { trailingBurnWindow } from '@roman-mik/kapa-core/horizon';
import { useSpaceQuery } from './useSpaceQuery';
import { useHorizonClock } from './useHorizonClock';
import { useSpaceStore } from '@/stores/space';
import { useSessionStore } from '@/stores/session';
import { invalidateResources } from '@/lib/serverState/invalidation';
import { supabase } from '@/lib/supabase';
export function useHistoryCoverage() {
  const clock = useHorizonClock();
  const space = useSpaceStore();
  const session = useSessionStore();
  const query = useSpaceQuery({
    resource: 'historyCoverage',
    staleTimeMs: 30_000,
    load: ({ spaceId }) => getHistoryCoverage(supabase, spaceId),
  });
  const saving = ref(false);
  const saveError = ref<string | null>(null);
  watch(
    () => space.currentSpaceId,
    () => {
      saveError.value = null;
    }
  );
  const window = computed(() => trailingBurnWindow(clock.today.value));
  async function save(from: string, through: string) {
    if (saving.value) return false;
    const spaceId = space.currentSpaceId;
    const userId = session.user?.id;
    if (!spaceId || !userId) return false;
    saving.value = true;
    saveError.value = null;
    try {
      const result = await saveHistoryCoverage(supabase, spaceId, {
        revision: query.data.value?.revision ?? 0,
        from,
        through,
      });
      if (space.currentSpaceId === spaceId && session.user?.id === userId)
        query.setData(() => result);
      await invalidateResources(userId, spaceId, 'historyCoverage');
      if (space.currentSpaceId === spaceId && session.user?.id === userId && query.error.value)
        saveError.value = 'Review saved. Refresh failed; retry loading the forecast.';
      return true;
    } catch (e) {
      if (space.currentSpaceId === spaceId && session.user?.id === userId)
        saveError.value =
          e instanceof Error
            ? e.message
            : typeof e === 'object' && e && 'message' in e
              ? String(e.message)
              : 'Could not save the history review.';
      return false;
    } finally {
      saving.value = false;
    }
  }
  return {
    review: query.data,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    window,
    today: clock.today,
    saving,
    saveError,
    save,
  };
}
