import type { DryRunEffect } from '@/lib/horizon/dryRunProjection';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { buildProjection } from '@roman-mik/kapa-core/horizon';
import { spliceDraft } from '@/lib/horizon/dryRunProjection';
import { nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import EntrySheet from './EntrySheet.vue';

const {
  useAccounts,
  useIncomeStreams,
  useObligations,
  useOneOffEvents,
  usePlannedSpend,
  useEntryDryRun,
} = vi.hoisted(() => ({
  useAccounts: vi.fn(),
  useIncomeStreams: vi.fn(),
  useObligations: vi.fn(),
  useOneOffEvents: vi.fn(),
  usePlannedSpend: vi.fn(),
  useEntryDryRun: vi.fn(),
}));

vi.mock('@/composables/useAccounts', () => ({ useAccounts }));
vi.mock('@/composables/useIncomeStreams', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useIncomeStreams')>();
  return { ...actual, useIncomeStreams };
});
vi.mock('@/composables/useObligations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useObligations')>();
  return { ...actual, useObligations };
});
vi.mock('@/composables/useOneOffEvents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useOneOffEvents')>();
  return { ...actual, useOneOffEvents };
});
vi.mock('@/composables/usePlannedSpend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/usePlannedSpend')>();
  return { ...actual, usePlannedSpend };
});
vi.mock('@/composables/useEntryDryRun', () => ({ useEntryDryRun }));

const addIncomeStream = vi.fn();
const addObligation = vi.fn();
const addOneOff = vi.fn();
const addPlannedSpend = vi.fn();
const loadBaseline = vi.fn();
const preview = vi.fn();
const dryRunEffect = ref<DryRunEffect | null>(null);

function mountSheet(props: { open: boolean; defaultSide: 'in' | 'out' }) {
  return mount(EntrySheet, { props, attachTo: document.body });
}

describe('EntrySheet', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    dryRunEffect.value = null;

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

    useAccounts.mockReturnValue({
      accounts: ref([{ id: 'a1', name: 'Checking', currency: 'RSD' }]),
      refresh: vi.fn().mockResolvedValue(undefined),
    });
    useIncomeStreams.mockReturnValue({
      add: addIncomeStream.mockResolvedValue(undefined),
      calendar: ref(null),
      error: ref(null),
    });
    useObligations.mockReturnValue({ add: addObligation.mockResolvedValue(undefined) });
    useOneOffEvents.mockReturnValue({ add: addOneOff.mockResolvedValue(undefined) });
    usePlannedSpend.mockReturnValue({ add: addPlannedSpend.mockResolvedValue(undefined) });
    useEntryDryRun.mockReturnValue({
      loadBaseline: loadBaseline.mockResolvedValue(undefined),
      preview,
      effect: dryRunEffect,
      assessment: ref(undefined),
      loading: ref(false),
      error: ref(null),
      lifecycleIssues: ref([]),
      conversionIssues: ref([]),
      reportingCurrency: ref('RSD'),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  async function fillAmount(wrapper: ReturnType<typeof mountSheet>, value: string): Promise<void> {
    const input = document.body.querySelector<HTMLInputElement>('[data-autofocus]');
    if (!input) throw new Error('amount input not found');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await nextTick();
    void wrapper;
  }

  async function clickSave(): Promise<void> {
    const buttons = Array.from(document.body.querySelectorAll('button'));
    const save = buttons.find((b) => b.textContent?.includes('Save'));
    if (!save) throw new Error('save button not found');
    save.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    await nextTick();
  }

  it('suppresses numeric claims when a preview is incomplete and still permits saving', async () => {
    useEntryDryRun.mockReturnValue({
      loadBaseline,
      preview,
      effect: dryRunEffect,
      assessment: ref(undefined),
      loading: ref(false),
      error: ref(null),
      lifecycleIssues: ref([]),
      conversionIssues: ref([{ currency: 'EUR', amountMinor: 1000 }]),
      reportingCurrency: ref('RSD'),
    });
    dryRunEffect.value = {
      todayDeltaMinor: 0,
      troughBefore: null,
      troughAfter: null,
      troughChanged: false,
      lifecycleIssues: [],
      unconverted: [],
    };
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    await fillAmount(wrapper, '500');
    expect(document.body.textContent).toContain('Forecast incomplete');
    expect(document.body.querySelector('.effect')).toBeNull();
    await clickSave();
    expect(addOneOff).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('formats preview effects in reporting currency rather than entry currency', async () => {
    useSpaceStore().spaces[0]!.currency = 'EUR';
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    dryRunEffect.value = {
      todayDeltaMinor: -1000,
      troughBefore: null,
      troughAfter: null,
      troughChanged: false,
      lifecycleIssues: [],
      unconverted: [],
    };
    await nextTick();
    expect(document.body.querySelector('.effect')?.textContent).toContain('RSD');
    wrapper.unmount();
  });

  it('keeps a successful save separate from a failed preview refresh', async () => {
    const previewError = ref<string | null>(null);
    useEntryDryRun.mockReturnValue({
      loadBaseline,
      preview,
      effect: dryRunEffect,
      assessment: ref(undefined),
      loading: ref(false),
      error: previewError,
      lifecycleIssues: ref([]),
      conversionIssues: ref([]),
      reportingCurrency: ref('RSD'),
    });
    loadBaseline
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () => {
        previewError.value = 'offline';
      });
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    await fillAmount(wrapper, '500');
    await clickSave();
    expect(addOneOff).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('.error')).toBeNull();
    expect(document.body.textContent).toContain('Forecast unavailable');
    expect(document.body.querySelector<HTMLInputElement>('[data-autofocus]')?.value).toBe('');
    wrapper.unmount();
  });

  it('focuses the amount field when opened', async () => {
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    await nextTick();
    expect(document.activeElement?.hasAttribute('data-autofocus')).toBe(true);
    wrapper.unmount();
  });

  it('side=in one-time creates a dated receipt', async () => {
    const wrapper = mountSheet({ open: true, defaultSide: 'in' });
    await nextTick();
    await fillAmount(wrapper, '500');
    await clickSave();
    expect(addOneOff).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'in', amountMinor: 500 })
    );
    expect(addIncomeStream).not.toHaveBeenCalled();
    expect(addObligation).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('saves a receipt on the selected date exactly once in the projection', async () => {
    const wrapper = mountSheet({ open: true, defaultSide: 'in' });
    await nextTick();
    await fillAmount(wrapper, '500');
    const dateChip = Array.from(document.body.querySelectorAll('button.chip')).find((b) =>
      b.textContent?.includes('Today')
    );
    dateChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    const input = document.body.querySelector<HTMLInputElement>('input[type="date"]')!;
    input.value = '2026-10-10';
    input.dispatchEvent(new Event('input'));
    await nextTick();
    await clickSave();
    const value = addOneOff.mock.calls[0]![0];
    expect(value.date).toBe('2026-10-10');
    const result = buildProjection(
      spliceDraft(
        {
          accounts: [
            {
              id: 'a1',
              currency: 'RSD',
              current_balance_minor: 0,
              include_in_total: true,
              archived: false,
            },
          ],
          incomeStreams: [],
          obligations: [],
          oneOffEvents: [],
          plannedSpend: [],
          pocketSpend: { actuals: [], forward: [] },
          todayKey: '2026-10-03',
          range: { from: '2026-10-03', to: '2026-12-31' },
          reportingCurrency: 'RSD',
          rates: [],
          calendar: { workingWeekdays: [1, 2, 3, 4, 5], holidays: [] },
          eventOrder: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
        },
        { kind: 'oneOff', value }
      )
    );
    expect(result.value.events.map((e) => [e.date, e.amountMinor])).toEqual([['2026-10-10', 500]]);
    wrapper.unmount();
  });

  it('offers account setup and blocks save without accounts', async () => {
    useAccounts.mockReturnValue({
      accounts: ref([]),
      loading: ref(false),
      error: ref(null),
      refresh: vi.fn().mockResolvedValue(undefined),
    });
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    expect(document.body.textContent).toContain('Add an account');
    expect(document.body.querySelector('.setup-link')).not.toBeNull();
    await fillAmount(wrapper, '500');
    await clickSave();
    expect(addOneOff).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('returns to an enabled sheet after saving recurring income', async () => {
    useIncomeStreams.mockReturnValue({
      add: addIncomeStream,
      calendar: ref({ workingWeekdays: [1, 2, 3, 4, 5], holidays: [] }),
      error: ref(null),
    });
    const wrapper = mountSheet({ open: true, defaultSide: 'in' });
    await nextTick();
    await fillAmount(wrapper, '1000');
    const chip = Array.from(document.body.querySelectorAll('button.chip')).find((b) =>
      b.textContent?.includes('One-time')
    )!;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    const check = document.body.querySelector<HTMLInputElement>(
      '.chip-panel input[type="checkbox"]'
    )!;
    check.checked = true;
    check.dispatchEvent(new Event('change'));
    await nextTick();
    const name = document.body.querySelector<HTMLInputElement>('.form-card input[type="text"]')!;
    name.value = 'Salary';
    name.dispatchEvent(new Event('input'));
    await nextTick();
    document.body.querySelector('form')!.dispatchEvent(new Event('submit'));
    await flushPromises();
    await nextTick();
    expect(addIncomeStream).toHaveBeenCalledTimes(1);
    expect(
      Array.from(document.body.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Done'
      )?.disabled
    ).toBe(false);
    expect(document.body.querySelector('.form-card')).toBeNull();
    wrapper.unmount();
  });

  it('labels weekly planned input and rejects an invalid monthly cap', async () => {
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    await fillAmount(wrapper, '10');
    const chip = Array.from(document.body.querySelectorAll('button.chip')).find((b) =>
      b.textContent?.includes('Not planned')
    )!;
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    const check = document.body.querySelector<HTMLInputElement>(
      '.chip-panel input[type="checkbox"]'
    )!;
    check.checked = true;
    check.dispatchEvent(new Event('change'));
    await nextTick();
    const cadence = document.body.querySelector<HTMLSelectElement>('.chip-panel select')!;
    cadence.value = 'weekly';
    cadence.dispatchEvent(new Event('change'));
    await nextTick();
    expect(document.body.textContent).toContain('Amount per week (RSD)');
    const cap = document.body.querySelector<HTMLInputElement>('.chip-panel input[type="number"]')!;
    cap.value = '-1';
    cap.dispatchEvent(new Event('input'));
    await nextTick();
    await clickSave();
    expect(addPlannedSpend).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Monthly cap must');
    cap.value = '100';
    cap.dispatchEvent(new Event('input'));
    await nextTick();
    await clickSave();
    expect(addPlannedSpend).toHaveBeenCalledWith(
      expect.objectContaining({ dailyAmountMinor: 10, chargeCadence: 'weekly', capMinor: 100 })
    );
    wrapper.unmount();
  });

  it('side=out with neither Planned nor Recurring creates a one-off', async () => {
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    await fillAmount(wrapper, '500');
    await clickSave();
    expect(addOneOff).toHaveBeenCalledTimes(1);
    expect(addOneOff.mock.calls[0][0]).toMatchObject({ direction: 'out' });
    wrapper.unmount();
  });

  it('side=out with Recurring on creates an obligation', async () => {
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    const recurringChip = Array.from(document.body.querySelectorAll('button.chip')).find((b) =>
      b.textContent?.includes('One-time')
    );
    recurringChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    const checkbox = document.body.querySelector<HTMLInputElement>(
      '.chip-panel input[type="checkbox"]'
    );
    if (!checkbox) throw new Error('recurring checkbox not found');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    await nextTick();
    await fillAmount(wrapper, '500');
    await clickSave();
    expect(addObligation).toHaveBeenCalledTimes(1);
    expect(addOneOff).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('side=out with Planned on creates a planned spend', async () => {
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    const plannedChip = Array.from(document.body.querySelectorAll('button.chip')).find((b) =>
      b.textContent?.includes('Not planned')
    );
    plannedChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    const checkbox = document.body.querySelector<HTMLInputElement>(
      '.chip-panel input[type="checkbox"]'
    );
    if (!checkbox) throw new Error('planned checkbox not found');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    await nextTick();
    await fillAmount(wrapper, '500');
    await clickSave();
    expect(addPlannedSpend).toHaveBeenCalledTimes(1);
    expect(addObligation).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('save · keep adding clears the amount but keeps the side', async () => {
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    await fillAmount(wrapper, '500');
    await clickSave();
    const input = document.body.querySelector<HTMLInputElement>('[data-autofocus]');
    expect(input?.value).toBe('');
    // side is still "out" — the Out toggle segment stays marked active.
    const outSeg = Array.from(document.body.querySelectorAll('.seg')).find((b) =>
      b.textContent?.includes('Out')
    );
    expect(outSeg?.classList.contains('active')).toBe(true);
    wrapper.unmount();
  });

  it('a rejected add() surfaces an error and does not clear the amount', async () => {
    addOneOff.mockRejectedValueOnce(new Error('boom'));
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    await fillAmount(wrapper, '500');
    await clickSave();
    expect(document.body.querySelector('.error')?.textContent).toContain('boom');
    const input = document.body.querySelector<HTMLInputElement>('[data-autofocus]');
    expect(input?.value).toBe('500');
    wrapper.unmount();
  });

  it('chip expand-exclusivity: opening one chip closes the previously open one', async () => {
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    const chips = Array.from(document.body.querySelectorAll('button.chip'));
    const dateChip = chips.find((b) => b.textContent?.includes('Today'));
    const accountChip = chips.find((b) => b.textContent?.includes('Checking'));
    dateChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(document.body.querySelectorAll('.chip-panel')).toHaveLength(1);
    accountChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(document.body.querySelectorAll('.chip-panel')).toHaveLength(1);
    wrapper.unmount();
  });
});
