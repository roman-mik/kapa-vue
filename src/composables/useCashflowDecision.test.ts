import { createPinia, setActivePinia } from 'pinia';
import { ref, nextTick } from 'vue';
import { beforeEach, expect, it, vi } from 'vite-plus/test';
import {
  buildProjection,
  occurrenceFingerprint,
  type ProjectionInput,
} from '@roman-mik/kapa-core/horizon';
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
function input(): ProjectionInput {
  return {
    accounts: [
      {
        id: 'a',
        currency: 'EUR',
        current_balance_minor: 50000,
        archived: false,
        include_in_total: true,
      },
    ],
    incomeStreams: [],
    obligations: [],
    plannedSpend: [],
    oneOffEvents: [
      {
        id: 'salary',
        name: 'Salary',
        date: '2026-10-15',
        currency: 'EUR',
        amountMinor: 100000,
        direction: 'in',
        accountId: 'a',
      },
    ],
    pocketSpend: { actuals: [], forward: [] },
    todayKey: '2026-10-01',
    range: { from: '2026-10-01', to: '2026-10-31' },
    reportingCurrency: 'EUR',
    rates: [],
    calendar: { workingWeekdays: [1, 2, 3, 4, 5], holidays: [] },
    eventOrder: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
    assessment: {
      complete: true,
      issues: [],
      provenance: {
        spaceId: 's1',
        timeZone: 'Europe/Belgrade',
        generatedAt: '',
        fetchedAt: '',
        revision: '1',
        range: { from: '2026-10-01', to: '2026-10-31' },
        spendMode: 'cap',
        spendingWindow: null,
        historyReview: null,
        includedAccountIds: ['a'],
        excludedAccountIds: [],
        observationDates: [],
        fxDates: [],
      },
    },
  };
}
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
