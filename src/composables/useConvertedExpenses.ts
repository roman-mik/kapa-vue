import {
  convertToCurrency,
  zonedDateKey,
  type Currency,
  type FxRate,
} from '@roman-mik/kapa-core/pocket';
import { listFxRates } from '@roman-mik/kapa-core/core';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import { computed, ref, watch, type Ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

/**
 * Space-currency equivalents for a list of expenses. HistoryView shows each
 * row's original amount; this composable supplies the "≈ converted" figure
 * next to it, converting through kapa-core's fx module against the same
 * `core.fx_rates` snapshots the home screen uses. No arithmetic happens
 * here beyond delegating to `convertToCurrency` — same rule as
 * usePocketHome: every figure traces to a kapa-core function.
 *
 * A row whose currency already equals the space currency converts for free
 * (null, nothing to display); a foreign-currency row with no covering rate
 * is reported via `unconvertible` rather than silently dropped.
 */
export function useConvertedExpenses(expenses: Ref<ExpenseView[]>) {
  const space = useSpaceStore();

  const rates = ref<FxRate[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const spaceCurrency = computed(() => (space.currentSpace?.currency ?? 'RSD') as Currency);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      rates.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const onOrBefore = zonedDateKey(new Date(), currentSpace.timezone);
      const rows = await listFxRates(supabase, onOrBefore);
      rates.value = rows.map((r) => ({
        baseCurrency: r.base_currency as Currency,
        quoteCurrency: r.quote_currency as Currency,
        rateE8: r.rate_e8,
        rateDate: r.rate_date,
      }));
    } catch (err) {
      rates.value = [];
      error.value = err instanceof Error ? err.message : "Couldn't load fx rates.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  /**
   * The row's amount in the space currency, or null when there is nothing
   * to show: either the row is already in the space currency, or no rate
   * covers the pair (`unconvertible` distinguishes the two cases).
   */
  function convertedMinor(row: ExpenseView): number | null {
    const from = (row.currency ?? 'RSD') as Currency;
    if (from === spaceCurrency.value) return null;
    const timeZone = space.currentSpace?.timezone;
    if (!timeZone) return null;
    // Convert at the rate in effect on the day the expense was spent —
    // kapa-core picks the latest snapshot on or before that date.
    const asOfDate = row.spent_at
      ? zonedDateKey(new Date(row.spent_at), timeZone)
      : zonedDateKey(new Date(), timeZone);
    return (
      convertToCurrency(row.amount_minor ?? 0, from, spaceCurrency.value, asOfDate, rates.value) ??
      null
    );
  }

  const isForeign = (row: ExpenseView): boolean =>
    ((row.currency ?? 'RSD') as Currency) !== spaceCurrency.value;

  const unconvertible = computed<ExpenseView[]>(() =>
    expenses.value.filter((row) => isForeign(row) && convertedMinor(row) === null)
  );

  return {
    spaceCurrency,
    rates,
    loading,
    error,
    isForeign,
    convertedMinor,
    unconvertible,
  };
}
