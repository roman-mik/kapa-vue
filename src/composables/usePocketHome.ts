import type { CurrencyBucket, FxRate, PocketHomeView } from '@roman-mik/kapa-core/pocket';
import {
  categoryBreakdown,
  completedDays,
  type Currency,
  dailyTotals,
  daysInMonth,
  daysLeft,
  elapsedDays,
  currentMonth,
  evenPace,
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
} from '@roman-mik/kapa-core/pocket';
import { listExpensesInRange } from '@roman-mik/kapa-core/pocket/queries';
import { listFxRates } from '@roman-mik/kapa-core/core';
import { computed, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useCap } from '@/composables/useCap';
import { useSpaceStore } from '@/stores/space';
import { toExpenseAmount } from '@/lib/expenseAmount';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';

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
  dailyTotals: { dateKey: string; amountMinor: number }[];
  dailyCapReference: number;
  unconverted: CurrencyBucket[];
  todayExpenses: ExpenseView[];
  daysUntilReset: number;
  home: PocketHomeView;
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
    // Before the cap has loaded at least once, cap.cap.value is null the
    // same way "no cap configured" is — without this guard, the home
    // screen would flash a "no cap set" state on every load, even for
    // spaces that do have one, until the real cap arrives.
    if (cap.loading.value && cap.cap.value === null) return null;

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

    const todayKey = zonedDateKey(new Date(), timeZone);
    const todayExpenses = expenses.value.filter(
      (e) => e.spent_at !== null && zonedDateKey(new Date(e.spent_at), timeZone) === todayKey
    );

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
      dailyTotals: dailyTotals(amounts, month, timeZone, spaceCurrency, rates.value).value,
      dailyCapReference: Math.floor(capMinor / D),
      unconverted: spentResult.unconverted,
      todayExpenses,
      daysUntilReset: dl,
      home,
    };
  });

  return {
    cap,
    summary,
    rates,
    loading: computed(() => loading.value || cap.loading.value),
    error,
    refresh: async () => {
      await Promise.all([refresh(), cap.refresh()]);
    },
  };
}
