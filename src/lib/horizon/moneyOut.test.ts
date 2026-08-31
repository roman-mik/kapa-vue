import { describe, expect, it } from 'vite-plus/test';
import {
  buildMoneyOutBuckets,
  type MoneyOutLabels,
  type MoneyOutObligationInput,
  type MoneyOutOneOffInput,
  type MoneyOutPlannedInput,
} from './moneyOut';

const LABELS: MoneyOutLabels = {
  spendCategory: {
    housing: 'Housing',
    insurance: 'Insurance',
    transport: 'Transport',
    other: 'Other',
    gift: 'Gifts',
  },
  cadence: { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' },
  pocketCategory: (id) => (id === 'food' ? 'Food' : 'Uncategorized'),
};

const RENT: MoneyOutObligationInput = {
  id: 'obl-1',
  name: 'Rent',
  category: 'housing',
  currency: 'GBP',
  monthlyMinor: 120000,
  firstDueDate: '2026-09-01',
};

const INSURANCE: MoneyOutObligationInput = {
  id: 'obl-2',
  name: 'Home insurance',
  category: 'insurance',
  currency: 'GBP',
  monthlyMinor: 2500,
  firstDueDate: '2026-09-30',
};

const NO_DATE_OBLIGATION: MoneyOutObligationInput = {
  id: 'obl-3',
  name: 'Car tax',
  category: 'transport',
  currency: 'GBP',
  monthlyMinor: 1500,
  firstDueDate: null,
};

const GIFT_IN: MoneyOutOneOffInput = {
  id: 'oneoff-1',
  name: 'Birthday gift in',
  category: 'gift',
  currency: 'GBP',
  amountMinor: 5000,
  date: '2026-09-12',
  direction: 'in',
};

const MOVING_OUT: MoneyOutOneOffInput = {
  id: 'oneoff-2',
  name: 'Moving van',
  category: 'other',
  currency: 'GBP',
  amountMinor: 30000,
  date: '2026-09-05',
  direction: 'out',
};

const EATING_OUT: MoneyOutPlannedInput = {
  id: 'ps-1',
  name: 'Eating out',
  categoryId: 'food',
  currency: 'GBP',
  monthlyMinor: 18000,
  chargeCadence: 'weekly',
};

const SUBSCRIPTION: MoneyOutPlannedInput = {
  id: 'ps-2',
  name: 'Streaming',
  categoryId: null,
  currency: 'GBP',
  monthlyMinor: 1000,
  chargeCadence: 'monthly',
};

describe('buildMoneyOutBuckets', () => {
  it('merges obligations, one-offs and planned spend into one category-grouped list', () => {
    const buckets = buildMoneyOutBuckets(
      {
        obligations: [RENT, INSURANCE],
        oneOffs: [GIFT_IN, MOVING_OUT],
        plannedSpend: [EATING_OUT, SUBSCRIPTION],
      },
      LABELS
    );

    expect(buckets.map((b) => b.label)).toEqual([
      'Food',
      'Gifts',
      'Housing',
      'Insurance',
      'Other',
      'Uncategorized',
    ]);
  });

  it('groups obligations and one-offs under spend_category buckets', () => {
    const buckets = buildMoneyOutBuckets(
      { obligations: [RENT], oneOffs: [MOVING_OUT, GIFT_IN], plannedSpend: [] },
      LABELS
    );

    const housing = buckets.find((b) => b.key === 'spend:housing');
    expect(housing).toBeDefined();
    expect(housing!.rows.map((r) => [r.kind, r.name])).toEqual([['obligation', 'Rent']]);

    const gifts = buckets.find((b) => b.key === 'spend:gift');
    expect(gifts!.rows.map((r) => [r.kind, r.name])).toEqual([['oneOff', 'Birthday gift in']]);

    const other = buckets.find((b) => b.key === 'spend:other');
    expect(other!.rows.map((r) => [r.kind, r.name])).toEqual([['oneOff', 'Moving van']]);
  });

  it('sorts dated rows ascending within a bucket and keeps cadence rows after', () => {
    const buckets = buildMoneyOutBuckets(
      {
        obligations: [INSURANCE, NO_DATE_OBLIGATION],
        oneOffs: [MOVING_OUT],
        plannedSpend: [EATING_OUT],
      },
      LABELS
    );

    const other = buckets.find((b) => b.key === 'spend:other');
    expect(other!.rows.map((r) => r.due)).toEqual(['2026-09-05']);

    const insurance = buckets.find((b) => b.key === 'spend:insurance');
    expect(insurance!.rows.map((r) => r.due)).toEqual(['2026-09-30']);

    // Planned-spend bucket rows carry cadence labels in the due column.
    const food = buckets.find((b) => b.key === 'pocket:food');
    expect(food!.rows).toHaveLength(1);
    expect(food!.rows[0].due).toBe('Weekly');
    expect(food!.rows[0].dueDate).toBeNull();
  });

  it('mixed-bucket ordering by date and date-less sorted last', () => {
    const buckets = buildMoneyOutBuckets(
      { obligations: [NO_DATE_OBLIGATION, RENT], oneOffs: [], plannedSpend: [] },
      LABELS
    );

    const transport = buckets.find((b) => b.key === 'spend:transport');
    const housing = buckets.find((b) => b.key === 'spend:housing');
    // transport bucket has no dated rows: obligation with no occurrence.
    expect(transport!.rows[0].due).toBe('—');
    expect(housing!.rows[0].due).toBe('2026-09-01');
  });

  it('never merges a Pocket category with a same-named spend_category bucket', () => {
    const buckets = buildMoneyOutBuckets(
      {
        obligations: [RENT],
        oneOffs: [],
        plannedSpend: [{ ...SUBSCRIPTION, name: 'Housing fund', categoryId: 'food' }],
      },
      LABELS
    );

    const keys = buckets.map((b) => b.key);
    expect(keys).toContain('spend:housing');
    expect(keys).toContain('pocket:food');
    expect(keys.filter((k) => k.includes('housing'))).toEqual(['spend:housing']);
  });

  it('derives an obligation due column from its first occurrence and falls back to —', () => {
    const buckets = buildMoneyOutBuckets(
      { obligations: [RENT, NO_DATE_OBLIGATION], oneOffs: [], plannedSpend: [] },
      LABELS
    );

    const housing = buckets.find((b) => b.key === 'spend:housing');
    expect(housing!.rows[0].due).toBe('2026-09-01');
    expect(housing!.rows[0].dueDate).toBe('2026-09-01');
    expect(housing!.rows[0].amountMinor).toBe(120000);
  });

  it('passes through one-off direction and amount', () => {
    const buckets = buildMoneyOutBuckets(
      { obligations: [], oneOffs: [GIFT_IN, MOVING_OUT], plannedSpend: [] },
      LABELS
    );

    const gift = buckets.find((b) => b.key === 'spend:gift');
    expect(gift!.rows[0].direction).toBe('in');
    expect(gift!.rows[0].amountMinor).toBe(5000);
    const other = buckets.find((b) => b.key === 'spend:other');
    expect(other!.rows[0].direction).toBe('out');
  });
});
