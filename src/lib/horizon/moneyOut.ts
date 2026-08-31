/**
 * The Money-out screen's grouped view model. Pure and testable — it takes the
 * three composables' derived rows (obligations with the month already
 * attached, the month's one-offs, planned spend with monthly totals), resolves
 * a category namespace and a due-date column for each, and groups them into
 * the one-list layout H20 specifies.
 *
 * Namespaces never merge: obligations and one-offs group under their
 * `spend_category` value; planned spend groups under its Pocket `category_id`.
 * A Pocket category named "Housing" stays its own bucket, distinct from the
 * spend_category Housing bucket — keyed `pocket:` vs `spend:`.
 */

export type MoneyOutKind = 'obligation' | 'oneOff' | 'plannedSpend';

export interface MoneyOutRow {
  kind: MoneyOutKind;
  id: string;
  name: string;
  /** The weighted category label this row sits under. */
  categoryLabel: string;
  /**
   * The due-date column: an actual date (`YYYY-MM-DD`) for obligations and
   * one-offs, the cadence label ("Daily"/"Weekly"/"Monthly") for planned
   * spend, which has no schedule, or `'—'` when an obligation has no
   * occurrence in the viewed month.
   */
  due: string;
  /** Sort key — the real date for dated rows, `null` for cadence rows. */
  dueDate: string | null;
  amountMinor: number;
  currency: string;
  /** One-offs only: whether the money flows in or out. */
  direction?: 'in' | 'out';
}

export type MoneyOutBucketNamespace = 'spendCategory' | 'pocketCategory';

export interface MoneyOutBucket {
  /** `spend:<value>` or `pocket:<category_id | ''>`. */
  key: string;
  namespace: MoneyOutBucketNamespace;
  label: string;
  rows: MoneyOutRow[];
}

export interface MoneyOutObligationInput {
  id: string;
  name: string;
  category: string;
  currency: string;
  monthlyMinor: number;
  /** Earliest due date within the viewed month, if any. */
  firstDueDate: string | null;
}

export interface MoneyOutOneOffInput {
  id: string;
  name: string;
  category: string;
  currency: string;
  amountMinor: number;
  date: string;
  direction: 'in' | 'out';
}

export interface MoneyOutPlannedInput {
  id: string;
  name: string;
  categoryId: string | null;
  currency: string;
  monthlyMinor: number;
  chargeCadence: string;
}

export interface MoneyOutLabels {
  /** `spend_category` value → display label (shared by obligations and one-offs). */
  spendCategory: Record<string, string>;
  /** `charge_cadence` value → display label, used as the planned-spend due column. */
  cadence: Record<string, string>;
  /** Pocket `category_id` (or `null` for uncategorized) → display label. */
  pocketCategory: (categoryId: string | null) => string;
}

export function buildMoneyOutBuckets(
  input: {
    obligations: MoneyOutObligationInput[];
    oneOffs: MoneyOutOneOffInput[];
    plannedSpend: MoneyOutPlannedInput[];
  },
  labels: MoneyOutLabels
): MoneyOutBucket[] {
  const expenses = new Map<string, MoneyOutRow[]>();
  const planned = new Map<string, MoneyOutRow[]>();

  for (const obligation of input.obligations) {
    const bucketKey = `spend:${obligation.category}`;
    const rows = expenses.get(bucketKey) ?? [];
    rows.push({
      kind: 'obligation',
      id: obligation.id,
      name: obligation.name,
      categoryLabel: labels.spendCategory[obligation.category] ?? obligation.category,
      due: obligation.firstDueDate ?? '—',
      dueDate: obligation.firstDueDate,
      amountMinor: obligation.monthlyMinor,
      currency: obligation.currency,
    });
    expenses.set(bucketKey, rows);
  }

  for (const event of input.oneOffs) {
    const bucketKey = `spend:${event.category}`;
    const rows = expenses.get(bucketKey) ?? [];
    rows.push({
      kind: 'oneOff',
      id: event.id,
      name: event.name,
      categoryLabel: labels.spendCategory[event.category] ?? event.category,
      due: event.date,
      dueDate: event.date,
      amountMinor: event.amountMinor,
      currency: event.currency,
      direction: event.direction,
    });
    expenses.set(bucketKey, rows);
  }

  for (const item of input.plannedSpend) {
    const bucketKey = `pocket:${item.categoryId ?? ''}`;
    const rows = planned.get(bucketKey) ?? [];
    rows.push({
      kind: 'plannedSpend',
      id: item.id,
      name: item.name,
      categoryLabel: labels.pocketCategory(item.categoryId),
      due: labels.cadence[item.chargeCadence] ?? item.chargeCadence,
      dueDate: null,
      amountMinor: item.monthlyMinor,
      currency: item.currency,
    });
    planned.set(bucketKey, rows);
  }

  const buckets: MoneyOutBucket[] = [
    ...[...expenses.entries()].map(([key, rows]) => ({
      key,
      namespace: 'spendCategory' as const,
      label: rows[0].categoryLabel,
      rows: sortRows(rows),
    })),
    ...[...planned.entries()].map(([key, rows]) => ({
      key,
      namespace: 'pocketCategory' as const,
      label: rows[0].categoryLabel,
      rows: sortRows(rows),
    })),
  ].sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));

  return buckets;
}

const NO_DATE = '9999-12-31';

/** Dated rows first (ascending), cadence rows after, then insertion order. */
function sortRows(rows: MoneyOutRow[]): MoneyOutRow[] {
  return [...rows].sort((a, b) =>
    (a.dueDate ?? NO_DATE) < (b.dueDate ?? NO_DATE)
      ? -1
      : (a.dueDate ?? NO_DATE) > (b.dueDate ?? NO_DATE)
        ? 1
        : 0
  );
}
