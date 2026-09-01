import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { PocketSummary } from '@/composables/usePocketHome';
import { useSpaceStore } from '@/stores/space';
import ExpenseEntryForm from './ExpenseEntryForm.vue';

vi.mock('@/composables/useCategories', () => ({
  useCategories: () => ({
    categories: ref([{ id: 'cat-1', name: 'Groceries', color: null }]),
    loading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
  }),
}));

function baseSummary(overrides: Partial<PocketSummary> = {}): PocketSummary {
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
    ...overrides,
  };
}

describe('ExpenseEntryForm', () => {
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
  });

  it('enters an amount via the keypad and shows it in the display', async () => {
    const wrapper = mount(ExpenseEntryForm, {
      props: { mode: 'add', summary: baseSummary(), rates: [] },
    });
    await wrapper.findAll('.keypad-key')[0]!.trigger('click'); // '1'
    await wrapper.findAll('.keypad-key')[1]!.trigger('click'); // '2'
    expect(wrapper.find('.amount-display').text()).toBe('12');
    wrapper.unmount();
  });

  it('truncates a fractional amount when switching to a zero-decimal currency', async () => {
    const wrapper = mount(ExpenseEntryForm, {
      props: { mode: 'add', summary: baseSummary(), rates: [] },
    });
    // RSD (the space default) is zero-decimal, so switch to EUR first to type a fraction.
    const eurButton = wrapper.findAll('.segmented button').find((b) => b.text() === 'EUR')!;
    await eurButton.trigger('click');

    await wrapper.findAll('.keypad-key')[0]!.trigger('click'); // '1'
    await wrapper.findAll('.keypad-key')[9]!.trigger('click'); // '.'
    await wrapper.findAll('.keypad-key')[10]!.trigger('click'); // '0'
    expect(wrapper.find('.amount-display').text()).toContain('.');

    const rsdButton = wrapper.findAll('.segmented button').find((b) => b.text() === 'RSD')!;
    await rsdButton.trigger('click');
    expect(wrapper.find('.amount-display').text()).not.toContain('.');
    wrapper.unmount();
  });

  it('only expands one chip field at a time', async () => {
    const wrapper = mount(ExpenseEntryForm, {
      props: { mode: 'add', summary: baseSummary(), rates: [] },
    });
    const chips = wrapper.findAll('.summary-chip');
    await chips[0]!.trigger('click');
    expect(wrapper.find('.chips').exists()).toBe(true);

    await wrapper.findAll('.summary-chip')[0]!.trigger('click');
    expect(wrapper.find('.chips').exists()).toBe(false);
    wrapper.unmount();
  });

  it('blocks submit and shows a local error for an empty amount', async () => {
    const wrapper = mount(ExpenseEntryForm, {
      props: { mode: 'add', summary: baseSummary(), rates: [] },
    });
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.find('.error').text()).toContain('valid amount');
    wrapper.unmount();
  });

  it('emits submit with the built payload and keepAdding flag per button in add mode', async () => {
    const wrapper = mount(ExpenseEntryForm, {
      props: { mode: 'add', summary: baseSummary(), rates: [] },
    });
    await wrapper.findAll('.keypad-key')[0]!.trigger('click'); // '1'
    await wrapper.findAll('.keypad-key')[1]!.trigger('click'); // '2'

    const buttons = wrapper.findAll('.actions button');
    expect(buttons).toHaveLength(2);
    await buttons[1]!.trigger('click'); // Save · keep adding

    const emitted = wrapper.emitted('submit');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]![1]).toEqual({ keepAdding: true });
    const payload = emitted![0]![0] as { amountMinor: number; currency: string };
    // RSD is zero-decimal, so "12" is 12 minor units, not 1200.
    expect(payload.amountMinor).toBe(12);
    wrapper.unmount();
  });

  it('renders only one Save button in edit mode', () => {
    const wrapper = mount(ExpenseEntryForm, {
      props: {
        mode: 'edit',
        summary: baseSummary(),
        rates: [],
        initialValues: {
          amountMinor: 1_000_00,
          currency: 'RSD',
          categoryId: null,
          note: null,
          date: '2026-09-01',
        },
      },
    });
    expect(wrapper.findAll('.actions button')).toHaveLength(1);
    wrapper.unmount();
  });

  it('renders the preview line from the summary/rates props', () => {
    const wrapper = mount(ExpenseEntryForm, {
      props: {
        mode: 'edit',
        summary: baseSummary(),
        rates: [],
        initialValues: {
          amountMinor: 1_000_00,
          currency: 'RSD',
          categoryId: null,
          note: null,
          date: '2026-09-01',
        },
      },
    });
    expect(wrapper.find('.hint').exists()).toBe(true);
    expect(wrapper.find('.hint').text()).toContain('left after this');
    wrapper.unmount();
  });

  it('reset() clears amount/note but can preserve category, currency, and date', async () => {
    const wrapper = mount(ExpenseEntryForm, {
      props: { mode: 'add', summary: baseSummary(), rates: [] },
    });
    await wrapper.findAll('.keypad-key')[0]!.trigger('click'); // '1'

    const vm = wrapper.vm as unknown as {
      reset: (opts?: {
        keepCategory?: boolean;
        keepCurrency?: boolean;
        keepDate?: boolean;
      }) => void;
    };
    vm.reset({ keepCategory: true, keepCurrency: true, keepDate: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.amount-display').text()).toBe('0');
    wrapper.unmount();
  });
});
