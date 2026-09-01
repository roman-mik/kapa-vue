// Confidence split for a projection's contributors. `confidence` is a column
// on income streams and obligations but is NOT carried on `LedgerEvent`, so
// the "3 estimates in this projection" surface counts source rows, never
// ledger events. Pure helper, unit-tested; no derivation in templates.

const CONFIRMED = 'confirmed';

/**
 * Whether a source row's `confidence` string describes an estimate rather than
 * a confirmed figure. `confirmed` is confirmed; `expected`/`uncertain` are
 * estimates; anything absent or unknown is treated as an estimate, since an
 * unset confidence is never a confirmed figure.
 */
export function isNonConfirmed(confidence: string | null | undefined): boolean {
  return confidence !== CONFIRMED;
}

/** Count of rows whose `confidence` is not `confirmed`. */
export function countNonConfirmed(rows: { confidence: string | null | undefined }[]): number {
  return rows.filter((row) => isNonConfirmed(row.confidence)).length;
}
