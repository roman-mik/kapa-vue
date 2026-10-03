import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { usePocketEntrySheet } from '@/composables/usePocketEntrySheet';
import PocketEntrySheet from './PocketEntrySheet.vue';

const { useExpenses, usePocketHome, useToast } = vi.hoisted(() => ({
  useExpenses: vi.fn(),
  usePocketHome: vi.fn(),
  useToast: vi.fn(),
}));

vi.mock('@/composables/useExpenses', () => ({ useExpenses }));
vi.mock('@/composables/usePocketHome', () => ({ usePocketHome }));
vi.mock('@/composables/useToast', () => ({ useToast }));
vi.mock('@/composables/useCategories', () => ({
  useCategories: () => ({
    categories: ref([]),
    loading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
  }),
}));

function baseSummary() {
  return {
    month: '2026-09',
    currency: 'RSD',
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
  };
}

const add = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

function mountSheet() {
  return mount(PocketEntrySheet, { attachTo: document.body });
}

function pressKeypadDigit(digit: string): void {
  const key = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.keypad-key')).find(
    (b) => b.textContent === digit
  );
  key?.click();
}

describe('PocketEntrySheet', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const space = useSpaceStore();
    space.spaces = [
      {
        id: 'sp1',
        name: 'Home',
        currency: 'RSD',
        timezone: 'Europe/Belgrade',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    space.currentSpaceId = 'sp1';

    vi.clearAllMocks();
    usePocketEntrySheet().close();

    useExpenses.mockReturnValue({ add: add.mockResolvedValue(undefined) });
    usePocketHome.mockReturnValue({ summary: ref(baseSummary()), rates: ref([]) });
    useToast.mockReturnValue({ success: toastSuccess, error: toastError });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the sheet open when usePocketEntrySheet().open() is called, prefilled', async () => {
    const wrapper = mountSheet();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    usePocketEntrySheet().open({
      prefill: { amountMinor: 500, currency: 'RSD', categoryId: null, note: 'Coffee' },
    });
    await wrapper.vm.$nextTick();

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.querySelector('.amount-display')?.textContent).toBe('500');
    wrapper.unmount();
  });

  it('submits without keepAdding calls add() and closes the sheet', async () => {
    const wrapper = mountSheet();
    usePocketEntrySheet().open();
    await wrapper.vm.$nextTick();

    pressKeypadDigit('1');
    await wrapper.vm.$nextTick();
    document.body.querySelector<HTMLButtonElement>('.actions button')?.click();

    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(add).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith('Expense added');
    expect(usePocketEntrySheet().isOpen.value).toBe(false);
    wrapper.unmount();
  });

  it('submits with keepAdding calls add() then resets the form and stays open', async () => {
    const wrapper = mountSheet();
    usePocketEntrySheet().open();
    await wrapper.vm.$nextTick();

    pressKeypadDigit('1');
    await wrapper.vm.$nextTick();
    const buttons = document.body.querySelectorAll<HTMLButtonElement>('.actions button');
    buttons[1]?.click(); // Save · keep adding

    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(add).toHaveBeenCalledTimes(1);
    expect(usePocketEntrySheet().isOpen.value).toBe(true);
    expect(document.body.querySelector('.amount-display')?.textContent).toBe('0');
    wrapper.unmount();
  });

  it('surfaces a thrown error via submitError without closing the sheet', async () => {
    add.mockRejectedValueOnce(new Error('network down'));
    const wrapper = mountSheet();
    usePocketEntrySheet().open();
    await wrapper.vm.$nextTick();

    pressKeypadDigit('1');
    await wrapper.vm.$nextTick();
    document.body.querySelector<HTMLButtonElement>('.actions button')?.click();

    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(usePocketEntrySheet().isOpen.value).toBe(true);
    expect(document.body.querySelector('.error')?.textContent).toContain('network down');
    wrapper.unmount();
  });
});
