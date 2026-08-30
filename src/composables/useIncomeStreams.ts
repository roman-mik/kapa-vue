import {
  createIncomeSchedule,
  createIncomeStream,
  deleteIncomeStream,
  getWorkCalendar,
  incomeScheduleMathInput,
  incomeStreamMathInput,
  listIncomeStreams,
  type IncomeScheduleInsert,
  type IncomeStreamWithSchedules,
} from '@roman-mik/kapa-core/horizon/queries';
import {
  monthlyIncomeMinor,
  paymentOccurrences,
  type IncomePaymentOccurrence,
} from '@roman-mik/kapa-core/horizon';
import { currentMonth, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

/**
 * Fields the create-only income form collects. Every schedule shape derivable
 * from them maps onto `horizon.income_schedules` in `add`.
 */
export interface NewIncomeStream {
  name: string;
  kind: 'hourly' | 'fixed' | 'variable';
  currency: Currency;
  accountId: string;
  /** 'YYYY-MM-DD' — the first day of the month the stream starts in. */
  startDate: string;
  earningPeriodKind: 'monthly' | 'semiMonthly';
  /** Hourly fields. */
  hourlyRateMinor: number | null;
  hoursPerDayE2: number | null;
  /** Days after an earning period ends that hourly pay lands (H6 lag). */
  lagDays: number;
  /** Fixed/variable fields. */
  amountMinor: number | null;
  paymentRule: 'dayOfMonth' | 'monthEnd' | 'semiMonthly';
  payDay: number;
  taxable: boolean;
}

/** A stream with its current-month figures, ready for the Money-in list. */
export interface IncomeStreamMonth extends IncomeStreamWithSchedules {
  /** The stream's total in `month`, in the stream's own currency. */
  monthlyMinor: number;
  /** The concrete payments derivable within `month`, each with a label. */
  occurrences: IncomePaymentOccurrence[];
}

export type StreamKindLabel = 'Hourly' | 'Fixed' | 'Variable';

const KIND_LABELS: Record<NewIncomeStream['kind'], StreamKindLabel> = {
  hourly: 'Hourly',
  fixed: 'Fixed',
  variable: 'Variable',
};

export function streamKindLabel(kind: string): StreamKindLabel {
  return KIND_LABELS[kind as NewIncomeStream['kind']] ?? (kind as StreamKindLabel);
}

export function useIncomeStreams() {
  const space = useSpaceStore();
  const allStreams = ref<IncomeStreamWithSchedules[]>([]);
  const calendar = ref<{ workingWeekdays: number[]; holidays: string[] } | null>(null);
  const month = ref('');
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      allStreams.value = [];
      calendar.value = null;
      month.value = '';
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const [workCalendar, streams] = await Promise.all([
        getWorkCalendar(supabase, currentSpace.id),
        listIncomeStreams(supabase, currentSpace.id),
      ]);
      calendar.value = workCalendar;
      month.value = currentMonth(new Date(), currentSpace.timezone);
      allStreams.value = streams;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load income streams.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  // Archived streams drop out of Money-in; they stay in the DB so projections
  // keep their references (same contract as accounts).
  const streams = computed(() => allStreams.value.filter((s) => !s.archived));

  // The derived list. The engine is pure and takes the calendar + month in,
  // so mapping the row shapes through kapa-core's mappers is the whole job here.
  const streamsWithMonth = computed<IncomeStreamMonth[]>(() => {
    if (!calendar.value || !month.value) return [];
    return streams.value.map((stream) => {
      const input = incomeStreamMathInput(stream);
      const schedules = stream.schedules.map(incomeScheduleMathInput);
      return {
        ...stream,
        monthlyMinor: monthlyIncomeMinor(input, schedules, calendar.value!, month.value),
        occurrences: paymentOccurrences(input, schedules, calendar.value!, month.value),
      };
    });
  });

  const convertibles = computed(() =>
    streamsWithMonth.value.map((s) => ({
      id: s.id,
      currency: s.currency as Currency,
      amountMinor: s.monthlyMinor,
    }))
  );

  /**
   * Creates the stream, then its payment schedules. A failure mid-way rolls
   * the orphaned stream back so a half-saved stream never shows in the list.
   */
  async function add(input: NewIncomeStream): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    const { id } = await createIncomeStream(supabase, {
      space_id: spaceId,
      account_id: input.accountId,
      currency: input.currency,
      name: input.name,
      kind: input.kind,
      start_date: input.startDate,
      fixed_amount_minor: input.kind === 'hourly' ? null : input.amountMinor,
      hourly_rate_minor: input.kind === 'hourly' ? input.hourlyRateMinor : null,
      hours_per_day_e2: input.kind === 'hourly' ? input.hoursPerDayE2 : null,
      earning_period_kind: input.earningPeriodKind,
      taxable: input.taxable,
    });
    try {
      const schedules: IncomeScheduleInsert[] =
        input.kind === 'hourly'
          ? [
              // Hourly payment timing comes from the stream's first schedule:
              // lag days + slippage only, the day-of-month is not used. 15th
              // is the neutral placeholder.
              {
                income_stream_id: id,
                space_id: spaceId,
                kind: 'dayOfMonth',
                day_of_month: 15,
                slippage_policy: 'nextBusinessDay',
                covers_period: 'same',
                lag_days: input.lagDays,
              },
            ]
          : fixedSchedules(id, spaceId, input.paymentRule, input.payDay);
      for (const schedule of schedules) {
        await createIncomeSchedule(supabase, schedule);
      }
    } catch (err) {
      await deleteIncomeStream(supabase, id);
      throw err;
    }
    await refresh();
  }

  return { streamsWithMonth, convertibles, month, loading, error, refresh, add };
}

function fixedSchedules(
  incomeStreamId: string,
  spaceId: string,
  rule: NewIncomeStream['paymentRule'],
  payDay: number
): IncomeScheduleInsert[] {
  const base = {
    income_stream_id: incomeStreamId,
    space_id: spaceId,
    slippage_policy: 'nextBusinessDay' as const,
    covers_period: 'same' as const,
    lag_days: null,
  };
  if (rule === 'monthEnd') {
    return [{ ...base, kind: 'monthEnd', day_of_month: null }];
  }
  if (rule === 'semiMonthly') {
    return [
      { ...base, kind: 'dayOfMonth', day_of_month: 1 },
      { ...base, kind: 'dayOfMonth', day_of_month: 15 },
    ];
  }
  return [{ ...base, kind: 'dayOfMonth', day_of_month: payDay }];
}
