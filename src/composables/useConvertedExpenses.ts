import {
  convertToCurrency,
  zonedDateKey,
  type Currency,
  type FxRate,
} from '@roman-mik/kapa-core/pocket';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import { computed, type Ref } from 'vue';
import { useSpaceStore } from '@/stores/space';

/**
 * Space-currency equivalents for a list of expenses. HistoryView shows each
 * row's original amount; this composable supplies the "≈ converted" figure
 * next to it, converting through kapa-core's fx module. No arithmetic
 * happens here beyond delegating to `convertToCurrency` — same rule as
 * usePocketHome: every figure traces to a kapa-core function.
 *
 * `rates` is passed in rather than fetched here — callers already have a
 * `usePocketHome()` in scope (History and Home both do) which fetches the
 * identical `core.fx_rates` snapshot; fetching it a second time here would
 * just duplicate the request. Pass `usePocketHome().rates`.
 *
 * A row whose currency already equals the space currency converts for free
 * (null, nothing to display); a foreign-currency row with no covering rate
 * is reported via `unconvertible` rather than silently dropped.
 */
export function useConvertedExpenses(expenses: Ref<ExpenseView[]>, rates: Ref<FxRate[]>) {
  const space = useSpaceStore();

  const spaceCurrency = computed(() => (space.currentSpace?.currency ?? 'RSD') as Currency);

  // Computed once per (expenses, rates, spaceCurrency) change rather than a
  // plain function re-run on every template access — HistoryView reads a
  // row's converted amount up to 3 times per render.
  const convertedById = computed<Map<string, number | null>>(() => {
    const map = new Map<string, number | null>();
    const timeZone = space.currentSpace?.timezone;
    for (const row of expenses.value) {
      const id = row.id ?? '';
      const from = (row.currency ?? 'RSD') as Currency;
      if (from === spaceCurrency.value || !timeZone) {
        map.set(id, null);
        continue;
      }
      // Convert at the rate in effect on the day the expense was spent —
      // kapa-core picks the latest snapshot on or before that date.
      const asOfDate = row.spent_at
        ? zonedDateKey(new Date(row.spent_at), timeZone)
        : zonedDateKey(new Date(), timeZone);
      map.set(
        id,
        convertToCurrency(
          row.amount_minor ?? 0,
          from,
          spaceCurrency.value,
          asOfDate,
          rates.value
        ) ?? null
      );
    }
    return map;
  });

  /**
   * The row's amount in the space currency, or null when there is nothing
   * to show: either the row is already in the space currency, or no rate
   * covers the pair (`unconvertible` distinguishes the two cases).
   */
  function convertedMinor(row: ExpenseView): number | null {
    return convertedById.value.get(row.id ?? '') ?? null;
  }

  const isForeign = (row: ExpenseView): boolean =>
    ((row.currency ?? 'RSD') as Currency) !== spaceCurrency.value;

  const unconvertible = computed<ExpenseView[]>(() =>
    expenses.value.filter((row) => isForeign(row) && convertedMinor(row) === null)
  );

  return {
    spaceCurrency,
    isForeign,
    convertedMinor,
    unconvertible,
  };
}
