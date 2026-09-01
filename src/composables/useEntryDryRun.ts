// Feeds the entry sheet's live "leaves X today · low point unchanged" line.
// `loadBaseline` fetches the same ingredients `projectionForRange` does
// (kapa-core's own orchestrator), by hand, since kapa-core has no exported
// "give me a `ProjectionInput`" helper — every call here is an already
// exported kapa-core function, so this duplicates fetch glue, not projection
// math. `preview` is synchronous and cheap: `buildProjection` is pure.

import {
  addDays,
  forwardSpendForRange,
  pocketActualsForRange,
  runRateSpendForRange,
  type ForwardSpendDay,
  type PocketActualDay,
} from '@roman-mik/kapa-core/horizon';
import {
  getSettings,
  getWorkCalendar,
  listAccounts,
  listIncomeStreams,
  listObligations,
  listOneOffEvents,
  listPlannedSpend,
} from '@roman-mik/kapa-core/horizon/queries';
import { listFxRates } from '@roman-mik/kapa-core/core';
import {
  zonedDateKey,
  type Converted,
  type Currency,
  type FxRate,
} from '@roman-mik/kapa-core/pocket';
import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';
import {
  diffEffect,
  spliceDraft,
  type DraftEntry,
  type DryRunEffect,
  type DryRunIngredients,
} from '@/lib/horizon/dryRunProjection';

const DEFAULT_HORIZON_DAYS = 90;

export function useEntryDryRun() {
  const ingredients = ref<DryRunIngredients | null>(null);
  const loading = ref(false);
  const effect = ref<DryRunEffect | null>(null);

  async function loadBaseline(): Promise<void> {
    const currentSpace = useSpaceStore().currentSpace;
    if (!currentSpace) {
      ingredients.value = null;
      effect.value = null;
      return;
    }
    loading.value = true;
    try {
      const now = new Date();
      const todayKey = zonedDateKey(now, currentSpace.timezone);
      const range = { from: todayKey, to: addDays(todayKey, DEFAULT_HORIZON_DAYS) };
      const yesterdayKey = addDays(todayKey, -1);
      const sweepTo = range.to > yesterdayKey ? range.to : yesterdayKey;

      const [accounts, incomeStreams, obligations, oneOffEvents, plannedSpend, settings, calendar] =
        await Promise.all([
          listAccounts(supabase, currentSpace.id),
          listIncomeStreams(supabase, currentSpace.id),
          listObligations(supabase, currentSpace.id),
          listOneOffEvents(supabase, currentSpace.id),
          listPlannedSpend(supabase, currentSpace.id),
          getSettings(supabase, currentSpace.id),
          getWorkCalendar(supabase, currentSpace.id),
        ]);

      const rateRows = await listFxRates(supabase, sweepTo > todayKey ? sweepTo : todayKey);
      const rates: FxRate[] = rateRows.map((row) => ({
        baseCurrency: row.base_currency as Currency,
        quoteCurrency: row.quote_currency as Currency,
        rateE8: row.rate_e8,
        rateDate: row.rate_date,
      }));
      const reportingCurrency = settings.reporting_currency as Currency;

      const [actuals, forward]: [Converted<PocketActualDay[]>, Converted<ForwardSpendDay[]>] =
        await Promise.all([
          range.from <= yesterdayKey
            ? pocketActualsForRange(supabase, currentSpace.id, {
                timeZone: currentSpace.timezone,
                spaceCurrency: reportingCurrency,
                rates,
                from: range.from,
                to: yesterdayKey,
              })
            : Promise.resolve({ value: [], unconverted: [] }),
          settings.spend_mode === 'runRate'
            ? runRateSpendForRange(supabase, currentSpace.id, {
                now,
                timeZone: currentSpace.timezone,
                spaceCurrency: reportingCurrency,
                rates,
                from: todayKey,
                to: sweepTo,
              })
            : forwardSpendForRange(supabase, currentSpace.id, {
                now,
                timeZone: currentSpace.timezone,
                spaceCurrency: reportingCurrency,
                rates,
                from: todayKey,
                to: sweepTo,
              }),
        ]);

      ingredients.value = {
        accounts,
        incomeStreams: incomeStreams.map((stream) => ({
          id: stream.id,
          name: stream.name,
          accountId: stream.account_id,
          currency: stream.currency,
          math: {
            id: stream.id,
            kind: stream.kind as 'hourly' | 'fixed' | 'variable',
            hourlyRateMinor: stream.hourly_rate_minor,
            hoursPerDayE2: stream.hours_per_day_e2,
            fixedAmountMinor: stream.fixed_amount_minor,
            earningPeriod: {
              kind: stream.earning_period_kind as 'monthly' | 'semiMonthly',
              customPeriodStartDay: stream.custom_period_start_day,
              customPeriodDays: stream.custom_period_days,
            },
            startDate: stream.start_date,
            endDate: stream.end_date,
          },
          schedules: stream.schedules.map((schedule) => ({
            id: schedule.id,
            kind: schedule.kind,
            dayOfMonth: schedule.day_of_month,
            intervalDays: schedule.interval_days,
            nthWeekday: schedule.nth_weekday,
            weekday: schedule.weekday,
            anchorDate: schedule.anchor_date,
            slippagePolicy: schedule.slippage_policy,
            coversPeriod: schedule.covers_period,
            lagDays: schedule.lag_days,
          })),
        })) as DryRunIngredients['incomeStreams'],
        obligations: obligations.map((obligation) => ({
          id: obligation.id,
          name: obligation.name,
          accountId: obligation.account_id,
          currency: obligation.currency,
          amountMinor: obligation.amount_minor,
          schedules: obligation.schedules.map((schedule) => ({
            id: schedule.id,
            kind: schedule.kind,
            dayOfMonth: schedule.day_of_month,
            intervalDays: schedule.interval_days,
            nthWeekday: schedule.nth_weekday,
            weekday: schedule.weekday,
            anchorDate: schedule.anchor_date,
            slippagePolicy: schedule.slippage_policy,
            coversPeriod: schedule.covers_period,
          })),
        })) as DryRunIngredients['obligations'],
        oneOffEvents: oneOffEvents.map((event) => ({
          id: event.id,
          name: event.name,
          accountId: event.account_id,
          currency: event.currency,
          amountMinor: event.amount_minor,
          direction: event.direction === 'in' ? 'in' : 'out',
          date: event.date,
        })) as DryRunIngredients['oneOffEvents'],
        plannedSpend: plannedSpend.map((item) => ({
          id: item.id,
          name: item.name,
          accountId: item.account_id,
          currency: item.currency,
          math: {
            dailyAmountMinor: item.daily_amount_minor,
            chargeCadence: item.charge_cadence,
            capMinor: item.cap_minor,
            startDate: item.start_date,
            endDate: item.end_date,
          },
        })) as DryRunIngredients['plannedSpend'],
        pocketSpend: { actuals: actuals.value, forward: forward.value },
        todayKey,
        range,
        reportingCurrency,
        rates,
        calendar,
        eventOrder: settings.event_order,
      };
    } finally {
      loading.value = false;
    }
  }

  function preview(draft: DraftEntry | null): void {
    if (!ingredients.value || !draft) {
      effect.value = null;
      return;
    }
    effect.value = diffEffect(ingredients.value, spliceDraft(ingredients.value, draft));
  }

  return { loading, ingredients, effect, loadBaseline, preview };
}
