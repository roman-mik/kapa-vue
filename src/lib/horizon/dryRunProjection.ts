// A client-side "what if this were added" dry run for the entry sheet's live
// effect line. `buildProjection` is pure (no I/O), so splicing one draft
// entry into an otherwise-real `ProjectionInput` and running it twice
// (baseline vs. with-draft) is cheap and exact — no approximation of the
// projection math is needed or attempted here.

import {
  buildProjection,
  type IncomeStreamMathInput,
  type IncomeStreamProjectionInput,
  type ObligationProjectionInput,
  type OneOffProjectionInput,
  type PlannedSpendProjectionInput,
  type ProjectionInput,
  type StreamPaymentSchedule,
} from '@roman-mik/kapa-core/horizon';
import type { NewIncomeStream } from '@/composables/useIncomeStreams';
import type { NewObligation } from '@/composables/useObligations';
import type { NewOneOffEvent } from '@/composables/useOneOffEvents';
import type { NewPlannedSpend } from '@/composables/usePlannedSpend';
import { globalTrough, type Trough } from '@/lib/horizon/trough';

/** A `ProjectionInput` minus the one entity kind the draft will add. */
export type DryRunIngredients = ProjectionInput;

export type DraftEntry =
  | { kind: 'incomeStream'; value: NewIncomeStream }
  | { kind: 'obligation'; value: NewObligation }
  | { kind: 'oneOff'; value: NewOneOffEvent }
  | { kind: 'plannedSpend'; value: NewPlannedSpend };

export interface DryRunEffect {
  /** with-draft balanceToday minus baseline balanceToday. */
  todayDeltaMinor: number;
  troughBefore: Trough | null;
  troughAfter: Trough | null;
  /** True when the trough's date or amount differs (or either side has none). */
  troughChanged: boolean;
}

const DRAFT_ID = '__draft__';

const SCHEDULE_DEFAULTS = {
  intervalDays: null,
  nthWeekday: null,
  weekday: null,
  anchorDate: null,
  slippagePolicy: 'nextBusinessDay',
  coversPeriod: 'same',
} as const;

function draftIncomeSchedules(input: NewIncomeStream): StreamPaymentSchedule[] {
  if (input.kind === 'hourly') {
    // Mirrors `hourlySchedules` in useIncomeStreams.ts: only lag days and
    // slippage matter for hourly payment timing, day-of-month is a neutral
    // placeholder.
    return [
      {
        id: DRAFT_ID,
        kind: 'dayOfMonth',
        dayOfMonth: 15,
        ...SCHEDULE_DEFAULTS,
        lagDays: input.lagDays,
      },
    ];
  }
  if (input.paymentRule === 'monthEnd') {
    return [
      { id: DRAFT_ID, kind: 'monthEnd', dayOfMonth: null, ...SCHEDULE_DEFAULTS, lagDays: null },
    ];
  }
  if (input.paymentRule === 'semiMonthly') {
    return [
      {
        id: `${DRAFT_ID}-1`,
        kind: 'dayOfMonth',
        dayOfMonth: 1,
        ...SCHEDULE_DEFAULTS,
        lagDays: null,
      },
      {
        id: `${DRAFT_ID}-2`,
        kind: 'dayOfMonth',
        dayOfMonth: 15,
        ...SCHEDULE_DEFAULTS,
        lagDays: null,
      },
    ];
  }
  return [
    {
      id: DRAFT_ID,
      kind: 'dayOfMonth',
      dayOfMonth: input.payDay,
      ...SCHEDULE_DEFAULTS,
      lagDays: null,
    },
  ];
}

function draftIncomeStreamInput(input: NewIncomeStream): IncomeStreamProjectionInput {
  const math: IncomeStreamMathInput = {
    id: DRAFT_ID,
    kind: input.kind,
    hourlyRateMinor: input.kind === 'hourly' ? input.hourlyRateMinor : null,
    hoursPerDayE2: input.kind === 'hourly' ? input.hoursPerDayE2 : null,
    fixedAmountMinor: input.kind === 'hourly' ? null : input.amountMinor,
    earningPeriod: {
      kind: input.earningPeriodKind,
      customPeriodStartDay: null,
      customPeriodDays: null,
    },
    startDate: input.startDate,
    endDate: null,
  };
  return {
    id: DRAFT_ID,
    name: input.name,
    accountId: input.accountId,
    currency: input.currency,
    math,
    schedules: draftIncomeSchedules(input),
  };
}

function draftObligationInput(input: NewObligation): ObligationProjectionInput {
  return {
    id: DRAFT_ID,
    name: input.name,
    accountId: input.accountId,
    currency: input.currency,
    amountMinor: input.amountMinor,
    schedules: [
      {
        id: DRAFT_ID,
        kind: input.rule.kind,
        dayOfMonth: input.rule.kind === 'dayOfMonth' ? input.rule.dayOfMonth : null,
        ...SCHEDULE_DEFAULTS,
      },
    ],
  };
}

function draftOneOffInput(input: NewOneOffEvent): OneOffProjectionInput {
  return {
    id: DRAFT_ID,
    name: input.name,
    accountId: input.accountId,
    currency: input.currency,
    amountMinor: input.amountMinor,
    direction: input.direction,
    date: input.date,
  };
}

function draftPlannedSpendInput(input: NewPlannedSpend): PlannedSpendProjectionInput {
  return {
    id: DRAFT_ID,
    name: input.name,
    accountId: input.accountId,
    currency: input.currency,
    math: {
      dailyAmountMinor: input.dailyAmountMinor,
      chargeCadence: input.chargeCadence,
      capMinor: input.capMinor,
      startDate: input.startDate,
      endDate: input.endDate,
    },
  };
}

/** Appends the draft to the matching array of an otherwise-real `ProjectionInput`. */
export function spliceDraft(base: DryRunIngredients, draft: DraftEntry): ProjectionInput {
  switch (draft.kind) {
    case 'incomeStream':
      return {
        ...base,
        incomeStreams: [...base.incomeStreams, draftIncomeStreamInput(draft.value)],
      };
    case 'obligation':
      return { ...base, obligations: [...base.obligations, draftObligationInput(draft.value)] };
    case 'oneOff':
      return { ...base, oneOffEvents: [...base.oneOffEvents, draftOneOffInput(draft.value)] };
    case 'plannedSpend':
      return {
        ...base,
        plannedSpend: [...base.plannedSpend, draftPlannedSpendInput(draft.value)],
      };
  }
}

/** Runs `buildProjection` on both inputs and diffs today's balance + the trough. */
export function diffEffect(baseline: ProjectionInput, withDraft: ProjectionInput): DryRunEffect {
  const before = buildProjection(baseline).value.days;
  const after = buildProjection(withDraft).value.days;
  const troughBefore = globalTrough(before);
  const troughAfter = globalTrough(after);
  const troughChanged =
    !troughBefore ||
    !troughAfter ||
    troughBefore.minBalanceMinor !== troughAfter.minBalanceMinor ||
    troughBefore.minBalanceDate !== troughAfter.minBalanceDate;
  return {
    todayDeltaMinor: (after[0]?.balanceMinor ?? 0) - (before[0]?.balanceMinor ?? 0),
    troughBefore,
    troughAfter,
    troughChanged,
  };
}
