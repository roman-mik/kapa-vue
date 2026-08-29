import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { ref } from 'vue';
import type { FxRate } from '@roman-mik/kapa-core/pocket';
import { useSpaceStore } from '@/stores/space';
import { useConvertedExpenses } from './useConvertedExpenses';

// 1 EUR = 117.23456789 RSD.
const RATES: FxRate[] = [
  {
    baseCurrency: 'EUR',
    quoteCurrency: 'RSD',
    rateE8: 11_723_456_789,
    rateDate: '2026-08-20',
  },
];

function expense(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'e1',
    amount_minor: 1000,
    currency: 'EUR',
    spent_at: '2026-08-25T10:00:00Z',
    ...overrides,
  };
}

describe('useConvertedExpenses', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const space = useSpaceStore();
    space.spaces = [
      {
        created_at: '2026-08-01T00:00:00Z',
        currency: 'RSD',
        id: 's1',
        name: 'Home',
        timezone: 'Europe/Belgrade',
      },
    ];
    space.currentSpaceId = 's1';
  });

  it('converts a foreign-currency expense at the rate covering its spent date', () => {
    const { convertedMinor } = useConvertedExpenses(ref([expense()] as never[]), ref(RATES));
    // 1000 EUR minor * rate_e8 / 1e8 = 1172.3456789, rounded to 1172 RSD minor.
    expect(convertedMinor(expense() as never)).toBe(1172);
  });

  it('returns null (nothing to display) for a same-currency expense', () => {
    const expenses = ref([expense({ currency: 'RSD' })] as never[]);
    const { convertedMinor, isForeign, unconvertible } = useConvertedExpenses(expenses, ref(RATES));
    expect(convertedMinor(expenses.value[0])).toBeNull();
    expect(isForeign(expenses.value[0])).toBe(false);
    expect(unconvertible.value).toHaveLength(0);
  });

  it('buckets a foreign expense with no covering rate as unconvertible', () => {
    const rates = ref<FxRate[]>([
      // Rate starts after the expense was spent — nothing covers 2026-08-25.
      { baseCurrency: 'EUR', quoteCurrency: 'RSD', rateE8: 1, rateDate: '2026-08-26' },
    ]);
    const expenses = ref([expense()] as never[]);
    const { convertedMinor, unconvertible } = useConvertedExpenses(expenses, rates);
    expect(convertedMinor(expenses.value[0])).toBeNull();
    expect(unconvertible.value).toHaveLength(1);
  });

  it('reacts to rates arriving after the composable is created', () => {
    const rates = ref<FxRate[]>([]);
    const expenses = ref([expense()] as never[]);
    const { convertedMinor, unconvertible } = useConvertedExpenses(expenses, rates);
    expect(convertedMinor(expenses.value[0])).toBeNull();
    expect(unconvertible.value).toHaveLength(1);

    rates.value = RATES;
    expect(convertedMinor(expenses.value[0])).toBe(1172);
    expect(unconvertible.value).toHaveLength(0);
  });
});
