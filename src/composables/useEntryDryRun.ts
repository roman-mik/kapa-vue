import { buildProjection } from '@roman-mik/kapa-core/horizon';
import { computed, ref, watch } from 'vue';
import type { Currency, CurrencyBucket } from '@roman-mik/kapa-core/pocket';
import { mutationVersion } from '@/lib/serverState/invalidation';
import { useSessionStore } from '@/stores/session';
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

export function useEntryDryRun() {
  const space = useSpaceStore();
  const ingredients = ref<DryRunIngredients | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const effect = ref<DryRunEffect | null>(null);
  const baselineIssues = ref<CurrencyBucket[]>([]);
  const adapterIssues = ref<CurrencyBucket[]>([]);
  let generation = 0;
  let draft: DraftEntry | null = null;

  // Adapter omissions cover Pocket inputs; engine omissions cover accounts/events.
  // Use only the with-draft engine result (it already includes the baseline),
  // matching the live pipeline without counting baseline omissions twice.
  const conversionIssues = computed(() => {
    const buckets = [
      ...adapterIssues.value,
      ...(effect.value?.unconverted ?? baselineIssues.value),
    ];
    const amounts = new Map<Currency, number>();
    for (const bucket of buckets)
      amounts.set(bucket.currency, (amounts.get(bucket.currency) ?? 0) + bucket.amountMinor);
    return [...amounts].map(([currency, amountMinor]) => ({ currency, amountMinor }));
  });
  const reportingCurrency = computed<Currency>(
    () =>
      ingredients.value?.reportingCurrency ?? (space.currentSpace?.currency as Currency) ?? 'RSD'
  );

  function preview(next: DraftEntry | null): void {
    draft = next;
    effect.value =
      ingredients.value && draft && !loading.value && !error.value
        ? diffEffect(ingredients.value, spliceDraft(ingredients.value, draft))
        : null;
  }

  watch(
    () => space.currentSpaceId,
    () => {
      generation++;
      ingredients.value = null;
      effect.value = null;
      adapterIssues.value = [];
      baselineIssues.value = [];
      loading.value = false;
      error.value = null;
      draft = null;
    },
    { flush: 'sync' }
  );

  async function loadBaseline(): Promise<void> {
    const current = space.currentSpace;
    const request = ++generation;
    ingredients.value = null;
    effect.value = null;
    adapterIssues.value = [];
    baselineIssues.value = [];
    error.value = null;
    if (!current) return;
    loading.value = true;
    try {
      const result = await loadProjectionIngredients(supabase, current.id, current.timezone, 90);
      if (request !== generation || current.id !== space.currentSpaceId) return;
      ingredients.value = result.input;
      adapterIssues.value = result.unconverted;
      baselineIssues.value = buildProjection(result.input).unconverted;
    } catch (err) {
      if (request === generation)
        error.value = err instanceof Error ? err.message : 'Forecast could not be loaded.';
    } finally {
      if (request === generation) {
        loading.value = false;
        preview(draft);
      }
    }
  }

  watch(
    () => mutationVersion(useSessionStore().user?.id ?? '', space.currentSpaceId ?? ''),
    () => {
      if (ingredients.value) void loadBaseline();
    }
  );

  return {
    loading,
    error,
    ingredients,
    effect,
    lifecycleIssues: computed(
      () =>
        effect.value?.lifecycleIssues ??
        (ingredients.value ? (buildProjection(ingredients.value).value.lifecycleIssues ?? []) : [])
    ),
    conversionIssues,
    reportingCurrency,
    loadBaseline,
    preview,
  };
}
