import type { FxRate, PocketHomeView } from "@roman-mik/kapa-core/pocket";
import {
  categoryBreakdown,
  completedDays,
  type Currency,
  daysInMonth,
  daysLeft,
  elapsedDays,
  currentMonth,
  evenPace,
  type ExpenseAmount,
  monthWindow,
  overspend,
  paceGap,
  pocketHomeView,
  projection,
  remaining,
  safeDaily,
  spentPct,
  spentTotal,
  zonedDateKey,
} from "@roman-mik/kapa-core/pocket";
import { listExpensesInRange } from "@roman-mik/kapa-core/pocket/queries";
import { listFxRates } from "@roman-mik/kapa-core/core";
import { computed, ref, watch } from "vue";
import { supabase } from "@/lib/supabase";
import { useCap } from "@/composables/useCap";
import { useSpaceStore } from "@/stores/space";
import type { ExpenseView } from "@roman-mik/kapa-core/pocket/queries";

export interface PocketSummary {
  month: string;
  currency: Currency;
  spent: number;
  remaining: number;
  safeDaily: number;
  paceGap: number;
  projection: number;
  spentPct: number;
  overspend: number;
  categoryBreakdown: { categoryId: string | null; spent: number }[];
  home: PocketHomeView;
}

function toExpenseAmount(row: ExpenseView): ExpenseAmount {
  return {
    categoryId: row.category_id,
    amountMinor: row.amount_minor ?? 0,
    currency: (row.currency ?? "RSD") as Currency,
    spentAt: row.spent_at ?? new Date().toISOString(),
  };
}

/**
 * The home screen's derived figures — every number here traces to a
 * kapa-core function. This composable only fetches (month-scoped expenses,
 * fx rates, the cap) and hands the raw rows to kapa-core's Pocket module;
 * it never computes a figure itself.
 */
export function usePocketHome() {
  const space = useSpaceStore();
  const cap = useCap();

  const expenses = ref<ExpenseView[]>([]);
  const rates = ref<FxRate[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      expenses.value = [];
      rates.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const timeZone = currentSpace.timezone;
      const month = currentMonth(new Date(), timeZone);
      const { startUtc, endUtc } = monthWindow(month, timeZone);
      const onOrBefore = zonedDateKey(new Date(), timeZone);
      const [expenseRows, rateRows] = await Promise.all([
        listExpensesInRange(supabase, currentSpace.id, startUtc, endUtc),
        listFxRates(supabase, onOrBefore),
      ]);
      expenses.value = expenseRows;
      rates.value = rateRows.map((r) => ({
        baseCurrency: r.base_currency as Currency,
        quoteCurrency: r.quote_currency as Currency,
        rateE8: r.rate_e8,
        rateDate: r.rate_date,
      }));
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load this month's data.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  const summary = computed<PocketSummary | null>(() => {
    const currentSpace = space.currentSpace;
    if (!currentSpace) return null;

    const timeZone = currentSpace.timezone;
    const spaceCurrency = currentSpace.currency as Currency;
    const month = currentMonth(new Date(), timeZone);
    const D = daysInMonth(month);
    const dl = daysLeft(month, new Date(), timeZone);
    const elapsed = elapsedDays(D, dl);
    const completed = completedDays(D, dl);

    const amounts = expenses.value.map(toExpenseAmount);
    const spentResult = spentTotal(amounts, timeZone, spaceCurrency, rates.value);
    const spent = spentResult.value;

    const capMinor = cap.cap.value?.monthly_cap_minor ?? 0;
    const remainingValue = remaining(capMinor, spent);
    const evenPaceValue = evenPace(capMinor, completed, D);
    const overspendValue = overspend(capMinor, spent);
    const spentPctValue = spentPct(spent, capMinor);

    const home = pocketHomeView({
      cap: capMinor,
      overspend: overspendValue,
      spentPct: spentPctValue,
      nudgeEnabled: cap.cap.value?.nudge_enabled ?? false,
      nudgePct: cap.cap.value?.nudge_pct ?? 0,
      completedDays: completed,
      elapsedDays: elapsed,
    });

    return {
      month,
      currency: spaceCurrency,
      spent,
      remaining: remainingValue,
      safeDaily: safeDaily(remainingValue, dl),
      paceGap: paceGap(evenPaceValue, spent),
      projection: projection(spent, elapsed, D),
      spentPct: spentPctValue,
      overspend: overspendValue,
      categoryBreakdown: categoryBreakdown(amounts, timeZone, spaceCurrency, rates.value).value,
      home,
    };
  });

  return {
    cap,
    summary,
    loading: computed(() => loading.value || cap.loading.value),
    error,
    refresh: async () => {
      await Promise.all([refresh(), cap.refresh()]);
    },
  };
}
