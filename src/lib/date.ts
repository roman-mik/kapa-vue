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
