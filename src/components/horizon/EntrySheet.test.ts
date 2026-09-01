import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
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
const dryRunEffect = ref<null>(null);

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
    useIncomeStreams.mockReturnValue({ add: addIncomeStream.mockResolvedValue(undefined) });
    useObligations.mockReturnValue({ add: addObligation.mockResolvedValue(undefined) });
    useOneOffEvents.mockReturnValue({ add: addOneOff.mockResolvedValue(undefined) });
    usePlannedSpend.mockReturnValue({ add: addPlannedSpend.mockResolvedValue(undefined) });
    useEntryDryRun.mockReturnValue({
      loadBaseline: loadBaseline.mockResolvedValue(undefined),
      preview,
      effect: dryRunEffect,
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

  it('focuses the amount field when opened', async () => {
    const wrapper = mountSheet({ open: true, defaultSide: 'out' });
    await nextTick();
    await nextTick();
    expect(document.activeElement?.hasAttribute('data-autofocus')).toBe(true);
    wrapper.unmount();
  });

  it('side=in always creates an income stream', async () => {
    const wrapper = mountSheet({ open: true, defaultSide: 'in' });
    await nextTick();
    await fillAmount(wrapper, '500');
    await clickSave();
    expect(addIncomeStream).toHaveBeenCalledTimes(1);
    expect(addObligation).not.toHaveBeenCalled();
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
