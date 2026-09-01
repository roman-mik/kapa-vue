// An account's share of the included-accounts total, as a fraction (0..1),
// for the Accounts card's progress bar and "NN% of total" caption. Pure
// arithmetic over already-converted space-currency minor units — no I/O, no
// template derivation.

/**
 * `null` when the account is excluded from the total (share is meaningless —
 * the card shows an empty bar and a fixed caption instead) or when the
 * amount is unconvertible (`amountMinor === null`). `0` when `totalMinor` is
 * zero or negative, avoiding NaN/Infinity on an empty or negative total.
 */
export function accountShareOfTotal(
  amountMinor: number | null,
  totalMinor: number,
  includedInTotal: boolean
): number | null {
  if (!includedInTotal || amountMinor === null) return null;
  if (totalMinor <= 0) return 0;
  return Math.max(0, Math.min(1, amountMinor / totalMinor));
}
