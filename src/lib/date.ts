// 'YYYY-MM-DD' parsing and reformatting. A dateKey is a calendar date with no
// attached timezone, so every formatter here reads it back through an explicit
// UTC anchor — letting the browser's local zone interpret it could shift the
// displayed day. Intl formatting is presentation-only with no DOM dependency,
// so it stays here rather than in kapa-core (whose tsconfig excludes `lib: dom`).

export function formatFullDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Weekday and day only (`Tue 2`) — the form for a date that already sits under
 * a month heading, so repeating the month would be redundant. Same UTC anchor
 * as `formatFullDate`. Assembled weekday-first explicitly, since
 * `toLocaleDateString` default ordering can place the day before the weekday
 * on some locales.
 */
export function formatDay(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short' });
  return `${weekday} ${day}`;
}

/**
 * Full month name for a 'YYYY-MM' key (`2026-09` -> `September`), for month
 * headers. `formatMonthLabel` (kapa-core) gives the short `Sep`; the timeline
 * header wants the full word.
 */
export function formatFullMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    month: 'long',
  });
}

export interface SlippedDateParts {
  /** The effective (post-slippage) date. */
  slip: string;
  /** The original date, formatted for the caller to strike through. */
  original: string;
}

/**
 * Formats both halves of a slipped date — the effective one and the original it
 * was pushed from — so callers can render the original struck through beside the
 * effective date (`~~Mon 1~~ Tue 2 Sep`) rather than as a parenthetical.
 */
export function formatSlippedDate(effective: string, original: string): SlippedDateParts {
  return { slip: formatFullDate(effective), original: formatFullDate(original) };
}
