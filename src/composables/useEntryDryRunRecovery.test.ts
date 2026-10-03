import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useEntryDryRun } from './useEntryDryRun';
import type { ProjectionIngredients } from '@/lib/horizon/loadProjectionIngredients';

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/horizon/loadProjectionIngredients', () => ({ loadProjectionIngredients: load }));
function result(): ProjectionIngredients {
  return {
    settings: {} as never,
    unconverted: [{ currency: 'USD', amountMinor: 500 }],
    input: {
      accounts: [],
      incomeStreams: [],
      obligations: [],
      oneOffEvents: [],
      plannedSpend: [],
      pocketSpend: { actuals: [], forward: [] },
      todayKey: '2026-10-03',
      range: { from: '2026-10-03', to: '2026-10-05' },
      reportingCurrency: 'RSD',
      rates: [],
      calendar: { workingWeekdays: [1, 2, 3, 4, 5], holidays: [] },
      eventOrder: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
    },
  };
}
beforeEach(() => {
  setActivePinia(createPinia());
  load.mockReset();
  const space = useSpaceStore();
  space.spaces = ['s1', 's2'].map((id) => ({
    id,
    name: id,
    currency: 'RSD',
    timezone: 'Europe/Belgrade',
    created_at: '',
  }));
  space.currentSpaceId = 's1';
});
describe('entry preview recovery', () => {
  it('preserves adapter omissions and detects draft-only FX omissions', async () => {
    load.mockResolvedValue(result());
    const preview = useEntryDryRun();
    await preview.loadBaseline();
    expect(preview.conversionIssues.value[0]?.currency).toBe('USD');
    preview.preview({
      kind: 'oneOff',
      value: {
        name: 'Trip',
        accountId: 'a1',
        category: 'other',
        currency: 'EUR',
        date: '2026-10-03',
        amountMinor: 1000,
        direction: 'out',
      },
    });
    expect(preview.conversionIssues.value.map((x) => x.currency)).toEqual(['USD', 'EUR']);
    expect(preview.reportingCurrency.value).toBe('RSD');
    preview.preview({
      kind: 'oneOff',
      value: {
        name: 'Trip',
        accountId: 'a1',
        category: 'other',
        currency: 'USD',
        date: '2026-10-03',
        amountMinor: 1000,
        direction: 'out',
      },
    });
    expect(preview.conversionIssues.value).toEqual([{ currency: 'USD', amountMinor: 1500 }]);
  });
  it('clears stale effect on failure and retries the current draft', async () => {
    load
      .mockResolvedValueOnce(result())
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(result());
    const preview = useEntryDryRun();
    await preview.loadBaseline();
    preview.preview({
      kind: 'oneOff',
      value: {
        name: 'Coffee',
        accountId: 'a1',
        category: 'other',
        currency: 'RSD',
        date: '2026-10-03',
        amountMinor: 1000,
        direction: 'out',
      },
    });
    await preview.loadBaseline();
    expect(preview.effect.value).toBeNull();
    expect(preview.error.value).toBe('offline');
    await preview.loadBaseline();
    expect(preview.error.value).toBeNull();
    expect(preview.effect.value?.todayDeltaMinor).toBe(-1000);
  });
  it('ignores an old space response', async () => {
    let resolve!: (value: ProjectionIngredients) => void;
    load.mockReturnValue(
      new Promise<ProjectionIngredients>((r) => {
        resolve = r;
      })
    );
    const preview = useEntryDryRun();
    const pending = preview.loadBaseline();
    useSpaceStore().currentSpaceId = 's2';
    resolve(result());
    await pending;
    expect(preview.ingredients.value).toBeNull();
    expect(preview.conversionIssues.value).toEqual([]);
  });
});
