import { createPinia, setActivePinia } from 'pinia';
import { ref, nextTick } from 'vue';
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import { buildProjection, occurrenceFingerprint } from '@roman-mik/kapa-core/horizon';
import { useCashflowDecision } from './useCashflowDecision';
import { useSpaceStore } from '@/stores/space';
import { useSessionStore } from '@/stores/session';
const settings = ref({
  reserve_minor: 20000 as number | null,
  reserve_currency: 'EUR',
  reporting_currency: 'EUR',
});
vi.mock('./useHorizonSettingsResource', () => ({
  useHorizonSettingsResource: () => ({ data: settings, loading: ref(false), error: ref(null) }),
}));
vi.mock('./useAccounts', () => ({ useAccounts: () => ({ accounts: ref([]) }) }));
import { input } from './__fixtures__/cashflow';

beforeEach(() => {
  setActivePinia(createPinia());
  const space = useSpaceStore();
  space.spaces = [{ id: 's1' }, { id: 's2' }] as never;
  space.currentSpaceId = 's1';
  useSessionStore().user = { id: 'u1' } as never;
  settings.value = { reserve_minor: 20000, reserve_currency: 'EUR', reporting_currency: 'EUR' };
});
it('shares drafts, preserves them after refresh, blocks changed sources and clears on switch', async () => {
  const base = input();
  const data = ref({ ...buildProjection(base), input: base });
  const loading = ref(false);
  const error = ref<string | null>(null);
  const a = useCashflowDecision(data, loading, error);
  const b = useCashflowDecision(data, loading, error);
  const candidate = a.candidates.value[0]!;
  a.store.draft = {
    changes: [
      {
        occurrenceKey: candidate.expected.key,
        fingerprint: occurrenceFingerprint(candidate),
        amountMinor: 90000,
        date: '2026-10-25',
        reason: 'Delay',
      },
    ],
    dailySpend: null,
  };
  a.store.mode = 'cautious';
  expect(b.result.value?.summary.nextIncome.date).toBe('2026-10-25');
  const changed = input();
  changed.oneOffEvents[0]!.amountMinor = 110000;
  data.value = { ...buildProjection(changed), input: changed };
  expect(a.error.value).toContain('Review');
  expect(a.qualified.value).toBe(false);
  expect(a.store.draft.changes).toHaveLength(1);
  a.reviewChange(candidate.expected.key);
  expect(a.qualified.value).toBe(true);
  useSpaceStore().currentSpaceId = 's2';
  await nextTick();
  expect(a.store.draft.changes).toHaveLength(0);
  expect(a.store.mode).toBe('expected');
});
it('loading, errors and currency mismatch cannot give affirmative reserve coverage', () => {
  const base = input();
  const data = ref({ ...buildProjection(base), input: base });
  const loading = ref(false);
  const error = ref<string | null>(null);
  const d = useCashflowDecision(data, loading, error);
  expect(d.qualified.value).toBe(true);
  loading.value = true;
  expect(d.qualified.value).toBe(false);
  loading.value = false;
  error.value = 'Failed';
  expect(d.qualified.value).toBe(false);
  error.value = null;
  settings.value.reporting_currency = 'USD';
  expect(d.reserveMismatch.value).toBe(true);
  expect(d.result.value?.summary.selected.reserveShortfallMinor).toBeNull();
});

it('shares a purchase trial, recomputes refreshed inputs, and clears on space switch', async () => {
  const base = input();
  base.pocketSpend.forward = [{ dateKey: '2026-10-20', amountMinor: 40000 }];
  const data = ref({ ...buildProjection(base), input: base });
  const a = useCashflowDecision(data, ref(false), ref(null));
  const b = useCashflowDecision(data, ref(false), ref(null));
  a.trialStore.draft = {
    kind: 'purchase',
    name: 'Laptop',
    date: '2026-10-10',
    amountMinor: 10000,
    currency: 'EUR',
    accountId: 'a',
    allocationCurrency: 'EUR',
    allocations: [{ date: '2026-10-20', amountMinor: 10000, availableMinor: 40000 }],
  };
  expect(b.result.value?.summary.selected.endingCashMinor).toBe(110000);
  const changed = {
    ...base,
    pocketSpend: { actuals: [], forward: [{ dateKey: '2026-10-20', amountMinor: 30000 }] },
  };
  data.value = { ...buildProjection(changed), input: changed };
  expect(a.qualified.value).toBe(false);
  expect(a.error.value).toContain('Allowance changed');
  expect(a.trialStore.draft).not.toBeNull();
  useSpaceStore().currentSpaceId = 's2';
  await nextTick();
  expect(a.trialStore.draft).toBeNull();
});

it('recomputes dated savings on current assumptions, rejects excluded accounts and missing FX', () => {
  const base = input();
  const data = ref({ ...buildProjection(base), input: base });
  const loading = ref(false);
  const d = useCashflowDecision(data, loading, ref(null));
  d.trialStore.draft = {
    kind: 'exploration',
    purpose: 'saving',
    savingTreatment: 'earmark',
    cadence: 'monthly',
    amountMinor: 35000,
    currency: 'EUR',
    accountId: 'a',
    date: '2026-10-10',
    endDate: '2026-10-31',
  };
  expect(d.result.value?.summary.selected.reserveShortfallMinor).toBe(5000);
  loading.value = true;
  expect(d.qualified.value).toBe(false);
  loading.value = false;
  if (d.trialStore.draft.kind !== 'exploration') return;
  d.trialStore.draft.currency = 'USD';
  expect(d.error.value).toContain('FX');
  expect(d.qualified.value).toBe(false);
  d.trialStore.draft.currency = 'EUR';
  const changed = {
    ...base,
    accounts: base.accounts.map((a) => ({ ...a, include_in_total: false })),
  };
  data.value = { ...buildProjection(changed), input: changed };
  expect(d.error.value).toContain('included account');
  expect(d.trialStore.draft).not.toBeNull();
});
