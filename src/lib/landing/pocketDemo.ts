/**
 * Fixture state for the landing page's Pocket demo. Every derived figure
 * runs through the real @roman-mik/kapa-core/pocket functions — this module
 * only owns the fixture cap, the fixture "today", and the list of sample
 * expenses a visitor can add. See docs/kapa-vue/plans/2026-08-30-landing-page.md
 * task 4.
 */
import {
  evenPace,
  overspend as overspendOf,
  paceGap,
  pocketHomeView,
  projection,
  remaining,
  safeDaily,
  spentPct,
  type Currency,
} from '@roman-mik/kapa-core/pocket';

export const DEMO_CURRENCY: Currency = 'EUR';
export const DEMO_CAP = 60_000; // €600.00, in minor units

// A fixed "today" partway through a 30-day month — day 18 of 30, 17 days
// completed — so pace/projection both have something to say (real app
// suppresses them below 1 completed day / 3 elapsed days, see home-view.ts).
export const DEMO_DAYS_IN_MONTH = 30;
export const DEMO_ELAPSED_DAYS = 18;
export const DEMO_COMPLETED_DAYS = 17;
export const DEMO_DAYS_LEFT = DEMO_DAYS_IN_MONTH - DEMO_ELAPSED_DAYS;

export interface DemoCategory {
  id: string;
  name: string;
  /** One representative tap amount, minor units. */
  amountMinor: number;
}

// A tap adds one representative expense per category — enough to explore
// under-cap, nudge and over-cap without a full add-expense form.
export const DEMO_CATEGORIES: DemoCategory[] = [
  { id: 'groceries', name: 'Groceries', amountMinor: 4_200 },
  { id: 'transport', name: 'Transport', amountMinor: 1_500 },
  { id: 'coffee', name: 'Coffee', amountMinor: 350 },
  { id: 'dining', name: 'Dining out', amountMinor: 3_800 },
  { id: 'rent-share', name: 'Household', amountMinor: 12_000 },
];

// Starting spend — enough that the bar already reads as "in progress",
// not an empty state, before any tap.
export const DEMO_STARTING_SPENT = 31_400;

export interface PocketDemoSummary {
  spent: number;
  cap: number;
  currency: Currency;
  remaining: number;
  overspend: number;
  spentPct: number;
  safeDaily: number;
  paceGap: number;
  projection: number;
  home: ReturnType<typeof pocketHomeView>;
}

/** Runs the same functions PocketHomeView.vue does — the demo IS the app's math. */
export function pocketDemoSummary(spent: number): PocketDemoSummary {
  const remainingValue = remaining(DEMO_CAP, spent);
  const overspendValue = overspendOf(DEMO_CAP, spent);
  const spentPctValue = spentPct(spent, DEMO_CAP);
  const evenPaceValue = evenPace(DEMO_CAP, DEMO_COMPLETED_DAYS, DEMO_DAYS_IN_MONTH);

  return {
    spent,
    cap: DEMO_CAP,
    currency: DEMO_CURRENCY,
    remaining: remainingValue,
    overspend: overspendValue,
    spentPct: spentPctValue,
    safeDaily: safeDaily(remainingValue, DEMO_DAYS_LEFT),
    paceGap: paceGap(evenPaceValue, spent),
    projection: projection(spent, DEMO_ELAPSED_DAYS, DEMO_DAYS_IN_MONTH),
    home: pocketHomeView({
      cap: DEMO_CAP,
      overspend: overspendValue,
      spentPct: spentPctValue,
      nudgeEnabled: true,
      nudgePct: 80,
      completedDays: DEMO_COMPLETED_DAYS,
      elapsedDays: DEMO_ELAPSED_DAYS,
    }),
  };
}
