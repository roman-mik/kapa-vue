import {
  convertMinor,
  findRate,
  zonedDateKey,
  type Currency,
  type FxRate,
} from '@roman-mik/kapa-core/pocket';
import { daysBetween } from '@roman-mik/kapa-core/horizon';
import { listFxRates } from '@roman-mik/kapa-core/core';
import { computed, ref, watch, type Ref } from 'vue';
import { supabase } from '@/lib/supabase';
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

  const rates = ref<FxRate[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const timeZone = computed(() => space.currentSpace?.timezone);

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
      error.value = err instanceof Error ? err.message : "Couldn't load exchange rates.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  const isForeign = (item: Convertible): boolean => item.currency !== spaceCurrency.value;

  /**
   * The covering `FxRate` for `item` (rate + `rateDate` for display), or null
   * when the item is already in the space currency or no covering rate exists.
   * Returns the same stored `FxRate` `convertToCurrency` uses, so a caller can
   * render the rate and its snapshot date truthfully (`€1.015 @ 117,2`).
   */
  function rateFor(item: Convertible): FxRate | null {
    const tz = timeZone.value;
    if (!tz || item.currency === spaceCurrency.value) return null;
    const asOf = item.asOfDate ?? zonedDateKey(new Date(), tz);
    return findRate(rates.value, item.currency, spaceCurrency.value, asOf) ?? null;
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
    rates,
    loading,
    error,
    isForeign,
    rateFor,
    fxAsOf,
    convertedMinor,
    spaceCurrencyAmount,
    unconvertible,
  };
}
