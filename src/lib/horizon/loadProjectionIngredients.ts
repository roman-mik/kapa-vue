// Fetches the same ingredients `projectionForRange` does (kapa-core's own
// orchestrator), by hand, since kapa-core has no exported "give me a
// `ProjectionInput`" helper — every call here is an already exported
// kapa-core function, so this duplicates fetch glue, not projection math.
// Shared by `useEntryDryRun` (task 11) and the settings consequence copy
// (task 14) so the duplication exists exactly once in kapa-vue.

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
  type SpaceSettings,
} from '@roman-mik/kapa-core/horizon/queries';
import { listFxRates } from '@roman-mik/kapa-core/core';
import {
  zonedDateKey,
  type Converted,
  type Currency,
  type FxRate,
} from '@roman-mik/kapa-core/pocket';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProjectionInput } from '@roman-mik/kapa-core/horizon';

export interface ProjectionIngredients {
  input: ProjectionInput;
  settings: SpaceSettings;
}

/** Loads a real `ProjectionInput` for `spaceId` over `[todayKey, todayKey + horizonDays]`. */
export async function loadProjectionIngredients(
  supabase: SupabaseClient,
  spaceId: string,
  timezone: string,
  horizonDays: number
): Promise<ProjectionIngredients> {
  const now = new Date();
  const todayKey = zonedDateKey(now, timezone);
  const range = { from: todayKey, to: addDays(todayKey, horizonDays) };
  const yesterdayKey = addDays(todayKey, -1);
  const sweepTo = range.to > yesterdayKey ? range.to : yesterdayKey;

  const [accounts, incomeStreams, obligations, oneOffEvents, plannedSpend, settings, calendar] =
    await Promise.all([
      listAccounts(supabase, spaceId),
      listIncomeStreams(supabase, spaceId),
      listObligations(supabase, spaceId),
      listOneOffEvents(supabase, spaceId),
      listPlannedSpend(supabase, spaceId),
      getSettings(supabase, spaceId),
      getWorkCalendar(supabase, spaceId),
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
        ? pocketActualsForRange(supabase, spaceId, {
            timeZone: timezone,
            spaceCurrency: reportingCurrency,
            rates,
            from: range.from,
            to: yesterdayKey,
          })
        : Promise.resolve({ value: [], unconverted: [] }),
      settings.spend_mode === 'runRate'
        ? runRateSpendForRange(supabase, spaceId, {
            now,
            timeZone: timezone,
            spaceCurrency: reportingCurrency,
            rates,
            from: todayKey,
            to: sweepTo,
          })
        : forwardSpendForRange(supabase, spaceId, {
            now,
            timeZone: timezone,
            spaceCurrency: reportingCurrency,
            rates,
            from: todayKey,
            to: sweepTo,
          }),
    ]);

  const input: ProjectionInput = {
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
    })) as ProjectionInput['incomeStreams'],
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
    })) as ProjectionInput['obligations'],
    oneOffEvents: oneOffEvents.map((event) => ({
      id: event.id,
      name: event.name,
      accountId: event.account_id,
      currency: event.currency,
      amountMinor: event.amount_minor,
      direction: event.direction === 'in' ? 'in' : 'out',
      date: event.date,
    })) as ProjectionInput['oneOffEvents'],
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
    })) as ProjectionInput['plannedSpend'],
    pocketSpend: { actuals: actuals.value, forward: forward.value },
    todayKey,
    range,
    reportingCurrency,
    rates,
    calendar,
    eventOrder: settings.event_order,
  };

  return { input, settings };
}
