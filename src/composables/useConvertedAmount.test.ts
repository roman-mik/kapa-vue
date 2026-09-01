import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ref } from 'vue';
import type { FxRate } from '@roman-mik/kapa-core/pocket';
import type { Convertible } from './useConvertedAmount';
import { useSpaceStore } from '@/stores/space';
import { useConvertedAmount } from './useConvertedAmount';

const { listFxRates } = vi.hoisted(() => ({ listFxRates: vi.fn() }));

vi.mock('@roman-mik/kapa-core/core', () => ({ listFxRates }));

// 1 EUR = 117.23456789 RSD.
const RATES: FxRate[] = [
  {
    baseCurrency: 'EUR',
    quoteCurrency: 'RSD',
    rateE8: 11_723_456_789,
    rateDate: '2026-08-20',
  },
];

function account(overrides: Partial<Convertible> = {}): Convertible {
  return { id: 'a1', currency: 'EUR', amountMinor: 1000, ...overrides };
}

describe('useConvertedAmount', () => {
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
    vi.clearAllMocks();
    listFxRates.mockResolvedValue(
      RATES.map((r) => ({
        base_currency: r.baseCurrency,
        quote_currency: r.quoteCurrency,
        rate_e8: r.rateE8,
        rate_date: r.rateDate,
      }))
    );
  });

  it('fetches rates as-of today and converts a foreign-currency item', async () => {
    const items = ref<Convertible[]>([account()]);
    const { convertedMinor, spaceCurrencyAmount, unconvertible } = useConvertedAmount(items);
    await vi.waitFor(() => expect(convertedMinor(items.value[0])).toBe(1172));
    // 1000 EUR minor * rate_e8 / 1e8 = 1172 RSD minor.
    expect(spaceCurrencyAmount(items.value[0])).toBe(1172);
    expect(unconvertible.value).toHaveLength(0);
  });

  it('returns the native amount for a same-currency item', async () => {
    const items = ref<Convertible[]>([account({ currency: 'RSD', amountMinor: 500 })]);
    const { convertedMinor, spaceCurrencyAmount, unconvertible } = useConvertedAmount(items);
    await vi.waitFor(() => expect(listFxRates).toHaveBeenCalled());
    expect(convertedMinor(items.value[0])).toBeNull();
    expect(spaceCurrencyAmount(items.value[0])).toBe(500);
    expect(unconvertible.value).toHaveLength(0);
  });

  it('reports a foreign item with no covering rate as unconvertible', async () => {
    listFxRates.mockResolvedValue([]);
    const items = ref<Convertible[]>([account()]);
    const { convertedMinor, spaceCurrencyAmount, unconvertible } = useConvertedAmount(items);
    await vi.waitFor(() => expect(listFxRates).toHaveBeenCalled());
    expect(convertedMinor(items.value[0])).toBeNull();
    expect(spaceCurrencyAmount(items.value[0])).toBeNull();
    expect(unconvertible.value).toHaveLength(1);
  });

  it('rateFor returns the covering FxRate with its date for a foreign item', async () => {
    const items = ref<Convertible[]>([account()]);
    const { rateFor } = useConvertedAmount(items);
    await vi.waitFor(() => expect(listFxRates).toHaveBeenCalled());
    expect(rateFor(items.value[0])).toEqual({
      baseCurrency: 'EUR',
      quoteCurrency: 'RSD',
      rateE8: 11_723_456_789,
      rateDate: '2026-08-20',
    });
  });

  it('rateFor returns null for a same-currency item', async () => {
    const items = ref<Convertible[]>([account({ currency: 'RSD', amountMinor: 500 })]);
    const { rateFor } = useConvertedAmount(items);
    await vi.waitFor(() => expect(listFxRates).toHaveBeenCalled());
    expect(rateFor(items.value[0])).toBeNull();
  });

  it('rateFor returns null when no covering rate exists', async () => {
    listFxRates.mockResolvedValue([]);
    const items = ref<Convertible[]>([account()]);
    const { rateFor } = useConvertedAmount(items);
    await vi.waitFor(() => expect(listFxRates).toHaveBeenCalled());
    expect(rateFor(items.value[0])).toBeNull();
  });

  it('fxAsOf surfaces the newest snapshot date and a non-negative age', async () => {
    const items = ref<Convertible[]>([]);
    const { fxAsOf } = useConvertedAmount(items);
    await vi.waitFor(() => expect(listFxRates).toHaveBeenCalled());
    const asOf = fxAsOf();
    expect(asOf).not.toBeNull();
    expect(asOf!.date).toBe('2026-08-20');
    expect(asOf!.ageDays).toBeGreaterThanOrEqual(0);
  });

  it('fxAsOf returns null when no rates are loaded', async () => {
    listFxRates.mockResolvedValue([]);
    const items = ref<Convertible[]>([]);
    const { fxAsOf } = useConvertedAmount(items);
    await vi.waitFor(() => expect(listFxRates).toHaveBeenCalled());
    expect(fxAsOf()).toBeNull();
  });

  it('fxAsOf picks the newest rateDate across the loaded set', async () => {
    listFxRates.mockResolvedValue([
      {
        base_currency: 'EUR',
        quote_currency: 'RSD',
        rate_e8: 10_000_000_000,
        rate_date: '2026-08-10',
      },
      {
        base_currency: 'EUR',
        quote_currency: 'RSD',
        rate_e8: 11_723_456_789,
        rate_date: '2026-08-20',
      },
    ]);
    const items = ref<Convertible[]>([]);
    const { fxAsOf } = useConvertedAmount(items);
    await vi.waitFor(() => expect(listFxRates).toHaveBeenCalled());
    expect(fxAsOf()!.date).toBe('2026-08-20');
  });
});
