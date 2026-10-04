import { useHorizonClock } from './useHorizonClock';
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
import { mutationVersion } from '@/lib/serverState/invalidation';
import { useSessionStore } from '@/stores/session';
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
  const clock = useHorizonClock();
  const loading = ref(false);
  let generation = 0;
  const eventOrderSentence = ref<string | null>(null);
  const spendModeSentence = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const request = ++generation;
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
      const { input, settings, unconverted } = await loadProjectionIngredients(
        supabase,
        currentSpace.id,
        currentSpace.timezone,
        HORIZON_DAYS
      );
      const currency = input.reportingCurrency;
      if (request !== generation || currentSpace.id !== space.currentSpaceId) return;
      const baselineResult = buildProjection(input);
      const baseline = baselineResult.value;
      if (
        baseline.lifecycleIssues?.length ||
        unconverted.length ||
        baselineResult.unconverted.length
      )
        return;
      const baselineDays = baseline.days;

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
      if (request !== generation || currentSpace.id !== space.currentSpaceId) return;
      const alternativeResult = buildProjection(altInput);
      const alternative = alternativeResult.value;
      if (
        alternative.lifecycleIssues?.length ||
        altForward.unconverted.length ||
        alternativeResult.unconverted.length
      ) {
        eventOrderSentence.value = null;
        return;
      }
      const altDays = alternative.days;
      const capDays = settings.spend_mode === 'cap' ? baselineDays : altDays;
      const runRateDays = settings.spend_mode === 'runRate' ? baselineDays : altDays;
      spendModeSentence.value = compareScenarios(
        { label: 'Cap', days: capDays },
        { label: 'Run rate', days: runRateDays },
        currency
      );
    } catch {
      if (request === generation) {
        eventOrderSentence.value = null;
        spendModeSentence.value = null;
      }
    } finally {
      if (request === generation) loading.value = false;
    }
  }

  watch([() => space.currentSpaceId, clock.today], refresh, { immediate: true });

  watch(
    () => mutationVersion(useSessionStore().user?.id ?? '', space.currentSpaceId ?? ''),
    () => void refresh()
  );

  return { loading, eventOrderSentence, spendModeSentence, refresh };
}
