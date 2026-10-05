import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { reactive, ref, type Ref } from 'vue';
import HistoryView from './HistoryView.vue';
import CategoryFilterPicker from '@/components/pocket/CategoryFilterPicker.vue';
import ExpenseRowMenu from '@/components/pocket/ExpenseRowMenu.vue';
import ExpenseEntryForm from '@/components/pocket/ExpenseEntryForm.vue';

const mocks = vi.hoisted(() => ({
  expenses: vi.fn(),
  home: vi.fn(),
  categories: vi.fn(),
  space: vi.fn(),
  duplicate: vi.fn(),
  link: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/composables/useExpenses', () => ({ useExpenses: mocks.expenses }));
vi.mock('@/composables/usePocketHome', () => ({ usePocketHome: mocks.home }));
vi.mock('@/composables/useCategories', () => ({ useCategories: mocks.categories }));
vi.mock('@/stores/space', () => ({ useSpaceStore: mocks.space }));
vi.mock('@/stores/session', () => ({ useSessionStore: () => ({ user: { id: 'me' } }) }));
vi.mock('@/composables/useSpaceMembers', () => ({ useSpaceMembers: () => ({ members: ref([]) }) }));
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/composables/usePocketEntrySheet', () => ({
  usePocketEntrySheet: () => ({ open: mocks.duplicate }),
}));
vi.mock('@/composables/usePaymentLinkSheet', () => ({
  usePaymentLinkSheet: () => ({ open: mocks.link }),
}));

let wrapper: VueWrapper<InstanceType<typeof HistoryView>>;
let space: { currentSpaceId: string; currentSpace: { timezone: string; currency: string } };
let expenses: Ref<ReturnType<typeof row>[]>;
const row = (
  id: string,
  category_id: string | null,
  amount_minor: number,
  spent_at = '2026-10-05T12:00:00Z'
) => ({
  id,
  category_id,
  category_name: category_id,
  amount_minor,
  currency: 'RSD',
  spent_at,
  updated_at: 'version',
  user_id: 'me',
  counts_toward_cap: true,
  note: id,
});
function setup() {
  wrapper = mount(HistoryView, {
    global: { stubs: { CategoryFilterPicker: true, ExpenseRowMenu: true, ExpenseEntryForm: true } },
  });
  return wrapper;
}
async function filter(value: string) {
  wrapper.getComponent(CategoryFilterPicker).vm.$emit('update:modelValue', value);
  await wrapper.vm.$nextTick();
}
beforeEach(() => {
  vi.clearAllMocks();
  space = reactive({ currentSpaceId: 'one', currentSpace: { timezone: 'UTC', currency: 'RSD' } });
  expenses = ref([
    row('rent', 'archived', 30000),
    row('groceries', 'food', 5000),
    row('other', null, 1000, '2026-10-04T12:00:00Z'),
  ]);
  mocks.space.mockReturnValue(space);
  mocks.expenses.mockReturnValue({
    expenses,
    loading: ref(false),
    error: ref(null),
    remove: mocks.remove,
    update: mocks.update,
  });
  mocks.remove.mockResolvedValue({ ok: true });
  mocks.update.mockResolvedValue({ ok: true });
  mocks.categories.mockReturnValue({
    categories: ref([
      { id: 'food', name: 'Groceries' },
      { id: 'archived', name: 'Rent', archived: true },
      { id: 'empty', name: 'No spending' },
    ]),
  });
  mocks.home.mockReturnValue({
    summary: ref({
      currency: 'RSD',
      categoryBreakdown: [
        { categoryId: 'food', spent: 5000 },
        { categoryId: 'archived', spent: 30000 },
      ],
      unconverted: [{ currency: 'USD', amountMinor: 1000 }],
    }),
    rates: ref([]),
    loading: ref(false),
    error: ref(null),
    refresh: mocks.refresh,
  });
});
afterEach(() => wrapper?.unmount());

describe('History category filtering', () => {
  it('keeps order, grouping and totals while filtering active, archived and uncategorized rows', async () => {
    setup();
    expect(wrapper.findAll('.note').map((n) => n.text())).toEqual(['rent', 'groceries', 'other']);
    await filter('food');
    expect(wrapper.findAll('.note').map((n) => n.text())).toEqual(['groceries']);
    expect(wrapper.findAll('.day-group')).toHaveLength(1);
    expect(wrapper.get('.day-total').text()).toContain('5,000');
    await filter('archived');
    expect(wrapper.get('.note').text()).toBe('rent');
    expect(wrapper.get('.day-total').text()).toContain('30,000');
    await filter('');
    expect(wrapper.get('.note').text()).toBe('other');
    await wrapper.get('.category-toolbar button').trigger('click');
    expect(wrapper.findAll('.note')).toHaveLength(3);
  });
  it('offers filtered-empty recovery and resets on space change', async () => {
    setup();
    await filter('empty');
    expect(wrapper.text()).toContain('No expenses match this category');
    await wrapper.get('.empty button').trigger('click');
    expect(wrapper.findAll('.note')).toHaveLength(3);
    await filter('food');
    space.currentSpaceId = 'two';
    await wrapper.vm.$nextTick();
    expect(wrapper.getComponent(CategoryFilterPicker).props()).toMatchObject({ modelValue: 'all' });
  });
  it('keeps an unfiltered empty history distinct', () => {
    expenses.value = [];
    setup();
    expect(wrapper.text()).toContain('No expenses yet');
    expect(wrapper.find('.empty button').exists()).toBe(false);
  });
  it('preserves edit, duplicate, linking, delete and summary refresh', async () => {
    setup();
    await filter('food');
    const menu = wrapper.getComponent(ExpenseRowMenu);
    menu.vm.$emit('select', 'duplicate');
    menu.vm.$emit('select', 'link');
    expect(mocks.duplicate).toHaveBeenCalledWith(
      expect.objectContaining({ prefill: expect.objectContaining({ amountMinor: 5000 }) })
    );
    expect(mocks.link).toHaveBeenCalledWith({ expense: expenses.value[1] });
    menu.vm.$emit('select', 'edit');
    await wrapper.vm.$nextTick();
    const form = wrapper.getComponent(ExpenseEntryForm);
    expect(form.props()).toMatchObject({
      initialValues: { amountMinor: 5000, categoryId: 'food' },
    });
    form.vm.$emit('cancel');
    await wrapper.vm.$nextTick();
    wrapper.getComponent(ExpenseRowMenu).vm.$emit('confirm', 'delete');
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.remove).toHaveBeenCalledWith('groceries', 'version');
  });
});
