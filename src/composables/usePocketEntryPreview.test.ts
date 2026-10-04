import { ref } from 'vue';
import { describe, expect, it } from 'vite-plus/test';
import type { PocketSummary } from '@/composables/usePocketHome';
import {
  usePocketEntryPreview,
  type EntryDraft,
  type EntryPreviewExclusion,
} from './usePocketEntryPreview';
import { safeDaily, type FxRate } from '@roman-mik/kapa-core/pocket';

function baseSummary(overrides: Partial<PocketSummary> = {}): PocketSummary {
  return {
    month: '2026-09',
    currency: 'RSD',
    totalSpent: 34_180_00,
    totalUnconverted: [],
    spent: 34_180_00,
    remaining: 65_820_00,
    safeDaily: 3_657_00,
    paceGap: 5_820_00,
    projection: 85_450_00,
    spentPct: 34,
    overspend: 0,
    categoryBreakdown: [],
    dailyTotals: [],
    dailyCapReference: 0,
    unconverted: [],
    todayExpenses: [],
    daysUntilReset: 18,
    home: { kind: 'in-budget', nudge: false, showPace: true, showProjection: true },
    ...overrides,
  };
}

const RATES: FxRate[] = [
  { baseCurrency: 'EUR', quoteCurrency: 'RSD', rateE8: 117_000_000_00, rateDate: '2026-09-01' },
];

describe('usePocketEntryPreview', () => {
  it('returns null when summary is missing', () => {
    const draft = ref<EntryDraft | null>({
      amountMinor: 1000,
      currency: 'RSD',
      date: '2026-09-01',
    });
    const summary = ref<PocketSummary | null>(null);
    const rates = ref<FxRate[]>([]);
    expect(usePocketEntryPreview(draft, summary, rates).value).toBeNull();
  });

  it('returns null when the draft is missing or the amount is invalid', () => {
    const summary = ref(baseSummary());
    const rates = ref<FxRate[]>([]);
    expect(usePocketEntryPreview(ref(null), summary, rates).value).toBeNull();
    expect(
      usePocketEntryPreview(
        ref<EntryDraft | null>({ amountMinor: 0, currency: 'RSD', date: '2026-09-01' }),
        summary,
        rates
      ).value
    ).toBeNull();
  });

  it('returns null when no fx rate covers the draft currency', () => {
    const draft = ref<EntryDraft | null>({
      amountMinor: 1000,
      currency: 'EUR',
      date: '2026-09-01',
    });
    const summary = ref(baseSummary());
    const rates = ref<FxRate[]>([]);
    expect(usePocketEntryPreview(draft, summary, rates).value).toBeNull();
  });

  it('computes remaining-after for a same-currency draft with no exclusion', () => {
    const draft = ref<EntryDraft | null>({
      amountMinor: 5_000_00,
      currency: 'RSD',
      date: '2026-09-01',
    });
    const summary = ref(baseSummary());
    const rates = ref<FxRate[]>([]);
    const preview = usePocketEntryPreview(draft, summary, rates);
    expect(preview.value).toEqual({
      remainingAfterMinor: 60_820_00,
      daysRemaining: 18,
      safeDailyAfter: safeDaily(60_820_00, 18),
    });
  });

  it('adds the original contribution back before subtracting the new amount when excluding', () => {
    const draft = ref<EntryDraft | null>({
      amountMinor: 3_000_00,
      currency: 'RSD',
      date: '2026-09-01',
    });
    const summary = ref(baseSummary());
    const rates = ref<FxRate[]>([]);
    const exclude = ref<EntryPreviewExclusion | null>({
      amountMinor: 2_000_00,
      currency: 'RSD',
      date: '2026-09-01',
    });
    const preview = usePocketEntryPreview(draft, summary, rates, exclude);
    // remaining (65_820_00) + original (2_000_00) - new (3_000_00)
    expect(preview.value?.remainingAfterMinor).toBe(64_820_00);
  });

  it('returns null when the excluded original has no covering fx rate', () => {
    const draft = ref<EntryDraft | null>({
      amountMinor: 1000,
      currency: 'RSD',
      date: '2026-09-01',
    });
    const summary = ref(baseSummary());
    const rates = ref<FxRate[]>([]);
    const exclude = ref<EntryPreviewExclusion | null>({
      amountMinor: 1000,
      currency: 'EUR',
      date: '2026-09-01',
    });
    expect(usePocketEntryPreview(draft, summary, rates, exclude).value).toBeNull();
  });

  it('converts a foreign-currency draft using the supplied rates', () => {
    const draft = ref<EntryDraft | null>({
      amountMinor: 100_00,
      currency: 'EUR',
      date: '2026-09-01',
    });
    const summary = ref(baseSummary());
    const preview = usePocketEntryPreview(draft, summary, ref(RATES));
    expect(preview.value).not.toBeNull();
    expect(preview.value!.remainingAfterMinor).toBeLessThan(65_820_00);
  });
});

it('does not charge outside-cap missing-FX spending to the allowance', () => {
  const draft = ref<EntryDraft | null>({
    amountMinor: 300,
    currency: 'USD',
    date: '2026-09-01',
    countsTowardCap: false,
  });
  const summary = ref(baseSummary({ remaining: 350 }));
  const preview = usePocketEntryPreview(draft, summary, ref([]));
  expect(preview.value?.remainingAfterMinor).toBe(350);
});
it.each([
  [false, true, 250],
  [true, false, 650],
  [false, false, 350],
  [true, true, 550],
])('replaces eligibility %s with %s without charging twice', (oldCounts, newCounts, expected) => {
  const draft = ref<EntryDraft | null>({
    amountMinor: 100,
    currency: 'RSD',
    date: '2026-09-01',
    countsTowardCap: newCounts,
  });
  const original = ref<EntryPreviewExclusion | null>({
    amountMinor: 300,
    currency: 'RSD',
    date: '2026-09-01',
    countsTowardCap: oldCounts,
  });
  expect(
    usePocketEntryPreview(draft, ref(baseSummary({ remaining: 350 })), ref([]), original).value
      ?.remainingAfterMinor
  ).toBe(expected);
});
it('does not restore a prior-month expense into this month allowance', () => {
  const draft = ref<EntryDraft | null>({ amountMinor: 100, currency: 'RSD', date: '2026-09-01' });
  const original = ref<EntryPreviewExclusion | null>({
    amountMinor: 300,
    currency: 'USD',
    date: '2026-08-31',
  });
  expect(
    usePocketEntryPreview(draft, ref(baseSummary({ remaining: 350 })), ref([]), original).value
      ?.remainingAfterMinor
  ).toBe(250);
});
