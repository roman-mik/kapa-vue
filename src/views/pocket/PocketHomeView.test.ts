import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vite-plus/test';
import { ref } from 'vue';
import PocketHomeView from './PocketHomeView.vue';

const { home } = vi.hoisted(() => ({ home: vi.fn() }));
vi.mock('@/composables/usePocketHome', () => ({ usePocketHome: home }));
vi.mock('@/composables/useCategories', () => ({ useCategories: () => ({ categories: ref([]) }) }));
vi.mock('@/composables/useConvertedExpenses', () => ({
  useConvertedExpenses: () => ({ isForeign: () => false, convertedMinor: () => null }),
}));
vi.mock('@/composables/useExpenses', () => ({ useExpenses: () => ({ remove: vi.fn() }) }));
vi.mock('@/composables/useToast', () => ({ useToast: () => ({}) }));
vi.mock('@/composables/usePocketEntrySheet', () => ({
  usePocketEntrySheet: () => ({ open: vi.fn() }),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe('Pocket cap entry point', () => {
  it.each(['in-budget', 'over', 'no-cap'])('offers the cap editor in %s state', (kind) => {
    home.mockReturnValue({
      summary: ref({
        home: { kind },
        spent: 100,
        remaining: 900,
        todayExpenses: [],
        unconverted: [],
        categoryBreakdown: [],
      }),
      loading: ref(false),
      error: ref(null),
      rates: ref([]),
      refresh: vi.fn(),
    });
    const wrapper = shallowMount(PocketHomeView, {
      global: {
        renderStubDefaultSlot: true,
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="typeof to === \'string\' ? to : to.name"><slot /></a>',
          },
        },
      },
    });
    const link = wrapper.find('a');
    expect(link.text()).toBe(kind === 'no-cap' ? 'Set a cap' : 'Edit monthly cap');
    expect(link.attributes('data-to')).toBe(kind === 'no-cap' ? '/pocket/cap' : 'pocket-cap');
  });
});
