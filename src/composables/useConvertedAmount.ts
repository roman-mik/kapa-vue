import {
  convertToCurrency,
  zonedDateKey,
  type Currency,
  type FxRate,
} from '@roman-mik/kapa-core/pocket';
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

  const convertedById = computed<Map<string, number | null>>(() => {
    const map = new Map<string, number | null>();
    const tz = timeZone.value;
    for (const item of items.value) {
      if (item.currency === spaceCurrency.value || !tz) {
        map.set(item.id, null);
        continue;
      }
      const asOf = item.asOfDate ?? zonedDateKey(new Date(), tz);
      map.set(
        item.id,
        convertToCurrency(
          item.amountMinor,
          item.currency,
          spaceCurrency.value,
          asOf,
          rates.value
        ) ?? null
      );
    }
    return map;
  });

  const isForeign = (item: Convertible): boolean => item.currency !== spaceCurrency.value;

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
    convertedMinor,
    spaceCurrencyAmount,
    unconvertible,
  };
}
