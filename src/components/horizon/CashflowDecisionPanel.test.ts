import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import { buildProjection } from '@roman-mik/kapa-core/horizon';
import { input } from '@/composables/__fixtures__/cashflow';
import { useCashflowDecision } from '@/composables/useCashflowDecision';
import { useSpaceStore } from '@/stores/space';
import { useSessionStore } from '@/stores/session';
import CashflowDecisionPanel from './CashflowDecisionPanel.vue';
const settings = ref({ reserve_minor: 20000, reserve_currency: 'EUR', reporting_currency: 'EUR' });
vi.mock('@/composables/useHorizonSettingsResource', () => ({
  useHorizonSettingsResource: () => ({ data: settings, loading: ref(false), error: ref(null) }),
}));
vi.mock('@/composables/useAccounts', () => ({
  useAccounts: () => ({ accounts: ref([{ id: 'a', name: 'Daily account' }]) }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
beforeEach(() => {
  setActivePinia(createPinia());
  useSessionStore().user = { id: 'u' } as never;
  useSpaceStore().spaces = [{ id: 's1' }] as never;
  useSpaceStore().currentSpaceId = 's1';
});
it('edits and dismisses temporary payment assumptions with no API writes', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const base = input();
  const data = ref({ ...buildProjection(base), input: base });
  const decision = useCashflowDecision(data, ref(false), ref(null));
  const w = mount(CashflowDecisionPanel, {
    props: { decision },
    global: { stubs: { RouterLink: true } },
  });
  await w.findAll('.modes button')[1]!.trigger('click');
  expect(w.text()).toContain('Same assumptions as expected');
  await w.get('select').setValue(decision.candidates.value[0]!.expected.key);
  const fields = w.findAll('form')[0]!.findAll('input');
  await fields[0]!.setValue('900');
  await fields[1]!.setValue('2026-10-25');
  await fields[2]!.setValue('Customer may pay late');
  await w.findAll('form')[0]!.trigger('submit');
  await flushPromises();
  expect(w.text()).toContain('Customer may pay late');
  expect(w.text()).toContain('2026-10-15 → 2026-10-25');
  expect(decision.result.value?.summary.selected.endingCashMinor).toBe(140000);
  expect(fetch).not.toHaveBeenCalled();
  expect(base.oneOffEvents[0]!.amountMinor).toBe(100000);
  const dismiss = w.findAll('button').find((b) => b.text() === 'Dismiss all trial changes')!;
  await dismiss.trigger('click');
  expect(decision.store.draft.changes).toHaveLength(0);
  expect(decision.result.value?.summary.selected.endingCashMinor).toBe(150000);
  vi.unstubAllGlobals();
});
it('does not claim coverage while inputs are incomplete or refreshing', async () => {
  const base = input();
  base.assessment!.issues = [{ code: 'missingCap', message: 'Set a cap', repair: 'cap' }];
  const data = ref({ ...buildProjection(base), input: base });
  const loading = ref(false);
  const decision = useCashflowDecision(data, loading, ref(null));
  const w = mount(CashflowDecisionPanel, {
    props: { decision },
    global: { stubs: { RouterLink: true } },
  });
  expect(w.text()).toContain('Cannot assess cash coverage');
  expect(w.text()).not.toContain('included cash stays');
  loading.value = true;
  await flushPromises();
  expect(w.text()).toContain('Forecast updating or unavailable');
  expect(w.text()).not.toContain('included cash stays');
});
