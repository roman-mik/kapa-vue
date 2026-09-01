import {
  applySlippage,
  coveredPeriod,
  generateDates,
  monthBounds,
  OBLIGATION_CATEGORIES,
  type ScheduleCalendar,
} from '@roman-mik/kapa-core/horizon';
import {
  archiveObligation,
  createObligation,
  createObligationSchedule,
  deleteObligation,
  getWorkCalendar,
  listObligations,
  obligationScheduleRule,
  replaceObligationSchedules,
  updateObligation,
  type ObligationScheduleInsert,
  type ObligationUpdate,
  type ObligationWithSchedules,
} from '@roman-mik/kapa-core/horizon/queries';
import { currentMonth, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { countNonConfirmed } from '@/lib/horizon/confidence';
import { useSpaceStore } from '@/stores/space';

/**
 * The eight categories an obligation can have — the full `spend_category`
 * set minus the windfall pair (`gift`/`bonus`), which obligations reject via
 * a DB check constraint (they're recurring commitments, not one-offs). The
 * DB row type still carries the full enum (`SpendCategory`), so callers
 * narrow to this when they index the label map.
 */
export type ObligationCategory = (typeof OBLIGATION_CATEGORIES)[number];

export const OBLIGATION_CATEGORY_LABELS: Record<ObligationCategory, string> = {
  housing: 'Housing',
  utilities: 'Utilities',
  debt: 'Debt',
  subscriptions: 'Subscriptions',
  insurance: 'Insurance',
  transport: 'Transport',
  family: 'Family',
  other: 'Other',
};

/**
 * Fields the create-only obligation form collects. Obligations are fixed
 * amounts on their own due dates (D1 — never averaged), so the form needs no
 * hourly/earning-period fields; the "when" becomes a single schedule row.
 */
export interface NewObligation {
  name: string;
  category: ObligationCategory;
  currency: Currency;
  accountId: string;
  /** 'YYYY-MM-DD' — the obligation's start date. */
  startDate: string;
  amountMinor: number;
  /** The schedule rule for when it's due. */
  rule: ObligationRule;
}

/**
 * The edit form's input: everything NewObligation knows, plus identity —
 * `updatedAt` passes through the pessimistic-lock update so a concurrent
 * edit gets a conflict instead of silent last-write-wins.
 */
export interface ObligationEdit extends NewObligation {
  id: string;
  updatedAt: string;
}

export type ObligationRule = { kind: 'dayOfMonth'; dayOfMonth: number } | { kind: 'monthEnd' };

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatMonthLabel(month: string): string {
  const [, month1] = month.split('-');
  return MONTH_LABELS[Number(month1) - 1];
}

/** A concrete due date for an obligation, with the covered-period label (D3). */
export interface ObligationOccurrence {
  /** 'YYYY-MM-DD', after slippage. */
  date: string;
  shifted: boolean;
  /** Present only when `shifted`. */
  originalDate?: string;
  /** e.g. 'Sep' — the period this payment covers. */
  periodLabel: string;
}

/** An obligation with its current-month figures, ready for the Money-out list. */
export interface ObligationMonth extends ObligationWithSchedules {
  /** The total due in `month`, in the obligation's own currency. */
  monthlyMinor: number;
  /** The concrete due dates within `month`, each with a covered-period label. */
  occurrences: ObligationOccurrence[];
}

export function useObligations() {
  const space = useSpaceStore();
  const allObligations = ref<ObligationWithSchedules[]>([]);
  const calendar = ref<ScheduleCalendar | null>(null);
  const month = ref('');
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      allObligations.value = [];
      calendar.value = null;
      month.value = '';
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const [workCalendar, obligations] = await Promise.all([
        getWorkCalendar(supabase, currentSpace.id),
        listObligations(supabase, currentSpace.id),
      ]);
      calendar.value = workCalendar;
      month.value = currentMonth(new Date(), currentSpace.timezone);
      allObligations.value = obligations;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load obligations.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  // Archived obligations drop out of Money-out; they stay in the DB so
  // projections keep their references (same contract as accounts/streams).
  const obligations = computed(() => allObligations.value.filter((o) => !o.archived));

  const obligationsWithMonth = computed<ObligationMonth[]>(() => {
    if (!calendar.value || !month.value) return [];
    const { first, last } = monthBounds(month.value);
    return obligations.value.map((obligation) => {
      const occurrences: ObligationOccurrence[] = [];
      for (const schedule of obligation.schedules) {
        const rule = obligationScheduleRule(schedule);
        for (const rawDate of generateDates(rule, calendar.value!, { from: first, to: last })) {
          const date = applySlippage(rawDate, calendar.value!, rule.slippagePolicy);
          const shifted = date !== rawDate;
          occurrences.push({
            date,
            shifted,
            ...(shifted ? { originalDate: rawDate } : {}),
            periodLabel: formatMonthLabel(coveredPeriod(rawDate, rule)),
          });
        }
      }
      occurrences.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      return {
        ...obligation,
        monthlyMinor: obligation.amount_minor * occurrences.length,
        occurrences,
      };
    });
  });

  const convertibles = computed(() =>
    obligationsWithMonth.value.map((o) => ({
      id: o.id,
      currency: o.currency as Currency,
      amountMinor: o.monthlyMinor,
    }))
  );

  // Number of active obligations treated as estimates (not confirmed) in this
  // projection — the obligations half of the rail's "N estimates" surface.
  const nonConfirmedCount = computed(() => countNonConfirmed(obligations.value));

  /**
   * Creates the obligation, then its schedule. A failure mid-way rolls the
   * orphaned obligation back so a half-saved obligation never shows in the
   * list — mirrors `useIncomeStreams.add`.
   */
  async function add(input: NewObligation): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    const { id } = await createObligation(supabase, {
      space_id: spaceId,
      account_id: input.accountId,
      currency: input.currency,
      name: input.name,
      category: input.category,
      amount_minor: input.amountMinor,
      start_date: input.startDate,
    });
    try {
      await createObligationSchedule(supabase, {
        obligation_id: id,
        space_id: spaceId,
        kind: input.rule.kind,
        day_of_month: input.rule.kind === 'dayOfMonth' ? input.rule.dayOfMonth : null,
        slippage_policy: 'nextBusinessDay',
        covers_period: 'same',
      });
    } catch (err) {
      await deleteObligation(supabase, id);
      throw err;
    }
    await refresh();
  }

  /**
   * Save the edit form. The obligation's own columns patch first, then its
   * schedule is replaced whole-row (delete-all + insert — no `updated_at` or
   * unique constraint on schedules). Conflict (stale `updatedAt`) surfaces as
   * a thrown error for the form to show, mirroring `useIncomeStreams.update`.
   */
  async function update(input: ObligationEdit): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    const patch: ObligationUpdate = {
      name: input.name,
      category: input.category,
      currency: input.currency,
      account_id: input.accountId,
      amount_minor: input.amountMinor,
      start_date: input.startDate,
    };
    const outcome = await updateObligation(supabase, input.id, patch, input.updatedAt);
    if (!outcome.ok) {
      throw new Error('This obligation was changed elsewhere — refresh and try again.');
    }
    const schedules: ObligationScheduleInsert[] = [
      {
        obligation_id: input.id,
        space_id: spaceId,
        kind: input.rule.kind,
        day_of_month: input.rule.kind === 'dayOfMonth' ? input.rule.dayOfMonth : null,
        slippage_policy: 'nextBusinessDay',
        covers_period: 'same',
      },
    ];
    await replaceObligationSchedules(supabase, input.id, schedules);
    await refresh();
  }

  async function archive(id: string, updatedAt: string): Promise<void> {
    const outcome = await archiveObligation(supabase, id, updatedAt);
    if (!outcome.ok) {
      throw new Error('This obligation was changed elsewhere — refresh and try again.');
    }
    await refresh();
  }

  return {
    obligationsWithMonth,
    convertibles,
    nonConfirmedCount,
    month,
    calendar,
    loading,
    error,
    refresh,
    add,
    update,
    archive,
  };
}
