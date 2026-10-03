import {
  convertMinor,
  findRate,
  zonedDateKey,
  type Currency,
  type FxRate,
} from '@roman-mik/kapa-core/pocket';
import { daysBetween } from '@roman-mik/kapa-core/horizon';
import { computed, type Ref } from 'vue';
import { useFxRates } from '@/composables/useFxRates';
import { useSpaceStore } from '@/stores/space';

/**
 * An item whose amount can be shown in the space currency — an account
 * balance, an income stream, an obligation. `asOfDate` prices the conversion
 * at that 'YYYY-MM-DD' (a current balance prices as-of today, a scheduled
 * amount as-of its payment date); it defaults to today in the space's zone.
 */
export interface Convertible {
  id: string;
  currency: Currency;
  amountMinor: number;
  asOfDate?: string;
}

/**
 * Space-currency equivalents for any list of amounts, in the same spirit as
 * `useConvertedExpenses` but not expense-shaped: it works over `Convertible`
 * items (accounts, streams, obligations) and fetches `core.fx_rates` itself.
 *
 * Every figure traces to a kapa-core function (`listFxRates` +
 * `convertToCurrency`); no arithmetic happens here. The existing
 * `useConvertedExpenses` could be rewritten on top of this later — it's left
 * as-is to keep Pocket's behavior unchanged.
 *
 * `convertedMinor` returns null when there's nothing extra to display: either
 * the item is already in the space currency, or no covering rate exists
 * (`unconvertible` separates the two). For a *total* that must actually sum
 * amounts, use `spaceCurrencyAmount`, which returns the real space-currency
 * figure (or null when unconvertible), never silently zero.
 */
export function useConvertedAmount(items: Ref<Convertible[]>) {
  const space = useSpaceStore();

  const spaceCurrency = computed(() => (space.currentSpace?.currency ?? 'RSD') as Currency);

  const fxRates = useFxRates();

  const timeZone = computed(() => space.currentSpace?.timezone);

  const rates = fxRates.rates;
  const isForeign = (item: Convertible): boolean => item.currency !== spaceCurrency.value;
  function rateFor(item: Convertible): FxRate | null {
    const tz = timeZone.value;
    if (!tz || !isForeign(item)) return null;
    return (
      findRate(
        rates.value,
        item.currency,
        spaceCurrency.value,
        item.asOfDate ?? zonedDateKey(new Date(), tz)
      ) ?? null
    );
  }

  const convertedById = computed<Map<string, number | null>>(() => {
    const map = new Map<string, number | null>();
    for (const item of items.value) {
      const rate = rateFor(item);
      if (!rate) {
        map.set(item.id, null);
        continue;
      }
      map.set(item.id, convertMinor(item.amountMinor, item.currency, spaceCurrency.value, rate));
    }
    return map;
  });

  /**
   * The newest snapshot across all loaded rates, with its age in whole days —
   * for the "FX as of 29 Aug · 2 days old" surfaces. null when no rates are
   * loaded. Age is computed from the rate's `rateDate` against today in the
   * space's zone (UTC-anchored, never negative).
   */
  function fxAsOf(): { date: string; ageDays: number } | null {
    if (rates.value.length === 0) return null;
    let newest = rates.value[0];
    for (const rate of rates.value) {
      if (rate.rateDate > newest.rateDate) newest = rate;
    }
    const tz = timeZone.value;
    const today = tz ? zonedDateKey(new Date(), tz) : zonedDateKey(new Date(), 'UTC');
    const age = daysBetween(newest.rateDate, today);
    return { date: newest.rateDate, ageDays: Math.max(0, age) };
  }

  /** The ≈converted figure to show beside a native amount, or null. */
  function convertedMinor(item: Convertible): number | null {
    return convertedById.value.get(item.id) ?? null;
  }

  /** The item's amount in the space currency, or null when unconvertible. */
  function spaceCurrencyAmount(item: Convertible): number | null {
    if (item.currency === spaceCurrency.value) return item.amountMinor;
    return convertedMinor(item);
  }

  const unconvertible = computed<Convertible[]>(() =>
    items.value.filter((item) => isForeign(item) && convertedMinor(item) === null)
  );

  return {
    spaceCurrency,
    rates: fxRates.rates,
    loading: fxRates.loading,
    error: fxRates.error,
    refresh: fxRates.refresh,
    isForeign,
    rateFor,
    fxAsOf,
    convertedMinor,
    spaceCurrencyAmount,
    unconvertible,
  };
}
