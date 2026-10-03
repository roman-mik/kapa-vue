import type { Category } from '@roman-mik/kapa-core/core';
import {
  addCategory,
  archiveCategory,
  listCategories,
  renameCategory,
  restoreCategory,
  setCategoryColor,
} from '@roman-mik/kapa-core/core';
import type { SwatchSlot } from '@roman-mik/kapa-core/theme';
import { computed } from 'vue';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

// No arithmetic — CRUD over core.categories via kapa-core's query layer only.
export function useCategories(options: { includeArchived?: boolean } = {}) {
  const query = useSpaceQuery<Category[]>({
    resource: 'categories',
    staleTimeMs: 30_000,
    params: () => [options.includeArchived ?? false],
    load: ({ spaceId }) => listCategories(supabase, spaceId, options),
  });
  const categories = computed(() => query.data.value ?? []);

  async function add(name: string, icon?: string | null): Promise<void> {
    const invalidate = query.invalidate;
    const spaceId = useSpaceStore().currentSpaceId;
    if (!spaceId) return;
    await addCategory(supabase, spaceId, name, icon);
    await invalidate();
  }

  async function rename(categoryId: string, name: string): Promise<void> {
    const invalidate = query.invalidate;
    await renameCategory(supabase, categoryId, name);
    await invalidate();
  }

  async function archive(categoryId: string): Promise<void> {
    const invalidate = query.invalidate;
    await archiveCategory(supabase, categoryId);
    await invalidate();
  }

  async function restore(categoryId: string): Promise<void> {
    const invalidate = query.invalidate;
    await restoreCategory(supabase, categoryId);
    await invalidate();
  }

  // Slot validity is enforced by the SwatchSlot type plus the DB check
  // constraint; null clears the assignment.
  async function setColor(categoryId: string, color: SwatchSlot | null): Promise<void> {
    const invalidate = query.invalidate;
    await setCategoryColor(supabase, categoryId, color);
    await invalidate();
  }

  return {
    categories,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    add,
    rename,
    archive,
    restore,
    setColor,
  };
}
