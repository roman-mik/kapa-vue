import { useSessionStore } from '@/stores/session';
import { queryCache } from '@/lib/serverState/queryCache';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, afterEach, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useEntryDryRun } from './useEntryDryRun';
import type { ProjectionInput } from '@roman-mik/kapa-core/horizon';
const { loadProjectionInput, getPaymentTrackingState } = vi.hoisted(() => ({
  loadProjectionInput: vi.fn(),
  getPaymentTrackingState: vi.fn(),
}));
vi.mock('@roman-mik/kapa-core/horizon', async (original) => ({
  ...(await original<typeof import('@roman-mik/kapa-core/horizon')>()),
  loadProjectionInput,
}));
vi.mock('@roman-mik/kapa-core/horizon/queries', async (original) => ({
  ...(await original<typeof import('@roman-mik/kapa-core/horizon/queries')>()),
  getPaymentTrackingState,
}));
const input: ProjectionInput = {
  accounts: [
    {
      id: 'bank',
      currency: 'RSD',
      current_balance_minor: 100000,
      include_in_total: true,
      archived: false,
    },
  ],
  incomeStreams: [],
  obligations: [],
  oneOffEvents: [],
  plannedSpend: [],
  pocketSpend: { actuals: [], forward: [] },
  todayKey: '2026-10-04',
  range: { from: '2026-10-04', to: '2026-11-04' },
  reportingCurrency: 'RSD',
  rates: [],
  calendar: { workingWeekdays: [1, 2, 3, 4, 5], holidays: [] },
  eventOrder: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
};
beforeEach(() => {
  setActivePinia(createPinia());
  queryCache.clear();
  useSessionStore().user = { id: 'user' } as never;
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-04T10:00:00Z'));
  const space = useSpaceStore();
  space.spaces = [
    { id: 'space', name: 'Home', timezone: 'Europe/Belgrade', currency: 'RSD', created_at: '' },
  ];
  space.currentSpaceId = 'space';
  getPaymentTrackingState.mockResolvedValue(null);
  loadProjectionInput.mockResolvedValue({ input, settings: {}, unconverted: [] });
});
afterEach(() => vi.useRealTimers());
it('loads canonical ingredients with lifecycle enabled for a tracked space', async () => {
  getPaymentTrackingState.mockResolvedValue({ space_id: 'space' });
  const state = useEntryDryRun();
  await state.loadBaseline();
  expect(loadProjectionInput).toHaveBeenCalledWith(
    expect.anything(),
    'space',
    expect.objectContaining({ lifecycle: true, timeZone: 'Europe/Belgrade' })
  );
  expect(state.ingredients.value?.accounts).toHaveLength(1);
});
it('preserves adapter conversion omissions', async () => {
  loadProjectionInput.mockResolvedValue({
    input,
    settings: {},
    unconverted: [{ currency: 'USD', amountMinor: 1200 }],
  });
  const state = useEntryDryRun();
  await state.loadBaseline();
  expect(state.conversionIssues.value).toEqual([{ currency: 'USD', amountMinor: 1200 }]);
});
it('projects a virtual draft against actual cash without restoring a completed expectation', async () => {
  loadProjectionInput.mockResolvedValue({
    input: {
      ...input,
      lifecycle: {
        observations: [
          {
            id: 'obs',
            accountId: 'bank',
            balanceMinor: 100000,
            currency: 'RSD',
            date: input.todayKey,
          },
        ],
        occurrences: [],
        issues: [],
      },
    },
    settings: {},
    unconverted: [],
  });
  const state = useEntryDryRun();
  await state.loadBaseline();
  state.preview({
    kind: 'oneOff',
    value: {
      name: 'Coffee',
      category: 'other',
      currency: 'RSD',
      accountId: 'bank',
      date: input.todayKey,
      amountMinor: 500,
      direction: 'out',
    },
  });
  expect(state.effect.value?.todayDeltaMinor).toBe(-500);
  expect(state.lifecycleIssues.value).toEqual([]);
});
it('keeps preview unavailable before loading a baseline', () => {
  const state = useEntryDryRun();
  state.preview({
    kind: 'oneOff',
    value: {
      name: 'Coffee',
      category: 'other',
      currency: 'RSD',
      accountId: 'bank',
      date: input.todayKey,
      amountMinor: 500,
      direction: 'out',
    },
  });
  expect(state.effect.value).toBeNull();
});
