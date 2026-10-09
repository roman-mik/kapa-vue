import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import ReserveEditor from './ReserveEditor.vue';
const mock = vi.hoisted(() => ({
  save: vi.fn(),
  invalidate: vi.fn(),
  space: { currentSpaceId: 's1' },
}));
const data = ref({
  reserve_minor: null as number | null,
  reserve_currency: null as string | null,
  reporting_currency: 'EUR',
});
vi.mock('@roman-mik/kapa-core/horizon/queries', () => ({ setReserve: mock.save }));
vi.mock('@/composables/useHorizonSettingsResource', () => ({
  useHorizonSettingsResource: () => ({ data, loading: ref(false), invalidate: mock.invalidate }),
}));
vi.mock('@/stores/space', () => ({ useSpaceStore: () => mock.space }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
beforeEach(() => {
  vi.clearAllMocks();
  data.value = { reserve_minor: null, reserve_currency: null, reporting_currency: 'EUR' };
  mock.save.mockResolvedValue(undefined);
});
it('saves a reserve, keeps a failed draft, then clears the pair', async () => {
  const w = mount(ReserveEditor);
  await w.get('input').setValue('200.00');
  mock.save.mockRejectedValueOnce(new Error('Save failed'));
  await w.get('form').trigger('submit');
  await flushPromises();
  expect(w.get('[role="alert"]').text()).toContain('Save failed');
  expect((w.get('input').element as HTMLInputElement).value).toBe('200.00');
  await w.get('form').trigger('submit');
  await flushPromises();
  expect(mock.save).toHaveBeenLastCalledWith({}, 's1', { amountMinor: 20000, currency: 'EUR' });
  await w.findAll('button')[1]!.trigger('click');
  await flushPromises();
  expect(mock.save).toHaveBeenLastCalledWith({}, 's1', null);
});
it('requires review after reporting currency changes and rejects fractional minor units', async () => {
  data.value = { reserve_minor: 20000, reserve_currency: 'USD', reporting_currency: 'EUR' };
  const w = mount(ReserveEditor);
  expect(w.text()).toContain('Set it again in EUR');
  await w.get('input').setValue('1.001');
  await w.get('form').trigger('submit');
  await flushPromises();
  expect(mock.save).not.toHaveBeenCalled();
});
