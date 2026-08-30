/**
 * Deterministic Horizon projection fixture for the landing page. Horizon's
 * real projection engine isn't built yet — kapa-core only has
 * `listAccounts` (see src/queries/horizon/accounts.ts) — so this walks a
 * small, hand-built event set day by day, honouring the domain rules in
 * tracker/docs/horizon-user-stories.md §2 well enough to make an honest
 * demo:
 *
 *  - D1  every obligation has its own due date, never spread evenly
 *  - D2  the intra-month minimum is computed, not just month end
 *  - D3  same-day events are ordered explicitly (income before outflows)
 *  - D4  a payment's date and the period it covers are separate fields
 *  - D6  a schedule due on a weekend/holiday slips per its policy
 *  - D9  hourly income varies with the working-day count of its period
 *  - D11 FX is a dated snapshot, applied at display/aggregation time only
 *  - D15 source amounts stay native; only the running balance converts
 *
 * No `Date.now()` — `baseDate` is a parameter, so two calls with the same
 * input return byte-identical output (see horizonDemo.test.ts).
 */
import { CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';

export const REPORTING_CURRENCY: Currency = 'EUR';
const MONTHS = 4;

// A dated FX snapshot (D11) — never live-fetched. EUR per 1 unit of the
// source currency.
const FX_TO_EUR: Partial<Record<Currency, number>> = {
  USD: 0.92,
  RUB: 0.0095,
};

function toReportingMinor(amountMinor: number, currency: Currency): number {
  if (currency === REPORTING_CURRENCY) return amountMinor;
  const rate = FX_TO_EUR[currency] ?? 1;
  const sourceExp = CURRENCY_EXPONENT[currency];
  const reportingExp = CURRENCY_EXPONENT[REPORTING_CURRENCY];
  const majorAmount = (amountMinor / 10 ** sourceExp) * rate;
  return Math.round(majorAmount * 10 ** reportingExp);
}

// --- date helpers (plain UTC, self-contained — this fixture isn't
// space-timezone-aware like the real Pocket engine) ---------------------

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

// One fixed holiday in month 2, so a slip can be demonstrated by both a
// weekend AND a holiday landing on a schedule date (D6).
function holidaysFrom(base: Date): Set<string> {
  const holiday = utcDate(base.getUTCFullYear(), base.getUTCMonth() + 1, 1);
  return new Set([dayKey(holiday)]);
}

type SlippagePolicy = 'nextBusinessDay' | 'previousBusinessDay';

function applySlippage(date: Date, holidays: Set<string>, policy: SlippagePolicy): Date {
  let shifted = date;
  const step = policy === 'nextBusinessDay' ? 1 : -1;
  while (isWeekend(shifted) || holidays.has(dayKey(shifted))) {
    shifted = addDays(shifted, step);
  }
  return shifted;
}

function lastDayOfMonth(year: number, month: number): Date {
  return utcDate(year, month + 1, 0);
}

/** Working weekdays (Mon-Fri) strictly between two dates, exclusive of `from`, inclusive of `to`. */
function countWorkingDays(from: Date, to: Date, holidays: Set<string>): number {
  let count = 0;
  let cursor = addDays(from, 1);
  while (cursor.getTime() <= to.getTime()) {
    if (!isWeekend(cursor) && !holidays.has(dayKey(cursor))) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

// --- event model ---------------------------------------------------------

export type EventKind = 'income' | 'obligation' | 'daily-expense';

export interface ProjectionEvent {
  date: string; // YYYY-MM-DD
  label: string;
  kind: EventKind;
  amountMinor: number; // signed, native currency
  currency: Currency;
  /** What period this movement covers, when it isn't the date it lands on (D4). */
  coversPeriod?: string;
  balanceBefore: number; // reporting currency, minor units
  balanceAfter: number;
}

export interface DailyBalance {
  date: string;
  balanceMinor: number; // reporting currency
}

export interface MonthMetric {
  month: string; // YYYY-MM
  date: string;
  balanceMinor: number;
}

export interface HorizonProjection {
  currency: Currency;
  dailyBalances: DailyBalance[];
  events: ProjectionEvent[];
  monthEnd: MonthMetric[];
  monthMinimum: MonthMetric[];
  firstNegativeDate: string | null;
}

const HOURLY_RATE_MINOR = 1_800; // €18.00/hour
const HOURS_PER_DAY = 6;
// Deliberately tight — the whole point of the demo is that month-end alone
// (D2) hides a mid-month crunch. See horizonDemo.test.ts for the exact
// numbers this produces.
const STARTING_BALANCE_MINOR = 15_000; // €150.00

interface Obligation {
  label: string;
  dueDay: number;
  amountMinor: number;
  currency: Currency;
  coversPeriod?: string;
}

const OBLIGATIONS: Obligation[] = [
  { label: 'Rent', dueDay: 28, amountMinor: 92_000, currency: 'EUR', coversPeriod: 'next month' },
  {
    label: 'Utilities',
    dueDay: 5,
    amountMinor: 8_400,
    currency: 'EUR',
    coversPeriod: 'previous month',
  },
  { label: 'Car loan', dueDay: 12, amountMinor: 21_000, currency: 'USD' },
  { label: 'Streaming bundle', dueDay: 20, amountMinor: 140_000, currency: 'RUB' },
];

const GROCERIES_DAILY_MINOR = 1_100; // accrues daily (D12)
const GROCERIES_CHARGE_CADENCE = 'weekly';

interface ScheduledPayment {
  paidDate: string; // dayKey — the (possibly slipped) date cash actually moves
  build: (before: number) => ProjectionEvent;
}

/**
 * Every obligation and income payment across the whole window, computed
 * once from each month's *nominal* schedule date before any slippage —
 * recomputing "the 28th" from whatever day the loop happens to be on would
 * silently drop a payment that slipped across a month boundary (e.g. a
 * Saturday 28th slipping to the 2nd of the next month, whose own 28th is a
 * different, unrelated due date).
 */
function buildSchedule(
  start: Date,
  monthsCount: number,
  holidays: Set<string>
): ScheduledPayment[] {
  const scheduled: ScheduledPayment[] = [];
  let lastIncomeDate = addDays(start, -1);

  for (let i = 0; i < monthsCount; i += 1) {
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth() + i;

    const payday15 = utcDate(year, month, 15);
    const monthEndDate = lastDayOfMonth(year, month);

    for (const [nominal, policy, label] of [
      [payday15, 'nextBusinessDay', 'Freelance income (1st half)'],
      [monthEndDate, 'previousBusinessDay', 'Freelance income (2nd half)'],
    ] as const) {
      const paidDate = applySlippage(nominal, holidays, policy);
      const periodStart = lastIncomeDate;
      const workingDays = countWorkingDays(periodStart, nominal, holidays);
      const amountMinor = HOURLY_RATE_MINOR * HOURS_PER_DAY * workingDays;
      scheduled.push({
        paidDate: dayKey(paidDate),
        build: (before) => ({
          date: dayKey(paidDate),
          label,
          kind: 'income',
          amountMinor,
          currency: REPORTING_CURRENCY,
          balanceBefore: before,
          balanceAfter: before + amountMinor,
        }),
      });
      lastIncomeDate = nominal;
    }

    for (const obligation of OBLIGATIONS) {
      const nominal = utcDate(year, month, obligation.dueDay);
      const paidDate = applySlippage(nominal, holidays, 'nextBusinessDay');
      const reportingAmount = toReportingMinor(obligation.amountMinor, obligation.currency);
      scheduled.push({
        paidDate: dayKey(paidDate),
        build: (before) => ({
          date: dayKey(paidDate),
          label: obligation.label,
          kind: 'obligation',
          amountMinor: -obligation.amountMinor,
          currency: obligation.currency,
          coversPeriod: obligation.coversPeriod,
          balanceBefore: before,
          balanceAfter: before - reportingAmount,
        }),
      });
    }
  }

  // D3: same-day ordering is explicit — income before every outflow.
  const kindOrder: Record<EventKind, number> = { income: 0, obligation: 1, 'daily-expense': 2 };
  return scheduled.sort((a, b) => {
    if (a.paidDate !== b.paidDate) return a.paidDate < b.paidDate ? -1 : 1;
    return kindOrder[a.build(0).kind] - kindOrder[b.build(0).kind];
  });
}

/** Runs the fixture over `MONTHS` months starting from `baseDate`. Pure — same input, same output. */
export function horizonProjection(baseDate: Date): HorizonProjection {
  const holidays = holidaysFrom(baseDate);
  const start = utcDate(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1);
  const end = lastDayOfMonth(start.getUTCFullYear(), start.getUTCMonth() + (MONTHS - 1));
  const schedule = buildSchedule(start, MONTHS, holidays);
  const scheduleByDate = new Map<string, ScheduledPayment[]>();
  for (const payment of schedule) {
    const list = scheduleByDate.get(payment.paidDate) ?? [];
    list.push(payment);
    scheduleByDate.set(payment.paidDate, list);
  }

  const events: ProjectionEvent[] = [];
  const dailyBalances: DailyBalance[] = [];
  let balance = STARTING_BALANCE_MINOR;
  let firstNegativeDate: string | null = null;

  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    const key = dayKey(cursor);

    for (const payment of scheduleByDate.get(key) ?? []) {
      const event = payment.build(balance);
      balance = event.balanceAfter;
      events.push(event);
    }

    // Daily-accrual expense (D12): accrues every day, but is charged weekly
    // (Mondays) — the event stream carries the real cash movement.
    if (cursor.getUTCDay() === 1) {
      const chargeMinor = GROCERIES_DAILY_MINOR * 7;
      const before = balance;
      balance -= chargeMinor;
      events.push({
        date: key,
        label: 'Groceries',
        kind: 'daily-expense',
        amountMinor: -chargeMinor,
        currency: REPORTING_CURRENCY,
        coversPeriod: `accrues ${GROCERIES_DAILY_MINOR / 100}/day, charged ${GROCERIES_CHARGE_CADENCE}`,
        balanceBefore: before,
        balanceAfter: balance,
      });
    }

    if (balance < 0 && firstNegativeDate === null) firstNegativeDate = key;
    dailyBalances.push({ date: key, balanceMinor: balance });
    cursor = addDays(cursor, 1);
  }

  const monthEnd: MonthMetric[] = [];
  const monthMinimum: MonthMetric[] = [];
  for (let i = 0; i < MONTHS; i += 1) {
    const monthDate = utcDate(start.getUTCFullYear(), start.getUTCMonth() + i, 1);
    const monthKey = monthDate.toISOString().slice(0, 7);
    const daysInThisMonth = dailyBalances.filter((d) => d.date.startsWith(monthKey));
    const last = daysInThisMonth[daysInThisMonth.length - 1];
    if (!last) continue;
    monthEnd.push({ month: monthKey, date: last.date, balanceMinor: last.balanceMinor });

    const lowest = daysInThisMonth.reduce((min, d) =>
      d.balanceMinor < min.balanceMinor ? d : min
    );
    monthMinimum.push({ month: monthKey, date: lowest.date, balanceMinor: lowest.balanceMinor });
  }

  return {
    currency: REPORTING_CURRENCY,
    dailyBalances,
    events,
    monthEnd,
    monthMinimum,
    firstNegativeDate,
  };
}
