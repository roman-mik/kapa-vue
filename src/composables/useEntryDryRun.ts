// Feeds the entry sheet's live "leaves X today · low point unchanged" line.
// `loadBaseline` gets a real `ProjectionInput` via the shared fetch-assembly
// helper (kapa-core has no exported "give me a `ProjectionInput`" helper, so
// the glue lives kapa-vue-side — see `loadProjectionIngredients`). `preview`
// is synchronous and cheap: `buildProjection` is pure.

import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';
import {
  diffEffect,
  spliceDraft,
  type DraftEntry,
  type DryRunEffect,
  type DryRunIngredients,
} from '@/lib/horizon/dryRunProjection';
import { loadProjectionIngredients } from '@/lib/horizon/loadProjectionIngredients';

const DEFAULT_HORIZON_DAYS = 90;

export function useEntryDryRun() {
  const ingredients = ref<DryRunIngredients | null>(null);
  const loading = ref(false);
  const effect = ref<DryRunEffect | null>(null);

  async function loadBaseline(): Promise<void> {
    const currentSpace = useSpaceStore().currentSpace;
    if (!currentSpace) {
      ingredients.value = null;
      effect.value = null;
      return;
    }
    loading.value = true;
    try {
      const { input } = await loadProjectionIngredients(
        supabase,
        currentSpace.id,
        currentSpace.timezone,
        DEFAULT_HORIZON_DAYS
      );
      ingredients.value = input;
    } finally {
      loading.value = false;
    }
  }

  function preview(draft: DraftEntry | null): void {
    if (!ingredients.value || !draft) {
      effect.value = null;
      return;
    }
    effect.value = diffEffect(ingredients.value, spliceDraft(ingredients.value, draft));
  }

  return { loading, ingredients, effect, loadBaseline, preview };
}
