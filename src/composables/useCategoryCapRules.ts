import { computed } from 'vue';
import {
  categoryCountsTowardCap,
  listCategoryCapRules,
  setCategoryCapRule,
  type CategoryCapRule,
} from '@roman-mik/kapa-core/pocket/queries';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { useSpaceStore } from '@/stores/space';
import { supabase } from '@/lib/supabase';

export function useCategoryCapRules() {
  const query = useSpaceQuery<CategoryCapRule[]>({
    resource: 'categoryCapRules',
    staleTimeMs: 30_000,
    load: ({ spaceId }) => listCategoryCapRules(supabase, spaceId),
  });
  const rules = computed(() => query.data.value ?? []);
  async function setDefault(categoryId: string, counts: boolean): Promise<void> {
    const spaceId = useSpaceStore().currentSpaceId;
    const invalidate = query.invalidate;
    if (!spaceId) throw new Error('Select a space before changing category defaults.');
    await setCategoryCapRule(supabase, spaceId, categoryId, counts);
    await invalidate();
  }
  return {
    countsTowardCap: (categoryId: string | null) =>
      categoryCountsTowardCap(rules.value, categoryId),
    setDefault,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
  };
}
