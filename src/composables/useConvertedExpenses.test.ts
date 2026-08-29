import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ref } from 'vue';
import { useSpaceStore } from '@/stores/space';
import { useConvertedExpenses } from './useConvertedExpenses';

const { listFxRates } = vi.hoisted(() => ({ listFxRates: vi.fn() }));

vi.mock('@roman-mik/kapa-core/core', () => ({ listFxRates }));

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// 1 EUR = 117.23456789 RSD, rate_e8 form as stored in core.fx_rates.
const RATES = [
  {
    base_currency: 'EUR',
    quote_currency: 'RSD',
    rate_e8: 11_723_456_789,
    rate_date: '2026-08-20',
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
    vi.clearAllMocks();
    listFxRates.mockResolvedValue(RATES);
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

  it('loads rates bounded by today in the space timezone on init', async () => {
    useConvertedExpenses(ref([]));
    await flush();
    expect(listFxRates).toHaveBeenCalledWith(expect.anything(), expect.any(String));
  });

  it('converts a foreign-currency expense at the rate covering its spent date', async () => {
    const { convertedMinor } = useConvertedExpenses(ref([expense()] as never[]));
    await flush();
    // 1000 EUR minor * rate_e8 / 1e8 = 1172.3456789, rounded to 1172 RSD minor.
    expect(convertedMinor(expense() as never)).toBe(1172);
  });

  it('returns null (nothing to display) for a same-currency expense', async () => {
    const expenses = ref([expense({ currency: 'RSD' })] as never[]);
    const { convertedMinor, isForeign, unconvertible } = useConvertedExpenses(expenses);
    await flush();
    expect(convertedMinor(expenses.value[0])).toBeNull();
    expect(isForeign(expenses.value[0])).toBe(false);
    expect(unconvertible.value).toHaveLength(0);
  });

  it('buckets a foreign expense with no covering rate as unconvertible', async () => {
    listFxRates.mockResolvedValue([
      // Rate starts after the expense was spent — nothing covers 2026-08-25.
      { base_currency: 'EUR', quote_currency: 'RSD', rate_e8: 1, rate_date: '2026-08-26' },
    ]);
    const expenses = ref([expense()] as never[]);
    const { convertedMinor, unconvertible } = useConvertedExpenses(expenses);
    await flush();
    expect(convertedMinor(expenses.value[0])).toBeNull();
    expect(unconvertible.value).toHaveLength(1);
  });
});
