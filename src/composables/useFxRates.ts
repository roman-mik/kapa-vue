import { computed } from 'vue';
import { listFxRates } from '@roman-mik/kapa-core/core';
import { zonedDateKey, type Currency, type FxRate } from '@roman-mik/kapa-core/pocket';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

/** Shared dated FX snapshot for the active space's local day. */
export function useFxRates() {
  const space = useSpaceStore();
  const onOrBefore = computed(() => {
    const currentSpace = space.currentSpace;
    return currentSpace ? zonedDateKey(new Date(), currentSpace.timezone) : null;
  });
  const query = useSpaceQuery<FxRate[]>({
    resource: 'fxRates',
    staleTimeMs: 60 * 60 * 1_000,
    params: () => [onOrBefore.value],
    load: async ({ params }) => {
      const date = params[0] as string | null;
      if (!date) return [];
      const rows = await listFxRates(supabase, date);
      return rows.map((row) => ({
        baseCurrency: row.base_currency as Currency,
        quoteCurrency: row.quote_currency as Currency,
        rateE8: row.rate_e8,
        rateDate: row.rate_date,
      }));
    },
  });

  return {
    rates: computed(() => query.data.value ?? []),
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
  };
}
