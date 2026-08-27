import type { Category } from "@roman-mik/kapa-core/core";
import {
  addCategory,
  archiveCategory,
  listCategories,
  renameCategory,
  restoreCategory,
} from "@roman-mik/kapa-core/core";
import { ref, watch } from "vue";
import { supabase } from "@/lib/supabase";
import { useSpaceStore } from "@/stores/space";

// No arithmetic — CRUD over core.categories via kapa-core's query layer only.
export function useCategories(options: { includeArchived?: boolean } = {}) {
  const space = useSpaceStore();
  const categories = ref<Category[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) {
      categories.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      categories.value = await listCategories(supabase, spaceId, options);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load categories.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  async function add(name: string, icon?: string | null): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    await addCategory(supabase, spaceId, name, icon);
    await refresh();
  }

  async function rename(categoryId: string, name: string): Promise<void> {
    await renameCategory(supabase, categoryId, name);
    await refresh();
  }

  async function archive(categoryId: string): Promise<void> {
    await archiveCategory(supabase, categoryId);
    await refresh();
  }

  async function restore(categoryId: string): Promise<void> {
    await restoreCategory(supabase, categoryId);
    await refresh();
  }

  return { categories, loading, error, refresh, add, rename, archive, restore };
}
