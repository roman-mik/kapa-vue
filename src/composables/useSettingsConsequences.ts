// Backs the two "what this does to your projection" sentences on the
// Settings screen (task 14): same-day event order and forward spend mode.
// Both run `buildProjection` twice — once for the current setting, once for
// the alternative — and diff the result via `compareScenarios`. The event
// order swap only needs the already-loaded `ProjectionInput`; the spend-mode
// comparison additionally fetches the *other* mode's forward-spend days,
// since spend mode isn't a `ProjectionInput` field — it's baked into
// `pocketSpend.forward` before `buildProjection` ever runs.

import {
  buildProjection,
  forwardSpendForRange,
  runRateSpendForRange,
  type ProjectionInput,
} from '@roman-mik/kapa-core/horizon';
import type { EventOrder } from '@roman-mik/kapa-core/horizon/queries';
import { ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';
import { loadProjectionIngredients } from '@/lib/horizon/loadProjectionIngredients';
import {
  compareScenarios,
  eventOrderLabel,
  swapIncomeObligation,
} from '@/lib/horizon/settingsConsequences';

const HORIZON_DAYS = 90;

export function useSettingsConsequences() {
  const space = useSpaceStore();
  const loading = ref(false);
  const eventOrderSentence = ref<string | null>(null);
  const spendModeSentence = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      eventOrderSentence.value = null;
      spendModeSentence.value = null;
      return;
    }
    loading.value = true;
    eventOrderSentence.value = null;
    spendModeSentence.value = null;
    try {
      const { input, settings } = await loadProjectionIngredients(
        supabase,
        currentSpace.id,
        currentSpace.timezone,
        HORIZON_DAYS
      );
      const currency = input.reportingCurrency;
      const baselineDays = buildProjection(input).value.days;

      const currentOrder = input.eventOrder as EventOrder;
      const swappedOrder = swapIncomeObligation(currentOrder);
      const swappedDays = buildProjection({ ...input, eventOrder: swappedOrder }).value.days;
      eventOrderSentence.value = compareScenarios(
        { label: eventOrderLabel(currentOrder), days: baselineDays },
        { label: eventOrderLabel(swappedOrder), days: swappedDays },
        currency
      );

      const altForward =
        settings.spend_mode === 'runRate'
          ? await forwardSpendForRange(supabase, currentSpace.id, {
              now: new Date(),
              timeZone: currentSpace.timezone,
              spaceCurrency: currency,
              rates: input.rates,
              from: input.todayKey,
              to: input.range.to,
            })
          : await runRateSpendForRange(supabase, currentSpace.id, {
              now: new Date(),
              timeZone: currentSpace.timezone,
              spaceCurrency: currency,
              rates: input.rates,
              from: input.todayKey,
              to: input.range.to,
            });
      const altInput: ProjectionInput = {
        ...input,
        pocketSpend: { ...input.pocketSpend, forward: altForward.value },
      };
      const altDays = buildProjection(altInput).value.days;
      const capDays = settings.spend_mode === 'cap' ? baselineDays : altDays;
      const runRateDays = settings.spend_mode === 'runRate' ? baselineDays : altDays;
      spendModeSentence.value = compareScenarios(
        { label: 'Cap', days: capDays },
        { label: 'Run rate', days: runRateDays },
        currency
      );
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  return { loading, eventOrderSentence, spendModeSentence, refresh };
}
