import type { CurrencyBucket, PocketHomeView } from '@roman-mik/kapa-core/pocket';
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
import { computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { useCap } from '@/composables/useCap';
import { useFxRates } from '@/composables/useFxRates';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
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
  const month = computed(() =>
    space.currentSpace ? currentMonth(new Date(), space.currentSpace.timezone) : null
  );
  const expenseQuery = useSpaceQuery<ExpenseView[]>({
    resource: 'pocketExpenses',
    staleTimeMs: 30_000,
    params: () => [month.value, space.currentSpace?.timezone],
    load: ({ spaceId, params }) => {
      const [month, timezone] = params as [string, string];
      const { startUtc, endUtc } = monthWindow(month, timezone);
      return listExpensesInRange(supabase, spaceId, startUtc, endUtc);
    },
  });
  const expenses = computed(() => expenseQuery.data.value ?? []);
  const fxRates = useFxRates();

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
    const spentResult = spentTotal(amounts, timeZone, spaceCurrency, fxRates.rates.value);
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
      categoryBreakdown: categoryBreakdown(amounts, timeZone, spaceCurrency, fxRates.rates.value)
        .value,
      dailyTotals: dailyTotals(amounts, month, timeZone, spaceCurrency, fxRates.rates.value).value,
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
    rates: fxRates.rates,
    loading: computed(
      () => expenseQuery.loading.value || fxRates.loading.value || cap.loading.value
    ),
    error: computed(() => expenseQuery.error.value ?? fxRates.error.value ?? cap.error.value),
    refresh: async () => {
      await Promise.all([expenseQuery.refresh(), fxRates.refresh(), cap.refresh()]);
    },
  };
}
