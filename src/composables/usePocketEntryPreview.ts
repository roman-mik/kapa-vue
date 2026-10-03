import {
  convertToCurrency,
  remainingAfter,
  safeDaily,
  type Currency,
} from '@roman-mik/kapa-core/pocket';
import type { FxRate } from '@roman-mik/kapa-core/pocket';
import { computed, type ComputedRef, type Ref } from 'vue';
import type { PocketSummary } from '@/composables/usePocketHome';

export interface EntryDraft {
  amountMinor: number;
  currency: Currency;
  /** Zoned date key (YYYY-MM-DD) the expense is dated as of. */
  date: string;
}

export interface EntryPreviewExclusion {
  amountMinor: number;
  currency: Currency;
  date: string;
}

export interface EntryPreview {
  remainingAfterMinor: number;
  daysRemaining: number;
  safeDailyAfter: number;
}

/**
 * The single "left after this" arithmetic, extracted from AddExpenseView's
 * and EditExpenseView's previously-duplicated computeds. `exclude` is the
 * Edit-only case: the original row's converted contribution is added back to
 * `summary.remaining` before the proposed new amount is subtracted, so
 * editing previews as a *replacement*, not an additional charge.
 */
export function usePocketEntryPreview(
  draft: Ref<EntryDraft | null>,
  summary: Ref<PocketSummary | null>,
  rates: Ref<FxRate[]>,
  exclude?: Ref<EntryPreviewExclusion | null>
): ComputedRef<EntryPreview | null> {
  return computed(() => {
    const home = summary.value;
    const d = draft.value;
    if (!home || !d || !Number.isFinite(d.amountMinor) || d.amountMinor <= 0) return null;

    let baseRemaining = home.remaining;
    const excluded = exclude?.value;
    if (excluded) {
      const originalContribution = convertToCurrency(
        excluded.amountMinor,
        excluded.currency,
        home.currency,
        excluded.date,
        rates.value
      );
      if (originalContribution === undefined) return null;
      baseRemaining = home.remaining + originalContribution;
    }

    const converted = convertToCurrency(
      d.amountMinor,
      d.currency,
      home.currency,
      d.date,
      rates.value
    );
    if (converted === undefined) return null;

    const remainingAfterMinor = remainingAfter(baseRemaining, converted);
    return {
      remainingAfterMinor,
      daysRemaining: home.daysUntilReset,
      safeDailyAfter: safeDaily(remainingAfterMinor, home.daysUntilReset),
    };
  });
}
