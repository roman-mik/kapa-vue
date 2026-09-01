import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ref } from 'vue';
import { useSpaceStore } from '@/stores/space';
import { useEntrySheet } from '@/composables/useEntrySheet';
import MoneyView from './MoneyView.vue';
import MoneyInView from './MoneyInView.vue';
import MoneyOutView from './MoneyOutView.vue';

const {
  useIncomeStreams,
  useObligations,
  useOneOffEvents,
  usePlannedSpend,
  useAccounts,
  useCategories,
  useConvertedAmount,
  useViewport,
} = vi.hoisted(() => ({
  useIncomeStreams: vi.fn(),
  useObligations: vi.fn(),
  useOneOffEvents: vi.fn(),
  usePlannedSpend: vi.fn(),
  useAccounts: vi.fn(),
  useCategories: vi.fn(),
  useConvertedAmount: vi.fn(),
  useViewport: vi.fn(),
}));

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
vi.mock('@/composables/useAccounts', () => ({ useAccounts }));
vi.mock('@/composables/useCategories', () => ({ useCategories }));
vi.mock('@/composables/useConvertedAmount', () => ({ useConvertedAmount }));
vi.mock('@/composables/useViewport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/composables/useViewport')>();
  return { ...actual, useViewport };
});

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/horizon/money', name: 'horizon-money', component: MoneyView },
      { path: '/horizon/money-in', name: 'horizon-money-in', component: MoneyView },
      { path: '/horizon/money-out', name: 'horizon-money-out', component: MoneyView },
    ],
  });
}

function setDesktop(value: boolean): void {
  useViewport.mockReturnValue({ isDesktop: ref(value) });
}

function convertedAmountMock() {
  return {
    spaceCurrency: ref('RSD'),
    rates: ref([]),
    loading: ref(false),
    error: ref(null),
    isForeign: () => false,
    rateFor: () => null,
    fxAsOf: () => ({ date: '2026-08-29', ageDays: 1 }),
    convertedMinor: () => null,
    spaceCurrencyAmount: (item: { amountMinor: number }) => item.amountMinor,
    unconvertible: ref([]),
  };
}

const fixedStream = {
  id: 's1',
  name: 'Salary',
  kind: 'fixed',
  currency: 'RSD',
  account_id: 'a1',
  taxable: false,
  start_date: '2026-08-01',
  confidence: 'confirmed',
  recurrence: 'recurring',
  earning_period_kind: 'monthly',
  fixed_amount_minor: 500000,
  hourly_rate_minor: null,
  hours_per_day_e2: null,
  schedules: [{ id: 'sc1', kind: 'dayOfMonth', day_of_month: 15, lag_days: 0 }],
  updated_at: '2026-08-01T00:00:00Z',
  monthlyMinor: 500000,
  occurrences: [{ date: '2026-09-15', shifted: false }],
};

const oneOffStream = {
  ...fixedStream,
  id: 's3',
  name: 'Tax refund',
  recurrence: 'oneOff',
  monthlyMinor: 100000,
};

const hourlyStream = {
  id: 's2',
  name: 'Freelance',
  kind: 'hourly',
  currency: 'RSD',
  account_id: 'a1',
  taxable: false,
  start_date: '2026-08-01',
  confidence: 'expected',
  recurrence: 'recurring',
  earning_period_kind: 'monthly',
  fixed_amount_minor: null,
  hourly_rate_minor: 2000,
  hours_per_day_e2: 800,
  schedules: [{ id: 'sc2', kind: 'dayOfMonth', day_of_month: 15, lag_days: 0 }],
  updated_at: '2026-08-01T00:00:00Z',
  monthlyMinor: 320000,
  occurrences: [{ date: '2026-09-15', shifted: false }],
};

const obligation = {
  id: 'o1',
  name: 'Rent',
  category: 'housing',
  currency: 'RSD',
  account_id: 'a1',
  amount_minor: 120000,
  start_date: '2026-08-01',
  updated_at: '2026-08-01T00:00:00Z',
  schedules: [{ id: 'os1', kind: 'dayOfMonth', day_of_month: 1 }],
  monthlyMinor: 120000,
  occurrences: [{ date: '2026-09-01', shifted: false, periodLabel: 'Sep' }],
};

const oneOffEvent = {
  id: 'e1',
  name: 'Gift',
  category: 'gift',
  currency: 'RSD',
  account_id: 'a1',
  date: '2026-09-10',
  amount_minor: 5000,
  direction: 'in',
};

const plannedSpend = {
  id: 'p1',
  name: 'Groceries',
  category_id: null,
  currency: 'RSD',
  charge_cadence: 'weekly',
  monthlyMinor: 30000,
  updated_at: '2026-08-01T00:00:00Z',
};

function mockMoneyInComposables(): void {
  useIncomeStreams.mockReturnValue({
    streamsWithMonth: ref([fixedStream, oneOffStream, hourlyStream]),
    convertibles: ref([]),
    month: ref('2026-09'),
    calendar: ref({ workingWeekdays: [1, 2, 3, 4, 5], holidays: [] }),
    loading: ref(false),
    error: ref(null),
    add: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    archive: vi.fn().mockResolvedValue(undefined),
  });
  useAccounts.mockReturnValue({
    accounts: ref([{ id: 'a1', name: 'Checking', archived: false }]),
    loading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  });
  useConvertedAmount.mockImplementation(convertedAmountMock);
}

function mockMoneyOutComposables(): void {
  useObligations.mockReturnValue({
    obligationsWithMonth: ref([obligation]),
    convertibles: ref([]),
    nonConfirmedCount: ref(0),
    month: ref('2026-09'),
    calendar: ref({ workingWeekdays: [1, 2, 3, 4, 5], holidays: [] }),
    loading: ref(false),
    error: ref(null),
    add: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    archive: vi.fn().mockResolvedValue(undefined),
  });
  useOneOffEvents.mockReturnValue({
    monthOneOffs: ref([oneOffEvent]),
    convertibles: ref([]),
    loading: ref(false),
    error: ref(null),
    add: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  });
  usePlannedSpend.mockReturnValue({
    itemsWithMonth: ref([plannedSpend]),
    convertibles: ref([]),
    month: ref('2026-09'),
    loading: ref(false),
    error: ref(null),
    add: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    archive: vi.fn().mockResolvedValue(undefined),
  });
  useAccounts.mockReturnValue({
    accounts: ref([{ id: 'a1', name: 'Checking', archived: false }]),
    loading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  });
  useCategories.mockReturnValue({
    categories: ref([]),
    loading: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    add: vi.fn(),
    rename: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    setColor: vi.fn(),
  });
  useConvertedAmount.mockImplementation(convertedAmountMock);
}

beforeEach(() => {
  setActivePinia(createPinia());
  const space = useSpaceStore();
  space.spaces = [{ id: 'sp1', currency: 'RSD', timezone: 'UTC' } as never];
  space.currentSpaceId = 'sp1';
  mockMoneyInComposables();
  mockMoneyOutComposables();
});

afterEach(() => {
  vi.clearAllMocks();
});

const stubs = {
  MoneyInView: { template: '<div class="in-panel-stub" />' },
  MoneyOutView: { template: '<div class="out-panel-stub" />' },
};

describe('MoneyView — side derivation and toggle', () => {
  it('renders the In panel on horizon-money-in', async () => {
    setDesktop(false);
    const router = makeRouter();
    await router.push({ name: 'horizon-money-in' });
    await router.isReady();
    const wrapper = mount(MoneyView, { global: { plugins: [router], stubs } });
    expect(wrapper.find('.in-panel-stub').exists()).toBe(true);
    expect(wrapper.find('.out-panel-stub').exists()).toBe(false);
    // The toggle only lives on the phone `money` route.
    expect(wrapper.find('.side-toggle').exists()).toBe(false);
  });

  it('renders the Out panel on horizon-money-out', async () => {
    setDesktop(false);
    const router = makeRouter();
    await router.push({ name: 'horizon-money-out' });
    await router.isReady();
    const wrapper = mount(MoneyView, { global: { plugins: [router], stubs } });
    expect(wrapper.find('.out-panel-stub').exists()).toBe(true);
    expect(wrapper.find('.in-panel-stub').exists()).toBe(false);
  });

  it('defaults to the In panel on the phone `money` route with no query', async () => {
    setDesktop(false);
    const router = makeRouter();
    await router.push({ name: 'horizon-money' });
    await router.isReady();
    const wrapper = mount(MoneyView, { global: { plugins: [router], stubs } });
    expect(wrapper.find('.in-panel-stub').exists()).toBe(true);
  });

  it('deep-links to the Out panel via ?side=out', async () => {
    setDesktop(false);
    const router = makeRouter();
    await router.push({ name: 'horizon-money', query: { side: 'out' } });
    await router.isReady();
    const wrapper = mount(MoneyView, { global: { plugins: [router], stubs } });
    expect(wrapper.find('.out-panel-stub').exists()).toBe(true);
  });

  it('keeps the toggle in sync with the query on the phone route', async () => {
    setDesktop(false);
    const router = makeRouter();
    await router.push({ name: 'horizon-money' });
    await router.isReady();
    const wrapper = mount(MoneyView, { global: { plugins: [router], stubs } });

    expect(wrapper.find('.in-panel-stub').exists()).toBe(true);
    const outButton = wrapper.findAll('.seg').find((b) => b.text() === 'Out');
    await outButton!.trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.query.side).toBe('out');
    expect(wrapper.find('.out-panel-stub').exists()).toBe(true);
  });

  it('hides the toggle on desktop', async () => {
    setDesktop(true);
    const router = makeRouter();
    await router.push({ name: 'horizon-money' });
    await router.isReady();
    const wrapper = mount(MoneyView, { global: { plugins: [router], stubs } });
    expect(wrapper.find('.side-toggle').exists()).toBe(false);
  });
});

describe('MoneyInView', () => {
  it('shows an "Add" trigger on desktop that opens the entry sheet defaulting to In', async () => {
    useEntrySheet().close();
    const wrapper = mount(MoneyInView, { props: { isDesktop: true } });
    const addButton = wrapper.findAll('button').find((b) => b.text() === 'Add');
    expect(addButton).toBeTruthy();
    await addButton!.trigger('click');
    const sheet = useEntrySheet();
    expect(sheet.isOpen.value).toBe(true);
    expect(sheet.defaultSide.value).toBe('in');
  });

  it('hides the "Add" trigger on phone', () => {
    const wrapper = mount(MoneyInView, { props: { isDesktop: false } });
    expect(wrapper.findAll('button').find((b) => b.text() === 'Add')).toBeUndefined();
  });

  it('filters streams by kind', async () => {
    const wrapper = mount(MoneyInView);
    expect(wrapper.text()).toContain('Salary');
    expect(wrapper.text()).toContain('Tax refund');

    const oneOffTab = wrapper.findAll('.kind-filter .seg').find((b) => b.text() === 'One-off');
    await oneOffTab!.trigger('click');

    expect(wrapper.text()).not.toContain('Salary');
    expect(wrapper.text()).toContain('Tax refund');
  });

  it('shows the FX note when a rate snapshot is loaded', () => {
    const wrapper = mount(MoneyInView);
    expect(wrapper.find('.fx-note').text()).toContain('converted at rates as of');
  });

  it('expands the compact RowEditor for a fixed stream and saves', async () => {
    const composable = useIncomeStreams();
    const wrapper = mount(MoneyInView);

    const salaryRow = wrapper.findAll('.row-main').find((r) => r.text().includes('Salary'));
    await salaryRow!.trigger('click');

    const editor = wrapper.find('[data-testid="row-editor"]');
    expect(editor.exists()).toBe(true);

    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save');
    await saveButton!.trigger('click');
    await flushPromises();

    expect(composable.update).toHaveBeenCalled();
  });

  it('cancels out of the RowEditor without saving', async () => {
    const composable = useIncomeStreams();
    const wrapper = mount(MoneyInView);

    const salaryRow = wrapper.findAll('.row-main').find((r) => r.text().includes('Salary'));
    await salaryRow!.trigger('click');
    const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'Cancel');
    await cancelButton!.trigger('click');

    expect(wrapper.find('[data-testid="row-editor"]').exists()).toBe(false);
    expect(composable.update).not.toHaveBeenCalled();
  });

  it('archives a stream from the RowEditor', async () => {
    const composable = useIncomeStreams();
    const wrapper = mount(MoneyInView);

    const salaryRow = wrapper.findAll('.row-main').find((r) => r.text().includes('Salary'));
    await salaryRow!.trigger('click');
    const archiveButton = wrapper.findAll('button').find((b) => b.text() === 'Archive');
    await archiveButton!.trigger('click');
    await flushPromises();

    expect(composable.archive).toHaveBeenCalledWith('s1', fixedStream.updated_at);
  });

  it('falls back to the full IncomeStreamForm for an hourly stream', async () => {
    const wrapper = mount(MoneyInView);
    const freelanceRow = wrapper.findAll('.row-main').find((r) => r.text().includes('Freelance'));
    await freelanceRow!.trigger('click');

    expect(wrapper.find('[data-testid="row-editor"]').exists()).toBe(false);
    expect(wrapper.find('.edit-form').text()).toContain('Edit income');
  });
});

describe('MoneyOutView', () => {
  it('shows an "Add" trigger on desktop that opens the entry sheet defaulting to Out', async () => {
    useEntrySheet().close();
    const wrapper = mount(MoneyOutView, { props: { isDesktop: true } });
    const addButton = wrapper.findAll('button').find((b) => b.text() === 'Add');
    expect(addButton).toBeTruthy();
    await addButton!.trigger('click');
    const sheet = useEntrySheet();
    expect(sheet.isOpen.value).toBe(true);
    expect(sheet.defaultSide.value).toBe('out');
  });

  it('filters the merged list by kind', async () => {
    const wrapper = mount(MoneyOutView);
    expect(wrapper.text()).toContain('Rent');
    expect(wrapper.text()).toContain('Gift');
    expect(wrapper.text()).toContain('Groceries');

    const plannedTab = wrapper.findAll('.kind-filter .seg').find((b) => b.text() === 'Planned');
    await plannedTab!.trigger('click');

    expect(wrapper.text()).not.toContain('Rent');
    expect(wrapper.text()).toContain('Groceries');
  });

  it('expands the compact RowEditor for an obligation and saves', async () => {
    const composable = useObligations();
    const wrapper = mount(MoneyOutView);

    const rentRow = wrapper.findAll('.row-main').find((r) => r.text().includes('Rent'));
    await rentRow!.trigger('click');
    expect(wrapper.find('[data-testid="row-editor"]').exists()).toBe(true);

    const saveButton = wrapper.findAll('button').find((b) => b.text() === 'Save');
    await saveButton!.trigger('click');
    await flushPromises();

    expect(composable.update).toHaveBeenCalled();
  });

  it('deletes a one-off from the RowEditor', async () => {
    const composable = useOneOffEvents();
    const wrapper = mount(MoneyOutView);

    const giftRow = wrapper.findAll('.row-main').find((r) => r.text().includes('Gift'));
    await giftRow!.trigger('click');
    const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete');
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(composable.remove).toHaveBeenCalledWith('e1');
  });

  it('falls back to the full PlannedSpendForm for planned spend', async () => {
    const wrapper = mount(MoneyOutView);
    const groceriesRow = wrapper.findAll('.row-main').find((r) => r.text().includes('Groceries'));
    await groceriesRow!.trigger('click');

    expect(wrapper.find('[data-testid="row-editor"]').exists()).toBe(false);
    expect(wrapper.find('.edit-form').text()).toContain('Edit planned spend');
  });
});
