import {
  addDays,
  computeMetrics,
  computeNegativeDayWarnings,
  projectionForRange,
  type LedgerEvent,
  type NegativeDayWarning,
} from '@roman-mik/kapa-core/horizon';
import {
  dismissNegativeDay,
  getSettings,
  listProjectionDismissals,
  type ProjectionDismissal,
  type SpendMode,
} from '@roman-mik/kapa-core/horizon/queries';
import { getCap } from '@roman-mik/kapa-core/pocket/queries';
import { zonedDateKey, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { daysUnder } from '@/lib/horizon/daysUnder';
import { globalTrough, type Trough } from '@/lib/horizon/trough';
import { useSpaceStore } from '@/stores/space';

const DEFAULT_HORIZON_DAYS = 90;

/**
 * The single fetch behind Horizon's Today screen. One `projectionForRange`
 * call feeds three derivations (H11 metrics, H12 warnings, next-events) —
 * reusing `useHorizonWarnings` here would mean a second, redundant
 * projection fetch just for the banner.
 */
export function useHorizonToday() {
  const space = useSpaceStore();
  const loading = ref(false);
  const error = ref<string | null>(null);

  const reportingCurrency = ref<Currency>('RSD');
  const spendMode = ref<SpendMode>('cap');
  const capMinor = ref<number | null>(null);
  const endBalanceMinor = ref(0);
  const trough = ref<Trough | null>(null);
  const balanceToday = ref<number | null>(null);
  const monthEnd = ref<{ month: string; balanceMinor: number } | null>(null);
  const nextEvents = ref<LedgerEvent[]>([]);
  const allWarnings = ref<NegativeDayWarning[]>([]);
  const daysUnderCount = ref(0);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      endBalanceMinor.value = 0;
      trough.value = null;
      balanceToday.value = null;
      monthEnd.value = null;
      nextEvents.value = [];
      allWarnings.value = [];
      daysUnderCount.value = 0;
      capMinor.value = null;
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const now = new Date();
      const todayKey = zonedDateKey(now, currentSpace.timezone);
      const range = { from: todayKey, to: addDays(todayKey, DEFAULT_HORIZON_DAYS) };

      const [projection, settings, cap, dismissals] = await Promise.all([
        projectionForRange(supabase, currentSpace.id, {
          now,
          timeZone: currentSpace.timezone,
          range,
        }),
        getSettings(supabase, currentSpace.id),
        getCap(supabase, currentSpace.id),
        listProjectionDismissals(supabase, currentSpace.id),
      ]);

      reportingCurrency.value = settings.reporting_currency as Currency;
      spendMode.value = settings.spend_mode;
      capMinor.value = cap?.monthly_cap_minor ?? null;

      const metrics = computeMetrics(projection.value.days);
      endBalanceMinor.value = metrics.endBalanceMinor;
      trough.value = globalTrough(projection.value.days);
      balanceToday.value = projection.value.days[0]?.balanceMinor ?? null;
      const currentMonth = metrics.months[0] ?? null;
      monthEnd.value = currentMonth
        ? { month: currentMonth.month, balanceMinor: currentMonth.endBalanceMinor }
        : null;

      nextEvents.value = projection.value.events.filter((e) => e.date >= todayKey).slice(0, 3);
      daysUnderCount.value = daysUnder(projection.value.days);

      allWarnings.value = computeNegativeDayWarnings(
        projection.value.days,
        dismissals.map((d: ProjectionDismissal) => ({
          negativeDate: d.negative_date,
          shortfallMinor: d.shortfall_minor,
        })),
        reportingCurrency.value
      );
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load today's summary.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  const warnings = computed(() => allWarnings.value);

  async function dismiss(date: string, reason: string): Promise<void> {
    const spaceId = space.currentSpaceId;
    const warning = allWarnings.value.find((w) => w.date === date);
    if (!spaceId || !warning) return;
    await dismissNegativeDay(supabase, spaceId, {
      negative_date: warning.date,
      shortfall_minor: warning.shortfallMinor,
      currency: warning.currency,
      reason,
    });
    allWarnings.value = allWarnings.value.filter((w) => w.date !== date);
  }

  return {
    loading,
    error,
    refresh,
    reportingCurrency,
    spendMode,
    capMinor,
    endBalanceMinor,
    trough,
    balanceToday,
    monthEnd,
    nextEvents,
    warnings,
    daysUnderCount,
    dismiss,
  };
}
