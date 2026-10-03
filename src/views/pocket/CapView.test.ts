import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ref } from 'vue';
import CapView from './CapView.vue';

const mocks = vi.hoisted(() => ({
  home: vi.fn(),
  space: vi.fn(),
  save: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/composables/usePocketHome', () => ({ usePocketHome: mocks.home }));
vi.mock('@/stores/space', () => ({ useSpaceStore: mocks.space }));
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));
vi.mock('@/composables/useSpendMode', () => ({
  useSpendMode: () => ({ spendMode: ref('cap'), error: ref(null), setMode: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.space.mockReturnValue({ currentSpace: { currency: 'EUR' }, currentSpaceId: 'space-1' });
  mocks.home.mockReturnValue({
    cap: {
      cap: ref({ monthly_cap_minor: 10000000, nudge_enabled: true, nudge_pct: 75 }),
      setCap: mocks.save,
    },
    summary: ref(null),
    loading: ref(false),
    error: ref(null),
  });
});

describe('monthly cap editing', () => {
  it('uses whole minor units for RSD', async () => {
    mocks.space.mockReturnValue({ currentSpace: { currency: 'RSD' } });
    const wrapper = mount(CapView);
    await wrapper.find('input[type="number"]').setValue('2500');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith({
      monthlyCapMinor: 2500,
      nudgeEnabled: true,
      nudgePct: 75,
    });
  });
  it('prefills saved values and saves the edited amount in minor units, preserving warnings', async () => {
    const wrapper = mount(CapView);
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('100000');
    expect((wrapper.findAll('input[type="number"]')[1]!.element as HTMLInputElement).value).toBe(
      '75'
    );
    await wrapper.find('input[type="number"]').setValue('1234.56');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith({
      monthlyCapMinor: 123456,
      nudgeEnabled: true,
      nudgePct: 75,
    });
    expect(mocks.success).toHaveBeenCalledWith('Cap saved');
  });

  it('preserves the edited value on a save error', async () => {
    mocks.save.mockRejectedValue(new Error('Save failed'));
    const wrapper = mount(CapView);
    await wrapper.find('input[type="number"]').setValue('2500');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe('Save failed');
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('2500');
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('ignores repeated submits while saving', async () => {
    let finish!: () => void;
    mocks.save.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const wrapper = mount(CapView);
    await wrapper.find('form').trigger('submit');
    await wrapper.find('form').trigger('submit');
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    finish();
    await flushPromises();
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
  });

  it('rejects a negative cap without saving', async () => {
    const wrapper = mount(CapView);
    await wrapper.find('input[type="number"]').setValue('-1');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
